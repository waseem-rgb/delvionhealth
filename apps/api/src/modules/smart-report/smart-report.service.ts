import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

// ── Hardcoded paths ──
const HARRISON_PDF_PATH =
  "/Users/waseemafsar/Desktop/clinical_book/Harrison's Medicine 22nd Ed.pdf";
const INDEX_DIR = path.join(process.cwd(), "data");
const INDEX_PATH = path.join(INDEX_DIR, "harrison_index.json");

const CHUNK_WORDS = 500;
const CHUNK_OVERLAP = 50;
const TOP_K = 8;

interface HarrisonChunk {
  id: string;
  text: string;
  page: number;
  wordFreq: Record<string, number>;
}

interface AbnormalParam {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: string;
  testName: string;
}

@Injectable()
export class SmartReportService implements OnModuleInit {
  private readonly logger = new Logger(SmartReportService.name);
  private chunks: HarrisonChunk[] = [];
  private _indexed = false;
  private anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ── Load index on startup ──
  async onModuleInit() {
    try {
      if (fs.existsSync(INDEX_PATH)) {
        const stat = fs.statSync(INDEX_PATH);
        if (stat.size > 1000) {
          const raw = fs.readFileSync(INDEX_PATH, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.chunks = parsed;
            this._indexed = true;
            this.logger.log(
              `Harrison RAG ready: ${this.chunks.length} chunks loaded from disk`,
            );
            return;
          }
        }
      }
      this.logger.warn(
        "Harrison index not found — run POST /smart-report/build-index to build it",
      );
    } catch (e: unknown) {
      this.logger.error(
        `Failed to load Harrison index: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ── ONE-TIME: Build index from Harrison PDF ──
  async buildIndex(): Promise<{
    chunks: number;
    pages: number;
    status: string;
    message: string;
  }> {
    if (!fs.existsSync(HARRISON_PDF_PATH)) {
      throw new Error(`Harrison PDF not found at: ${HARRISON_PDF_PATH}`);
    }

    const stat = fs.statSync(HARRISON_PDF_PATH);
    this.logger.log(
      `Harrison PDF found: ${(stat.size / 1024 / 1024).toFixed(1)} MB`,
    );
    this.logger.log(
      "Parsing PDF — this may take 30 seconds to a few minutes...",
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(HARRISON_PDF_PATH);
    const pdfData = await pdfParse(buffer);

    this.logger.log(
      `PDF parsed: ${pdfData.numpages} pages, ${pdfData.text.length.toLocaleString()} characters`,
    );

    // Clean text
    const cleanedText = pdfData.text
      .replace(/\f/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();

    // Chunk by word count with overlap
    const rawChunks = this._chunkText(cleanedText, CHUNK_WORDS, CHUNK_OVERLAP);
    this.logger.log(`Created ${rawChunks.length} chunks`);

    // Build chunks with precomputed word frequencies for BM25
    const chunks: HarrisonChunk[] = rawChunks.map((text, i) => ({
      id: `h_${i}`,
      text: text.trim(),
      page: Math.round((i / rawChunks.length) * pdfData.numpages),
      wordFreq: this._computeWordFreq(text),
    }));

    // Ensure data directory exists
    if (!fs.existsSync(INDEX_DIR)) {
      fs.mkdirSync(INDEX_DIR, { recursive: true });
    }

    // Write index
    this.logger.log(`Writing index to ${INDEX_PATH}...`);
    fs.writeFileSync(INDEX_PATH, JSON.stringify(chunks), "utf-8");

    this.chunks = chunks;
    this._indexed = true;

    // Update DB for all tenants
    const tenants = await this.prisma.tenant
      .findMany({ select: { id: true } })
      .catch(() => []);
    for (const tenant of tenants) {
      await this.prisma.smartReportSettings
        .upsert({
          where: { tenantId: tenant.id },
          create: {
            tenantId: tenant.id,
            enabled: true,
            harrisonIndexBuilt: true,
            harrisonIndexBuiltAt: new Date(),
            harrisonChunkCount: chunks.length,
          },
          update: {
            harrisonIndexBuilt: true,
            harrisonIndexBuiltAt: new Date(),
            harrisonChunkCount: chunks.length,
          },
        })
        .catch((e: Error) =>
          this.logger.warn(
            `Could not update SmartReportSettings: ${e.message}`,
          ),
        );
    }

    this.logger.log(
      `Harrison index built successfully: ${chunks.length} chunks`,
    );
    return {
      chunks: chunks.length,
      pages: pdfData.numpages,
      status: "built",
      message: `Successfully indexed ${pdfData.numpages} pages into ${chunks.length} searchable chunks`,
    };
  }

  private _chunkText(
    text: string,
    wordsPerChunk: number,
    overlap: number,
  ): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const chunks: string[] = [];
    const step = wordsPerChunk - overlap;

    for (let i = 0; i < words.length; i += step) {
      const chunk = words.slice(i, i + wordsPerChunk).join(" ").trim();
      if (chunk.length > 50) chunks.push(chunk);
    }
    return chunks;
  }

  private _computeWordFreq(text: string): Record<string, number> {
    const freq: Record<string, number> = {};
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (const w of words) {
      freq[w] = (freq[w] ?? 0) + 1;
    }
    return freq;
  }

  // ── BM25-style retrieval ──
  retrieveRelevantChunks(query: string, topK = TOP_K): HarrisonChunk[] {
    if (!this._indexed || !this.chunks.length) return [];

    const queryTerms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (!queryTerms.length) return [];

    const k1 = 1.5;
    const b = 0.75;
    const avgLen =
      this.chunks.reduce(
        (s, c) =>
          s +
          Object.values(c.wordFreq).reduce((a, v) => a + v, 0),
        0,
      ) / this.chunks.length;

    const scored = this.chunks.map((chunk) => {
      const docLen = Object.values(chunk.wordFreq).reduce(
        (a, v) => a + v,
        0,
      );
      let score = 0;
      for (const term of queryTerms) {
        const tf = chunk.wordFreq[term] ?? 0;
        if (tf === 0) continue;
        const df = this.chunks.filter((c) => c.wordFreq[term]).length;
        const idf = Math.log(
          (this.chunks.length + 1) / (1 + df),
        );
        const bm25 =
          idf *
          ((tf * (k1 + 1)) /
            (tf + k1 * (1 - b + b * (docLen / avgLen))));
        score += bm25;
      }
      return { chunk, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.chunk);
  }

  get isIndexed(): boolean {
    return this._indexed;
  }
  get chunkCount(): number {
    return this.chunks.length;
  }

  // ── Generate Smart Report for abnormal results ──
  async generateSmartReport(
    abnormalParams: AbnormalParam[],
    patientAge: number,
    patientGender: string,
    tenantId: string,
  ): Promise<{ smartReportHtml: string; generatedAt: string }> {
    if (!abnormalParams.length) {
      return { smartReportHtml: "", generatedAt: new Date().toISOString() };
    }

    // Retrieve relevant Harrison's chunks
    const queryTerms = abnormalParams
      .map(
        (p) =>
          `${p.testName} ${p.name} ${p.flag.toLowerCase().replace("_", " ")} ${p.value} ${p.unit}`,
      )
      .join(" ");
    const relevantChunks = this.retrieveRelevantChunks(queryTerms, TOP_K);
    const contextText =
      relevantChunks.length > 0
        ? relevantChunks
            .map(
              (c, i) =>
                `[Harrison's Reference ${i + 1}, approx. page ${c.page}]\n${c.text.slice(0, 800)}`,
            )
            .join("\n\n---\n\n")
        : "No specific Harrison context retrieved. Use your medical knowledge.";

    // Get settings
    const settings = await this.prisma.smartReportSettings
      .findFirst({ where: { tenantId } })
      .catch(() => null);

    const includeInterpretation = settings?.includeInterpretation ?? true;
    const includeDiet = settings?.includeDietAdvice ?? true;
    const includeExercise = settings?.includeExerciseAdvice ?? true;
    const includeNextTests = settings?.includeNextTests ?? true;

    const abnormalSummary = abnormalParams
      .map(
        (p) =>
          `• ${p.name} (${p.testName}): ${p.value} ${p.unit} [Ref: ${p.referenceRange}] — ${p.flag}`,
      )
      .join("\n");

    const prompt = `You are a senior clinical pathologist writing a Smart Report appendix for a patient's lab report.

Patient: ${patientAge}Y / ${patientGender}

ABNORMAL PARAMETERS:
${abnormalSummary}

RELEVANT CONTENT FROM HARRISON'S PRINCIPLES OF INTERNAL MEDICINE (22nd Edition):
${contextText}

Write a 2-page Smart Report appendix with ONLY the following sections (skip sections if setting is false):

${includeInterpretation ? "1. CLINICAL INTERPRETATION — For each abnormal parameter, explain what the value means clinically for this patient's age/gender. Be specific, grounded, evidence-based. Not alarmist. Use phrases like 'may suggest', 'is consistent with'." : ""}

${includeDiet ? "2. DIETARY RECOMMENDATIONS — Evidence-based dietary changes that may help normalise these values. Be specific (e.g. 'increase intake of leafy greens rich in iron' not 'eat healthy')." : ""}

${includeExercise ? "3. LIFESTYLE & EXERCISE — Specific non-pharmacological lifestyle modifications with evidence basis." : ""}

${includeNextTests ? "4. RECOMMENDED FOLLOW-UP — Suggest specific follow-up tests and timeline based on the abnormalities found." : ""}

IMPORTANT STYLE RULES:
- Write in clear, professional English suitable for a physician-reviewed report
- Do NOT recommend any medications or drugs
- Be evidence-based — cite Harrison's where relevant
- Keep each section to 3-5 bullet points maximum
- Be subtle and professional, not alarmist

Return ONLY HTML (no markdown, no code blocks). Use these HTML tags:
<div class="sr-section"><h3>Section Title</h3><ul><li>Point</li></ul></div>`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      let html = response.content
        .filter((c) => c.type === "text")
        .map((c) => ("text" in c ? c.text : ""))
        .join("");

      html = html
        .replace(/```html\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const styledHtml = `
<div style="page-break-before:always;"></div>
<div class="smart-report" style="padding:16mm 18mm;font-family:Arial,sans-serif;font-size:11px;color:#1e293b;">
  <div style="text-align:center;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #0e7490;">
    <h2 style="font-size:16px;color:#0e7490;margin:0;">Smart Report — Clinical Insights</h2>
    <p style="font-size:9px;color:#64748b;margin:4px 0 0;">Evidence-based analysis of abnormal parameters · Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
  </div>

  <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:10px;">
    <strong>Abnormal Parameters Summary:</strong>
    ${abnormalParams.map((p) => `<span style="display:inline-block;background:#fef9c3;padding:2px 6px;border-radius:4px;margin:2px 4px;font-size:9px;">${p.name}: <strong style="color:#dc2626;">${p.value}</strong> ${p.unit}</span>`).join("")}
  </div>

  ${html}

  <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;text-align:center;">
    This Smart Report is generated using evidence-based clinical references (Harrison's Principles of Internal Medicine, 22nd Ed.) and should be interpreted by a qualified healthcare professional.
  </div>
</div>`;

      return {
        smartReportHtml: styledHtml,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error(
        `Smart report generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { smartReportHtml: "", generatedAt: new Date().toISOString() };
    }
  }

  // ── Get/Update settings ──
  async getSettings(tenantId: string) {
    let settings = await this.prisma.smartReportSettings.findFirst({
      where: { tenantId },
    });
    if (!settings) {
      settings = await this.prisma.smartReportSettings.create({
        data: { tenantId },
      });
    }
    return {
      ...settings,
      harrisonIndexed: this._indexed,
      harrisonChunksLoaded: this.chunks.length,
    };
  }

  async updateSettings(tenantId: string, data: Record<string, unknown>) {
    return this.prisma.smartReportSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        enabled: (data.enabled as boolean) ?? true,
        includeInterpretation:
          (data.includeInterpretation as boolean) ?? true,
        includeDietAdvice: (data.includeDietAdvice as boolean) ?? true,
        includeExerciseAdvice:
          (data.includeExerciseAdvice as boolean) ?? true,
        includeNextTests: (data.includeNextTests as boolean) ?? true,
        includeReferral: (data.includeReferral as boolean) ?? true,
      },
      update: {
        enabled: data.enabled as boolean | undefined,
        includeInterpretation:
          data.includeInterpretation as boolean | undefined,
        includeDietAdvice: data.includeDietAdvice as boolean | undefined,
        includeExerciseAdvice:
          data.includeExerciseAdvice as boolean | undefined,
        includeNextTests: data.includeNextTests as boolean | undefined,
        includeReferral: data.includeReferral as boolean | undefined,
      },
    });
  }
}

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

@Injectable()
export class TestNotesService {
  private readonly logger = new Logger(TestNotesService.name);
  private anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ── Generate notes for ONE test ──
  async generateForTest(testCatalogId: string, tenantId: string) {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id: testCatalogId, tenantId },
      select: {
        name: true,
        code: true,
        sampleType: true,
        category: true,
        department: true,
        methodology: true,
      },
    });
    if (!test) throw new NotFoundException(`Test not found: ${testCatalogId}`);

    const prompt = `You are a senior clinical pathologist writing concise, evidence-based footnotes for a clinical laboratory report.

TEST DETAILS:
- Name: ${test.name}
- Sample Type: ${test.sampleType ?? "Not specified"}
- Category: ${test.category ?? ""}
- Department: ${test.department ?? ""}
- Methodology: ${test.methodology ?? "Standard automated analyser"}

Write brief, accurate clinical notes for the bottom of a patient's lab report.
These notes assist the referring physician in interpreting the result.

STRICT RULES:
1. Be specific and clinically accurate — not generic
2. Maximum 2-3 sentences per section
3. Professional medical English — appropriate for a physician
4. Do not recommend specific drugs or doses
5. Do not repeat information across sections
6. If a section genuinely does not apply, return null
7. Return ONLY valid JSON — no markdown, no preamble

Return this exact JSON:
{
  "highValueNote": "What elevated values may clinically indicate for ${test.name}. Mention 2-3 most common causes. Be specific.",
  "lowValueNote": "What reduced values may clinically indicate. Mention 2-3 most common causes. Return null if test has no meaningful low value.",
  "ageNote": "Clinically important paediatric, adult, or geriatric reference range differences. Return null if no significant age effect.",
  "pregnancyNote": "How pregnancy affects this test result or its interpretation. Return null if not applicable.",
  "generalNote": "Methodology note, sample stability, or important pre-analytical considerations.",
  "criticalValueNote": "Critical value thresholds requiring immediate clinical action. Return null if no universally defined critical values.",
  "interferenceNote": "Common interferences: haemolysis, lipaemia, specific drugs. Return null if no common interferences.",
  "fastingNote": "Fasting requirement and duration. Return null if fasting is not required."
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((c) => c.type === "text")
        .map((c) => ("text" in c ? c.text : ""))
        .join("");
      const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const data = JSON.parse(clean);

      return this.prisma.testNote.upsert({
        where: {
          tenantId_testCatalogId: { tenantId, testCatalogId },
        },
        create: {
          tenantId,
          testCatalogId,
          highValueNote: data.highValueNote ?? null,
          lowValueNote: data.lowValueNote ?? null,
          ageNote: data.ageNote ?? null,
          pregnancyNote: data.pregnancyNote ?? null,
          generalNote: data.generalNote ?? null,
          criticalValueNote: data.criticalValueNote ?? null,
          interferenceNote: data.interferenceNote ?? null,
          fastingNote: data.fastingNote ?? null,
          isGenerated: true,
          generatedAt: new Date(),
        },
        update: {
          highValueNote: data.highValueNote ?? null,
          lowValueNote: data.lowValueNote ?? null,
          ageNote: data.ageNote ?? null,
          pregnancyNote: data.pregnancyNote ?? null,
          generalNote: data.generalNote ?? null,
          criticalValueNote: data.criticalValueNote ?? null,
          interferenceNote: data.interferenceNote ?? null,
          fastingNote: data.fastingNote ?? null,
          isGenerated: true,
          generatedAt: new Date(),
        },
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to generate notes for ${test.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  // ── ONE-TIME: Generate notes for ALL tests in catalog ──
  // Returns immediately with stats; generation continues in background
  async generateAllNotes(
    tenantId: string,
  ): Promise<{ total: number; alreadyDone: number; queued: number }> {
    const tests = await this.prisma.testCatalog.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const existing = await this.prisma.testNote.findMany({
      where: { tenantId, isGenerated: true },
      select: { testCatalogId: true },
    });
    const doneIds = new Set(existing.map((n) => n.testCatalogId));
    const pending = tests.filter((t) => !doneIds.has(t.id));

    this.logger.log(
      `Generating notes for ${pending.length} tests (${doneIds.size} already done)`,
    );

    // Fire and forget — run in background
    this._runBatchGeneration(pending, tenantId).catch((e: unknown) =>
      this.logger.error(
        `Batch generation error: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );

    return {
      total: tests.length,
      alreadyDone: doneIds.size,
      queued: pending.length,
    };
  }

  private async _runBatchGeneration(
    tests: { id: string; name: string }[],
    tenantId: string,
  ) {
    let done = 0;
    let failed = 0;
    for (const test of tests) {
      try {
        await this.generateForTest(test.id, tenantId);
        done++;
        // Rate limit: ~40 req/min — safe for Anthropic
        await new Promise((r) => setTimeout(r, 1500));
        if (done % 10 === 0) {
          this.logger.log(
            `Test notes progress: ${done}/${tests.length} done, ${failed} failed`,
          );
        }
      } catch (err: unknown) {
        failed++;
        this.logger.warn(
          `Failed notes for ${test.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Back off on error
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    this.logger.log(
      `Test notes generation complete: ${done} done, ${failed} failed out of ${tests.length}`,
    );
  }

  // ── Get notes for a test ──
  async getNotes(testCatalogId: string, tenantId: string) {
    return this.prisma.testNote.findFirst({
      where: { testCatalogId, tenantId },
    });
  }

  // ── Get generation progress ──
  async getProgress(tenantId: string) {
    const [total, generated] = await Promise.all([
      this.prisma.testCatalog.count({ where: { tenantId } }),
      this.prisma.testNote.count({ where: { tenantId, isGenerated: true } }),
    ]);
    return {
      total,
      generated,
      pending: total - generated,
      percent: total > 0 ? Math.round((generated / total) * 100) : 0,
    };
  }

  // ── Manually edit notes ──
  async updateNotes(
    testCatalogId: string,
    tenantId: string,
    data: Record<string, unknown>,
  ) {
    return this.prisma.testNote.upsert({
      where: {
        tenantId_testCatalogId: { tenantId, testCatalogId },
      },
      create: {
        tenantId,
        testCatalogId,
        highValueNote: (data.highValueNote as string) ?? null,
        lowValueNote: (data.lowValueNote as string) ?? null,
        ageNote: (data.ageNote as string) ?? null,
        pregnancyNote: (data.pregnancyNote as string) ?? null,
        generalNote: (data.generalNote as string) ?? null,
        criticalValueNote: (data.criticalValueNote as string) ?? null,
        interferenceNote: (data.interferenceNote as string) ?? null,
        fastingNote: (data.fastingNote as string) ?? null,
      },
      update: {
        highValueNote: (data.highValueNote as string) ?? undefined,
        lowValueNote: (data.lowValueNote as string) ?? undefined,
        ageNote: (data.ageNote as string) ?? undefined,
        pregnancyNote: (data.pregnancyNote as string) ?? undefined,
        generalNote: (data.generalNote as string) ?? undefined,
        criticalValueNote: (data.criticalValueNote as string) ?? undefined,
        interferenceNote: (data.interferenceNote as string) ?? undefined,
        fastingNote: (data.fastingNote as string) ?? undefined,
      },
    });
  }
}

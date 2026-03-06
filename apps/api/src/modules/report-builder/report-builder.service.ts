import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

// ─── DTOs ─────────────────────────────────────
export interface CreateParameterDto {
  name: string;
  fieldType?: string;
  unit?: string;
  method?: string;
  defaultValue?: string;
  options?: string;
  formula?: string;
  isHighlighted?: boolean;
  isMandatory?: boolean;
  sortOrder?: number;
  referenceRanges?: {
    genderFilter?: string;
    ageMinYears?: number;
    ageMaxYears?: number;
    lowNormal?: number;
    highNormal?: number;
    lowCritical?: number;
    highCritical?: number;
    unit?: string;
    notes?: string;
  }[];
}

export interface UpdateParameterDto extends Partial<CreateParameterDto> {}

export interface UpdateSettingsDto {
  paperSize?: string;
  orientation?: string;
  fontFamily?: string;
  fontSize?: number;
  showMethod?: boolean;
  showUnit?: boolean;
  showRefRange?: boolean;
  showPrevResult?: boolean;
  showInterpretation?: boolean;
  interpretationTemplate?: string;
  footerNotes?: string;
  supplementary?: string;
}

export interface ReorderDto {
  parameterIds: string[];
}

@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  // ─── PARAMETERS ──────────────────────────────

  async getParameters(testCatalogId: string, tenantId: string) {
    await this.ensureTestExists(testCatalogId, tenantId);

    return this.prisma.reportParameter.findMany({
      where: { testCatalogId, tenantId },
      include: { referenceRanges: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createParameter(
    testCatalogId: string,
    tenantId: string,
    dto: CreateParameterDto,
  ) {
    await this.ensureTestExists(testCatalogId, tenantId);

    const maxOrder = await this.prisma.reportParameter.aggregate({
      where: { testCatalogId, tenantId },
      _max: { sortOrder: true },
    });

    const param = await this.prisma.reportParameter.create({
      data: {
        tenantId,
        testCatalogId,
        name: dto.name,
        fieldType: dto.fieldType ?? "NUMERIC",
        unit: dto.unit,
        method: dto.method,
        defaultValue: dto.defaultValue,
        options: dto.options,
        formula: dto.formula,
        isHighlighted: dto.isHighlighted ?? false,
        isMandatory: dto.isMandatory ?? true,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    // Create reference ranges if provided
    if (dto.referenceRanges?.length) {
      await this.prisma.referenceRange.createMany({
        data: dto.referenceRanges.map((rr) => ({
          tenantId,
          testCatalogId,
          reportParameterId: param.id,
          genderFilter: rr.genderFilter,
          ageMinYears: rr.ageMinYears,
          ageMaxYears: rr.ageMaxYears,
          lowNormal: rr.lowNormal,
          highNormal: rr.highNormal,
          lowCritical: rr.lowCritical,
          highCritical: rr.highCritical,
          unit: rr.unit ?? dto.unit,
          notes: rr.notes,
        })),
      });
    }

    return this.prisma.reportParameter.findUnique({
      where: { id: param.id },
      include: { referenceRanges: true },
    });
  }

  async updateParameter(
    parameterId: string,
    tenantId: string,
    dto: UpdateParameterDto,
  ) {
    const existing = await this.prisma.reportParameter.findFirst({
      where: { id: parameterId, tenantId },
    });
    if (!existing) throw new NotFoundException("Parameter not found");

    const { referenceRanges, ...paramData } = dto;

    const updated = await this.prisma.reportParameter.update({
      where: { id: parameterId },
      data: paramData,
    });

    // Replace reference ranges if provided
    if (referenceRanges !== undefined) {
      await this.prisma.referenceRange.deleteMany({
        where: { reportParameterId: parameterId },
      });

      if (referenceRanges.length) {
        await this.prisma.referenceRange.createMany({
          data: referenceRanges.map((rr) => ({
            tenantId,
            testCatalogId: existing.testCatalogId,
            reportParameterId: parameterId,
            genderFilter: rr.genderFilter,
            ageMinYears: rr.ageMinYears,
            ageMaxYears: rr.ageMaxYears,
            lowNormal: rr.lowNormal,
            highNormal: rr.highNormal,
            lowCritical: rr.lowCritical,
            highCritical: rr.highCritical,
            unit: rr.unit ?? dto.unit,
            notes: rr.notes,
          })),
        });
      }
    }

    return this.prisma.reportParameter.findUnique({
      where: { id: updated.id },
      include: { referenceRanges: true },
    });
  }

  async deleteParameter(parameterId: string, tenantId: string) {
    const existing = await this.prisma.reportParameter.findFirst({
      where: { id: parameterId, tenantId },
    });
    if (!existing) throw new NotFoundException("Parameter not found");

    await this.prisma.referenceRange.deleteMany({
      where: { reportParameterId: parameterId },
    });

    await this.prisma.reportParameter.delete({
      where: { id: parameterId },
    });

    return { deleted: true };
  }

  async reorderParameters(
    testCatalogId: string,
    tenantId: string,
    dto: ReorderDto,
  ) {
    await this.ensureTestExists(testCatalogId, tenantId);

    const updates = dto.parameterIds.map((id, index) =>
      this.prisma.reportParameter.updateMany({
        where: { id, tenantId, testCatalogId },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return this.getParameters(testCatalogId, tenantId);
  }

  async bulkCreateParameters(
    testCatalogId: string,
    tenantId: string,
    parameters: CreateParameterDto[],
  ) {
    await this.ensureTestExists(testCatalogId, tenantId);

    const results = [];
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i]!;
      const param = await this.createParameter(testCatalogId, tenantId, {
        ...p,
        sortOrder: i,
      });
      results.push(param);
    }

    return results;
  }

  // ─── SETTINGS ────────────────────────────────

  async getSettings(testCatalogId: string, tenantId: string) {
    await this.ensureTestExists(testCatalogId, tenantId);

    let settings = await this.prisma.reportSetting.findUnique({
      where: { testCatalogId },
    });

    if (!settings) {
      settings = await this.prisma.reportSetting.create({
        data: { tenantId, testCatalogId },
      });
    }

    return settings;
  }

  async updateSettings(
    testCatalogId: string,
    tenantId: string,
    dto: UpdateSettingsDto,
  ) {
    await this.ensureTestExists(testCatalogId, tenantId);

    return this.prisma.reportSetting.upsert({
      where: { testCatalogId },
      create: { tenantId, testCatalogId, ...dto },
      update: dto,
    });
  }

  // ─── AI AUTO-FILL ────────────────────────────

  async autoFillParameters(testCatalogId: string, tenantId: string) {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id: testCatalogId, tenantId },
      select: {
        name: true,
        code: true,
        category: true,
        department: true,
        methodology: true,
        sampleType: true,
      },
    });
    if (!test) throw new NotFoundException("Test not found");

    const systemPrompt = `You are a clinical laboratory expert. Given a lab test, return a JSON array of report parameters with reference ranges.
Each parameter object must have:
- name: string (parameter name)
- fieldType: "NUMERIC" | "TEXT" | "OPTION"
- unit: string | null
- method: string | null
- referenceRanges: array of { genderFilter: "ALL" | "MALE" | "FEMALE", ageMinYears: number | null, ageMaxYears: number | null, lowNormal: number | null, highNormal: number | null, unit: string | null }

Return ONLY valid JSON array, no markdown, no explanation.`;

    const userMessage = `Generate report parameters for: ${test.name} (${test.code})
Category: ${test.category}
Department: ${test.department}
Methodology: ${test.methodology ?? "N/A"}
Sample Type: ${test.sampleType ?? "N/A"}`;

    try {
      const aiResponse = await this.aiService.complete(
        systemPrompt,
        userMessage,
        4000,
      );

      let parsed: CreateParameterDto[];
      try {
        // Extract JSON from possible markdown code blocks
        let jsonStr = aiResponse.text.trim();
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch?.[1]) {
          jsonStr = codeBlockMatch[1].trim();
        }
        parsed = JSON.parse(jsonStr);
      } catch {
        this.logger.warn(
          `Failed to parse AI response for test ${testCatalogId}`,
        );
        throw new BadRequestException(
          "AI returned invalid format. Please try again.",
        );
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new BadRequestException("AI returned no parameters.");
      }

      return parsed
        .filter((p) => p.name)
        .map((p, i) => ({
          name: p.name,
          fieldType: p.fieldType ?? "NUMERIC",
          unit: p.unit ?? null,
          method: p.method ?? null,
          sortOrder: i,
          referenceRanges: (p.referenceRanges ?? []).map((rr) => ({
            genderFilter: rr.genderFilter ?? "ALL",
            ageMinYears: rr.ageMinYears ?? null,
            ageMaxYears: rr.ageMaxYears ?? null,
            lowNormal: rr.lowNormal ?? null,
            highNormal: rr.highNormal ?? null,
            unit: rr.unit ?? p.unit ?? null,
          })),
        }));
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI auto-fill failed: ${errMsg}`, err instanceof Error ? err.stack : undefined);
      throw new BadRequestException(
        `AI auto-fill failed: ${errMsg}`,
      );
    }
  }

  // ─── PREVIEW ─────────────────────────────────

  async getPreviewHtml(testCatalogId: string, tenantId: string) {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id: testCatalogId, tenantId },
      select: { name: true, code: true, category: true, department: true },
    });
    if (!test) throw new NotFoundException("Test not found");

    const parameters = await this.getParameters(testCatalogId, tenantId);
    const settings = await this.getSettings(testCatalogId, tenantId);

    return this.renderPreviewHtml(test, parameters, settings);
  }

  private renderPreviewHtml(
    test: { name: string; code: string; category: string; department: string },
    parameters: Array<{
      name: string;
      fieldType: string;
      unit: string | null;
      method: string | null;
      isHighlighted: boolean;
      referenceRanges: Array<{
        lowNormal: number | null;
        highNormal: number | null;
        unit: string | null;
        genderFilter: string | null;
      }>;
    }>,
    settings: {
      fontFamily: string;
      fontSize: number;
      showMethod: boolean;
      showUnit: boolean;
      showRefRange: boolean;
      footerNotes: string | null;
      supplementary: string | null;
    },
  ): string {
    const paramRows = parameters
      .map((p) => {
        const range = p.referenceRanges[0];
        const refStr =
          settings.showRefRange && range
            ? `${range.lowNormal ?? ""} - ${range.highNormal ?? ""}`
            : "";
        const unitStr = settings.showUnit ? (p.unit ?? "") : "";
        const methodStr = settings.showMethod ? (p.method ?? "") : "";

        if (p.fieldType === "HEADING") {
          return `<tr class="heading-row"><td colspan="5" style="font-weight:bold;background:#f0f4f8;padding:8px;">${p.name}</td></tr>`;
        }
        if (p.fieldType === "NOTE") {
          return `<tr class="note-row"><td colspan="5" style="font-style:italic;color:#666;padding:6px 8px;">${p.name}</td></tr>`;
        }

        return `<tr${p.isHighlighted ? ' style="font-weight:bold"' : ""}>
          <td style="padding:6px 8px;">${p.name}</td>
          <td style="padding:6px 8px;text-align:center;">—</td>
          <td style="padding:6px 8px;text-align:center;">${unitStr}</td>
          <td style="padding:6px 8px;text-align:center;">${refStr}</td>
          <td style="padding:6px 8px;text-align:center;">${methodStr}</td>
        </tr>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${settings.fontFamily}, sans-serif; font-size: ${settings.fontSize}px; margin: 0; padding: 24px; color: #1a1a1a; }
    .header { text-align: center; border-bottom: 2px solid #0D7E8A; padding-bottom: 12px; margin-bottom: 16px; }
    .header h2 { margin: 0; color: #0D7E8A; }
    .header p { margin: 4px 0; color: #666; font-size: 0.9em; }
    .patient-info { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 0.85em; }
    .patient-info div { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { background: #0D7E8A; color: white; padding: 8px; text-align: left; font-size: 0.85em; }
    tbody td { border-bottom: 1px solid #e5e7eb; }
    .footer { margin-top: 16px; font-size: 0.8em; color: #666; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${test.name}</h2>
    <p>${test.code} | ${test.category} | ${test.department}</p>
  </div>

  <div class="patient-info">
    <div><strong>Patient:</strong> John Doe (M, 35y)</div>
    <div><strong>MRN:</strong> DH-2026-000001</div>
    <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Parameter</th>
        <th style="text-align:center;">Result</th>
        <th style="text-align:center;">Unit</th>
        <th style="text-align:center;">Reference Range</th>
        <th style="text-align:center;">Method</th>
      </tr>
    </thead>
    <tbody>
      ${paramRows}
    </tbody>
  </table>

  ${settings.footerNotes ? `<div class="footer"><strong>Notes:</strong> ${settings.footerNotes}</div>` : ""}
  ${settings.supplementary ? `<div class="footer"><strong>Supplementary:</strong> ${settings.supplementary}</div>` : ""}
</body>
</html>`;
  }

  // ─── HELPERS ─────────────────────────────────

  private async ensureTestExists(testCatalogId: string, tenantId: string) {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id: testCatalogId, tenantId },
    });
    if (!test) throw new NotFoundException("Test not found");
    return test;
  }
}

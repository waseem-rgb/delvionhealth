import {
  Injectable,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";

@Injectable()
export class BulkRegistrationService {
  private readonly logger = new Logger(BulkRegistrationService.name);
  private anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // ── Parse uploaded Excel ──
  parseExcel(buffer: Buffer): Record<string, unknown>[] {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException("Empty workbook");
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new BadRequestException("Empty sheet");
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });
    if (!rows.length) throw new BadRequestException("No data rows found");
    return rows;
  }

  // ── Normalise rows using Anthropic ──
  async normaliseRows(
    rawRows: Record<string, unknown>[],
    tenantId: string,
    fileName: string,
    uploadedById?: string,
  ): Promise<{ jobId: string }> {
    const catalog = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, code: true, sampleType: true },
      take: 2000,
    });

    const catalogList = catalog
      .map(
        (t) =>
          `ID:${t.id} | ${t.name} (${t.code ?? ""}) [${t.sampleType ?? ""}]`,
      )
      .join("\n");

    const job = await this.prisma.bulkRegistrationJob.create({
      data: {
        tenantId,
        fileName,
        status: "NORMALISING",
        totalRows: rawRows.length,
        uploadedById,
      },
    });

    // Process in batches of 20
    const BATCH_SIZE = 20;
    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
      const batch = rawRows.slice(i, i + BATCH_SIZE);
      await this._normaliseBatch(batch, i, job.id, tenantId, catalogList);
    }

    await this.prisma.bulkRegistrationJob.update({
      where: { id: job.id },
      data: { status: "PREVIEW" },
    });

    return { jobId: job.id };
  }

  private async _normaliseBatch(
    rows: Record<string, unknown>[],
    startIdx: number,
    jobId: string,
    tenantId: string,
    catalogList: string,
  ) {
    const prompt = `You are a lab information system. Normalise the following patient registration rows.

Available test catalog (ID | name (code) [sampleType]):
${catalogList}

For each row, map the test names in the "Tests" column (comma-separated) to the CLOSEST matching test in the catalog.
Also determine the correct tube type for each test: EDTA | SERUM | NPS | URINE | STOOL | CSF | SPUTUM | OTHER
If the row has Barcode_EDTA, Barcode_SERUM, Barcode_NPS, Barcode_URINE, Barcode_STOOL, Barcode_CSF, or Barcode_SPUTUM columns with values, include them in the "barcodes" field.

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "rowIndex": 0,
    "name": "normalised patient name (Title Case)",
    "age": 34,
    "ageUnit": "Y",
    "gender": "MALE",
    "phone": "normalised phone",
    "email": "email or empty string",
    "address": "address or empty string",
    "referringDoctor": "doctor name or empty string",
    "organisation": "org name or empty string",
    "notes": "any notes",
    "tests": [
      {
        "original": "CBC",
        "matched": "Complete Blood Count (CBC)",
        "catalogId": "CATALOG_ID_FROM_ABOVE",
        "tube": "EDTA",
        "confidence": 0.98,
        "status": "MATCHED"
      }
    ],
    "tubes": ["EDTA", "SERUM"],
    "barcodes": {
      "EDTA": "value from Barcode_EDTA column, or empty string",
      "SERUM": "value from Barcode_SERUM column, or empty string",
      "NPS": "value from Barcode_NPS column, or empty string",
      "URINE": "value from Barcode_URINE column, or empty string",
      "STOOL": "value from Barcode_STOOL column, or empty string",
      "CSF": "value from Barcode_CSF column, or empty string",
      "SPUTUM": "value from Barcode_SPUTUM column, or empty string"
    }
  }
]

status must be: MATCHED (exact/close match) | PARTIAL (possible match) | UNMATCHED (no match)
If ambiguous between multiple catalog entries, pick the most likely and set status=PARTIAL.
If completely unrecognisable, set status=UNMATCHED and leave catalogId empty.

Input rows:
${JSON.stringify(rows.map((r, i) => ({ rowIndex: startIdx + i, ...r })), null, 2)}`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
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
      const parsed = JSON.parse(clean) as Array<Record<string, unknown>>;

      for (let j = 0; j < rows.length; j++) {
        const norm =
          parsed.find(
            (p) => (p.rowIndex as number) === startIdx + j,
          ) ?? null;
        const tests = (norm?.tests as Array<Record<string, unknown>>) ?? [];
        const hasUnmatched = tests.some(
          (t) => t.status === "UNMATCHED",
        );
        await this.prisma.bulkRegistrationRow.create({
          data: {
            jobId,
            rowNumber: startIdx + j + 1,
            rawData: rows[j] as object,
            normalisedData: norm ? (norm as object) : undefined,
            status: hasUnmatched
              ? "PARTIAL_MATCH"
              : norm
                ? "MATCHED"
                : "UNMATCHED",
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Normalisation batch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      for (let j = 0; j < rows.length; j++) {
        await this.prisma.bulkRegistrationRow.create({
          data: {
            jobId,
            rowNumber: startIdx + j + 1,
            rawData: rows[j] as object,
            status: "UNMATCHED",
            errorMsg: "Normalisation failed — please verify manually",
          },
        });
      }
    }
  }

  // ── Get job preview ──
  async getJobPreview(jobId: string, tenantId: string) {
    const job = await this.prisma.bulkRegistrationJob.findFirst({
      where: { id: jobId, tenantId },
      include: { rows: { orderBy: { rowNumber: "asc" } } },
    });
    if (!job) throw new BadRequestException("Job not found");

    const matched = job.rows.filter((r) => r.status === "MATCHED").length;
    const partial = job.rows.filter(
      (r) => r.status === "PARTIAL_MATCH",
    ).length;
    const unmatched = job.rows.filter((r) => r.status === "UNMATCHED").length;

    return { job, matched, partial, unmatched };
  }

  // ── Update a specific row (staff correction) ──
  async updateRow(
    rowId: string,
    normalisedData: Record<string, unknown>,
  ) {
    return this.prisma.bulkRegistrationRow.update({
      where: { id: rowId },
      data: { normalisedData: normalisedData as object, status: "MATCHED" },
    });
  }

  // ── Register all matched rows as orders ──
  async registerAll(
    jobId: string,
    tenantId: string,
    userId: string,
    branchId: string,
    skipUnmatched = true,
    organisationId?: string,
  ) {
    const statusFilter = skipUnmatched
      ? { in: ["MATCHED", "PARTIAL_MATCH"] }
      : undefined;

    const rows = await this.prisma.bulkRegistrationRow.findMany({
      where: { jobId, status: statusFilter },
      orderBy: { rowNumber: "asc" },
    });

    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const d = row.normalisedData as Record<string, unknown> | null;
        if (!d?.name) {
          failed++;
          continue;
        }
        const tests = (d.tests as Array<Record<string, unknown>>) ?? [];
        const matchedTests = tests.filter((t) => t.catalogId);
        if (!matchedTests.length) {
          failed++;
          continue;
        }

        // Find or create patient
        const patientName = String(d.name);
        const nameParts = patientName.split(" ");
        const firstName = nameParts[0] ?? patientName;
        const lastName = nameParts.slice(1).join(" ") || "-";
        const phone = String(d.phone || "0000000000");
        const gender = String(d.gender || "MALE").toUpperCase();
        const age = Number(d.age) || 30;
        const dob = new Date();
        dob.setFullYear(dob.getFullYear() - age);

        let patient = await this.prisma.patient.findFirst({
          where: { tenantId, phone, firstName },
        });

        if (!patient) {
          const count = await this.prisma.patient.count({
            where: { tenantId },
          });
          const mrn = `DH-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
          patient = await this.prisma.patient.create({
            data: {
              tenantId,
              branchId,
              mrn,
              firstName,
              lastName,
              dob,
              gender,
              phone,
              email: d.email ? String(d.email) : null,
              address: d.address ? String(d.address) : null,
            },
          });
        }

        // Generate order number
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const dayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const orderCount = await this.prisma.order.count({
          where: { tenantId, createdAt: { gte: dayStart } },
        });
        const orderNumber = `DH-ORD-${dateStr}-${String(orderCount + 1).padStart(4, "0")}`;

        // Build order items
        const orderItemsData = matchedTests.map((t) => ({
          testCatalogId: String(t.catalogId),
          price: 0,
          quantity: 1,
        }));

        const order = await this.prisma.order.create({
          data: {
            tenantId,
            branchId,
            orderNumber,
            patientId: patient.id,
            organizationId: organisationId ?? null,
            status: "PENDING",
            priority: "ROUTINE",
            collectionType: "WALK_IN",
            createdById: userId,
            items: { create: orderItemsData },
          },
        });

        await this.prisma.bulkRegistrationRow.update({
          where: { id: row.id },
          data: { status: "REGISTERED", orderId: order.id },
        });
        processed++;
      } catch (err) {
        await this.prisma.bulkRegistrationRow.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            errorMsg:
              err instanceof Error ? err.message : "Unknown error",
          },
        });
        failed++;
      }
    }

    await this.prisma.bulkRegistrationJob.update({
      where: { id: jobId },
      data: { status: "DONE", processed, failed },
    });

    return { processed, failed, total: rows.length };
  }

  // ── Get template columns ──
  getTemplateColumns() {
    return {
      columns: [
        { key: "Name", required: true, example: "John Doe" },
        { key: "Age", required: true, example: "34" },
        { key: "Gender", required: true, example: "Male/Female/Other" },
        { key: "Tests", required: true, example: "CBC, TSH, LFT" },
        { key: "Phone", required: false, example: "9876543210" },
        { key: "Email", required: false, example: "john@example.com" },
        { key: "Address", required: false, example: "123 Main St" },
        { key: "ReferringDoctor", required: false, example: "Dr. Sharma" },
        { key: "Notes", required: false, example: "Fasting sample" },
        { key: "Barcode_EDTA", required: false, example: "ED123456" },
        { key: "Barcode_SERUM", required: false, example: "SR123456" },
        { key: "Barcode_NPS", required: false, example: "" },
        { key: "Barcode_URINE", required: false, example: "" },
        { key: "Barcode_STOOL", required: false, example: "" },
        { key: "Barcode_CSF", required: false, example: "" },
        { key: "Barcode_SPUTUM", required: false, example: "" },
      ],
    };
  }
}

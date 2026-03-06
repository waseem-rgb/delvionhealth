import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ResultsService } from "./results.service";
import { ResultInterpretation } from "@delvion/types";

/** Minimal type shim for the xlsx package (loaded at runtime via require) */
interface XLSXLib {
  utils: {
    json_to_sheet(data: unknown[]): Record<string, unknown>;
    sheet_to_json<T>(sheet: Record<string, unknown>): T[];
    book_new(): Record<string, unknown>;
    book_append_sheet(wb: Record<string, unknown>, ws: Record<string, unknown>, name: string): void;
  };
  read(data: Buffer, opts: { type: string }): { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> };
  write(wb: Record<string, unknown>, opts: { type: string; bookType: string }): Buffer;
}

/** Lazily load xlsx package at runtime */
function loadXLSX(): XLSXLib {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("xlsx") as XLSXLib;
  } catch {
    throw new BadRequestException(
      "xlsx package is not installed. Run: npm install xlsx --save in apps/api",
    );
  }
}

export interface BulkResultSummary {
  saved: number;
  failed: number;
  critical: number;
  errors: Array<{ row: number; orderNumber: string; testName: string; error: string }>;
}

@Injectable()
export class BulkResultService {
  private readonly logger = new Logger(BulkResultService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resultsService: ResultsService,
  ) {}

  // ── Generate Excel Template ───────────────────────────────────────────────

  async generateTemplate(tenantId: string, orderIds: string[]): Promise<Buffer> {
    const XLSX = loadXLSX();

    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestException("At least one orderId is required");
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, tenantId },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true, dob: true, gender: true } },
        items: {
          include: {
            testCatalog: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        samples: { take: 1, select: { id: true } },
      },
      orderBy: { orderNumber: "asc" },
    });

    if (orders.length === 0) {
      throw new NotFoundException("No orders found for the given IDs");
    }

    // Build template rows
    const rows: Array<Record<string, string>> = [];

    for (const order of orders) {
      const patientName = `${order.patient.firstName} ${order.patient.lastName}`;
      const ageYears = Math.floor(
        (Date.now() - new Date(order.patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      );
      const gender = order.patient.gender.toUpperCase();

      for (const item of order.items) {
        // Look up reference range
        const refRange = await this.prisma.referenceRange.findFirst({
          where: { tenantId, testCatalogId: item.testCatalogId },
          orderBy: [
            { genderFilter: "asc" }, // gender-specific first
          ],
        });

        const refStr = refRange
          ? `${refRange.lowNormal ?? ""} - ${refRange.highNormal ?? ""}`
          : "";
        const unit = refRange?.unit ?? "";

        rows.push({
          "Order #": order.orderNumber,
          "Patient Name": patientName,
          "Patient MRN": order.patient.mrn,
          "Gender": gender,
          "Age": String(ageYears),
          "Test Name": item.testCatalog.name,
          "Test Code": item.testCatalog.code ?? "",
          "Parameter": item.testCatalog.name,
          "Unit": unit,
          "Reference Range": refStr,
          "VALUE": "",
        });
      }
    }

    // Sheet 1: Results Entry
    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws["!cols"] = [
      { wch: 22 }, // Order #
      { wch: 25 }, // Patient Name
      { wch: 18 }, // Patient MRN
      { wch: 8 },  // Gender
      { wch: 5 },  // Age
      { wch: 30 }, // Test Name
      { wch: 12 }, // Test Code
      { wch: 30 }, // Parameter
      { wch: 12 }, // Unit
      { wch: 20 }, // Reference Range
      { wch: 15 }, // VALUE
    ];

    // Sheet 2: Instructions
    const instructions = [
      { Step: "1", Instruction: "Fill in the VALUE column for each test row." },
      { Step: "2", Instruction: "Do NOT modify Order #, Patient Name, Test Name, or Parameter columns." },
      { Step: "3", Instruction: "Enter numeric values where applicable (e.g., 12.5, 140)." },
      { Step: "4", Instruction: "For non-numeric results, enter the text value (e.g., 'Positive', 'Reactive')." },
      { Step: "5", Instruction: "Leave VALUE empty to skip a row." },
      { Step: "6", Instruction: "Save the file and upload it back to the system." },
      { Step: "7", Instruction: "Critical values will be automatically flagged." },
      { Step: "8", Instruction: "Results are saved as DRAFT and will need verification." },
    ];
    const wsInst = XLSX.utils.json_to_sheet(instructions);
    wsInst["!cols"] = [{ wch: 6 }, { wch: 80 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results Entry");
    XLSX.utils.book_append_sheet(wb, wsInst, "Instructions");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return buffer;
  }

  // ── Parse and Save Results ────────────────────────────────────────────────

  async parseAndSave(
    tenantId: string,
    file: Buffer,
    actorId: string,
  ): Promise<BulkResultSummary> {
    const XLSX = loadXLSX();

    const wb = XLSX.read(file, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Excel file has no sheets");
    }

    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      throw new BadRequestException("Could not read the first sheet");
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    if (rows.length === 0) {
      throw new BadRequestException("No data rows found in the Excel file");
    }

    const summary: BulkResultSummary = {
      saved: 0,
      failed: 0,
      critical: 0,
      errors: [],
    };

    // Cache for order lookups
    const orderCache = new Map<
      string,
      {
        id: string;
        patientId: string;
        items: Array<{
          id: string;
          testCatalogId: string;
          testCatalog: { id: string; name: string };
        }>;
        samples: Array<{ id: string }>;
      }
    >();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2; // 1-based + header row
      const orderNumber = (row["Order #"] ?? "").trim();
      const testName = (row["Test Name"] ?? row["Parameter"] ?? "").trim();
      const value = (row["VALUE"] ?? "").trim();

      // Skip empty value rows
      if (!value) continue;

      if (!orderNumber) {
        summary.failed++;
        summary.errors.push({
          row: rowNum,
          orderNumber: "",
          testName,
          error: "Missing Order #",
        });
        continue;
      }

      try {
        // Lookup order (with caching)
        let order = orderCache.get(orderNumber);
        if (!order) {
          const dbOrder = await this.prisma.order.findFirst({
            where: { orderNumber, tenantId },
            include: {
              items: {
                include: {
                  testCatalog: { select: { id: true, name: true } },
                },
              },
              samples: { take: 1, select: { id: true } },
            },
          });

          if (!dbOrder) {
            summary.failed++;
            summary.errors.push({
              row: rowNum,
              orderNumber,
              testName,
              error: `Order '${orderNumber}' not found`,
            });
            continue;
          }

          order = {
            id: dbOrder.id,
            patientId: dbOrder.patientId,
            items: dbOrder.items.map((it) => ({
              id: it.id,
              testCatalogId: it.testCatalogId,
              testCatalog: it.testCatalog,
            })),
            samples: dbOrder.samples,
          };
          orderCache.set(orderNumber, order);
        }

        // Find matching order item by test name (case-insensitive)
        const matchedItem = order.items.find(
          (item) =>
            item.testCatalog.name.toLowerCase() === testName.toLowerCase(),
        );

        if (!matchedItem) {
          summary.failed++;
          summary.errors.push({
            row: rowNum,
            orderNumber,
            testName,
            error: `Test '${testName}' not found in order ${orderNumber}`,
          });
          continue;
        }

        const sampleId = order.samples[0]?.id;
        if (!sampleId) {
          summary.failed++;
          summary.errors.push({
            row: rowNum,
            orderNumber,
            testName,
            error: `No sample found for order ${orderNumber}`,
          });
          continue;
        }

        // Check if result already exists for this order item
        const existingResult = await this.prisma.testResult.findFirst({
          where: {
            tenantId,
            orderItemId: matchedItem.id,
          },
        });

        if (existingResult) {
          // Update existing result instead of creating duplicate
          const numericValue = parseFloat(value);
          const isNumeric = !isNaN(numericValue);

          await this.prisma.testResult.update({
            where: { id: existingResult.id },
            data: {
              value,
              numericValue: isNumeric ? numericValue : null,
              isDraft: true,
              enteredById: actorId,
            },
          });

          if (
            (existingResult.interpretation as string) === ResultInterpretation.CRITICAL
          ) {
            summary.critical++;
          }

          summary.saved++;
          continue;
        }

        // Create new result using ResultsService for full interpretation + delta logic
        const unit = (row["Unit"] ?? "").trim() || undefined;
        const numericValue = parseFloat(value);
        const isNumeric = !isNaN(numericValue);

        const result = await this.resultsService.create(
          {
            orderItemId: matchedItem.id,
            sampleId,
            value,
            numericValue: isNumeric ? numericValue : undefined,
            unit,
            isDraft: true,
          },
          tenantId,
          actorId,
        );

        summary.saved++;

        if ((result.interpretation as string) === ResultInterpretation.CRITICAL) {
          summary.critical++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push({
          row: rowNum,
          orderNumber,
          testName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Bulk result upload: saved=${summary.saved}, failed=${summary.failed}, critical=${summary.critical}`,
    );

    return summary;
  }
}

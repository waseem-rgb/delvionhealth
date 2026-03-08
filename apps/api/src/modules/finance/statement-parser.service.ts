import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NarrationEngineService } from "./narration-engine.service";

interface ParsedRow {
  txnDate: Date;
  valueDate: Date | null;
  narration: string;
  chqRefNo: string | null;
  debitAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
}

function parseAmount(str: string): number {
  if (!str || str === "-" || str.trim() === "") return 0;
  const cleaned = str.replace(/[₹,\s]/g, "").replace(/\(([^)]+)\)/, "-$1");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseFlexibleDate(str: string): Date | null {
  if (!str || str.trim() === "") return null;
  const trimmed = str.trim();

  // Try YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const parts = trimmed.split(/[/\-.]/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  let dd = parts[0]!;
  let mm = parts[1]!;
  let yy = parts[2]!;
  if (yy < 100) yy += 2000;
  const date = new Date(yy, mm - 1, dd);
  return isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class StatementParserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly narrationEngine: NarrationEngineService,
  ) {}

  async parseFile(buffer: Buffer, fileType: string): Promise<ParsedRow[]> {
    if (fileType === "CSV" || fileType === "EXCEL") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as string[][];
      return this.detectAndParse(rows);
    }
    throw new BadRequestException(`Unsupported file type: ${fileType}. Use CSV or Excel.`);
  }

  private detectAndParse(rows: string[][]): ParsedRow[] {
    let headerRowIndex = -1;
    const columnMap: Record<string, number> = {};

    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = (rows[i] ?? []).map((c) => String(c ?? "").toUpperCase());
      const hasDate = row.some((c) => c.includes("DATE"));
      const hasAmount = row.some(
        (c) => c.includes("DEBIT") || c.includes("WITHDRAWAL") || c.includes("AMOUNT") || c.includes("DR")
      );

      if (hasDate && hasAmount) {
        headerRowIndex = i;
        row.forEach((col, idx) => {
          if ((col.includes("DATE") && !col.includes("VALUE")) || col === "TXN DATE" || col === "TRANSACTION DATE") {
            columnMap.date = idx;
          }
          if (col.includes("VALUE DATE") || col === "VALUE DT") {
            columnMap.valueDate = idx;
          }
          if (
            col.includes("NARRATION") ||
            col.includes("DESCRIPTION") ||
            col.includes("PARTICULARS") ||
            col.includes("DETAILS")
          ) {
            columnMap.narration = idx;
          }
          if (col.includes("CHQ") || col.includes("REF") || col.includes("CHEQUE")) {
            columnMap.chqRef = idx;
          }
          if (col.includes("DEBIT") || col.includes("WITHDRAWAL") || col === "DR") {
            columnMap.debit = idx;
          }
          if (col.includes("CREDIT") || col.includes("DEPOSIT") || col === "CR") {
            columnMap.credit = idx;
          }
          if (col.includes("BALANCE") || col.includes("BAL")) {
            columnMap.balance = idx;
          }
        });
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException(
        "Could not detect header row. Ensure the file has Date, Narration, Debit, Credit columns."
      );
    }

    // If narration column not found, try to find any text column
    if (columnMap.narration === undefined) {
      const firstDataRow = rows[headerRowIndex + 1];
      if (firstDataRow) {
        for (let i = 0; i < firstDataRow.length; i++) {
          if (i !== columnMap.date && i !== columnMap.debit && i !== columnMap.credit && i !== columnMap.balance) {
            columnMap.narration = i;
            break;
          }
        }
      }
    }

    const parsed: ParsedRow[] = [];
    const dataRows = rows.slice(headerRowIndex + 1);

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const dateIdx = columnMap.date ?? 0;
      const dateStr = String(row[dateIdx] ?? "").trim();
      if (!dateStr) continue;
      const lc = dateStr.toLowerCase();
      if (lc.includes("opening") || lc.includes("closing") || lc.includes("total")) continue;

      const txnDate = parseFlexibleDate(dateStr);
      if (!txnDate) continue;

      const debit = parseAmount(String(row[columnMap.debit ?? 0] ?? ""));
      const credit = parseAmount(String(row[columnMap.credit ?? 0] ?? ""));
      if (debit === 0 && credit === 0) continue;

      parsed.push({
        txnDate,
        valueDate: columnMap.valueDate !== undefined ? parseFlexibleDate(String(row[columnMap.valueDate] ?? "")) : null,
        narration: String(row[columnMap.narration ?? 1] ?? "").trim(),
        chqRefNo: columnMap.chqRef !== undefined ? String(row[columnMap.chqRef] ?? "").trim() || null : null,
        debitAmount: debit > 0 ? debit : null,
        creditAmount: credit > 0 ? credit : null,
        balance: columnMap.balance !== undefined ? parseAmount(String(row[columnMap.balance] ?? "")) || null : null,
      });
    }

    return parsed;
  }

  async processUpload(
    tenantId: string,
    bankAccountId: string,
    statementId: string,
    parsedRows: ParsedRow[],
  ) {
    let matched = 0;
    let suspense = 0;

    for (const row of parsedRows) {
      const matchResult = await this.narrationEngine.matchNarration(tenantId, row.narration);

      // Duplicate check
      const existing = await this.prisma.bankTransaction.findFirst({
        where: {
          tenantId,
          bankAccountId,
          txnDate: row.txnDate,
          narration: row.narration,
          debitAmount: row.debitAmount,
          creditAmount: row.creditAmount,
        },
      });

      await this.prisma.bankTransaction.create({
        data: {
          tenantId,
          bankAccountId,
          statementId,
          txnDate: row.txnDate,
          valueDate: row.valueDate,
          narration: row.narration,
          chqRefNo: row.chqRefNo,
          debitAmount: row.debitAmount,
          creditAmount: row.creditAmount,
          balance: row.balance,
          category: matchResult.category,
          subCategory: matchResult.subCategory,
          description: matchResult.description,
          matchType: matchResult.matchType,
          isDuplicate: !!existing,
          isPosted: false,
        },
      });

      if (matchResult.matchType === "AUTO_MATCHED") matched++;
      else suspense++;
    }

    const totals = parsedRows.reduce(
      (acc, r) => ({
        credits: acc.credits + (r.creditAmount ?? 0),
        debits: acc.debits + (r.debitAmount ?? 0),
      }),
      { credits: 0, debits: 0 }
    );

    // Update the BankStatement row (old model) — store summary
    // We use the existing BankStatement to track the upload
    return { total: parsedRows.length, matched, suspense, totalCredits: totals.credits, totalDebits: totals.debits };
  }
}

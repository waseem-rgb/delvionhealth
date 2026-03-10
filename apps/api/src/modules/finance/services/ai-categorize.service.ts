import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class AiCategorizeService {
  private readonly logger = new Logger(AiCategorizeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async categorizeTransaction(narration: string, amount: number, tenantId: string): Promise<{
    ledgerCode: string;
    ledgerId: string | null;
    confidence: number;
    category: string;
  }> {
    // Rule-based categorization (no external API dependency)
    const result = this.matchByRules(narration, amount);

    // Try to find the ledger account
    let ledgerId: string | null = null;
    if (result.ledgerCode) {
      const account = await this.prisma.gLAccount.findFirst({
        where: { tenantId, code: result.ledgerCode },
      });
      ledgerId = account?.id ?? null;
    }

    return { ...result, ledgerId };
  }

  async categorizeBatch(lines: Array<{ id: string; narration: string; debit: number; credit: number }>, tenantId: string) {
    const results: Array<{ lineId: string; ledgerCode: string; ledgerId: string | null; confidence: number; category: string }> = [];

    for (const line of lines) {
      const amount = line.debit > 0 ? line.debit : line.credit;
      const result = await this.categorizeTransaction(line.narration, amount, tenantId);
      results.push({ lineId: line.id, ...result });
    }

    return results;
  }

  private matchByRules(narration: string, amount: number): { ledgerCode: string; confidence: number; category: string } {
    const n = narration.toLowerCase();

    // Salary / Payroll patterns
    if (/\b(salary|payroll|wages|neft.*sal)\b/i.test(n)) {
      return { ledgerCode: "5100", confidence: 0.92, category: "Salary - Lab Staff" };
    }

    // Rent patterns
    if (/\b(rent|lease|premises)\b/i.test(n)) {
      return { ledgerCode: "5300", confidence: 0.90, category: "Rent" };
    }

    // Electricity / Utilities
    if (/\b(electricity|power|bescom|mseb|utility|utilities)\b/i.test(n)) {
      return { ledgerCode: "5301", confidence: 0.88, category: "Electricity & Utilities" };
    }

    // Internet / Telecom
    if (/\b(internet|telecom|broadband|airtel|jio|vodafone|bsnl)\b/i.test(n)) {
      return { ledgerCode: "5302", confidence: 0.87, category: "Internet & Telecom" };
    }

    // Reagents / Lab supplies
    if (/\b(reagent|chemical|diagnostic|bio.?rad|roche|siemens|abbott|beckman|sysmex)\b/i.test(n)) {
      return { ledgerCode: "5001", confidence: 0.85, category: "Reagents & Chemicals" };
    }

    // Consumables
    if (/\b(consumable|gloves|tubes|swab|needle|syringe|vacutainer)\b/i.test(n)) {
      return { ledgerCode: "5002", confidence: 0.85, category: "Consumables" };
    }

    // Reference lab
    if (/\b(reference.?lab|outsourc|metropolis|lal.?path|thyrocare|srl)\b/i.test(n)) {
      return { ledgerCode: "5003", confidence: 0.86, category: "Reference Lab Charges" };
    }

    // PF / EPFO
    if (/\b(epfo|provident.?fund|pf.?contribution|employees.?provident)\b/i.test(n)) {
      return { ledgerCode: "5200", confidence: 0.91, category: "PF Contribution" };
    }

    // ESIC
    if (/\b(esic|esi.?contribution|employee.?state.?insurance)\b/i.test(n)) {
      return { ledgerCode: "5201", confidence: 0.91, category: "ESIC Contribution" };
    }

    // TDS
    if (/\b(tds|tax.?deduct)\b/i.test(n)) {
      if (/194c/i.test(n)) return { ledgerCode: "2101", confidence: 0.90, category: "TDS 194C" };
      if (/194j/i.test(n)) return { ledgerCode: "2102", confidence: 0.90, category: "TDS 194J" };
      return { ledgerCode: "2100", confidence: 0.80, category: "TDS" };
    }

    // Bank charges
    if (/\b(bank.?charge|service.?charge|sms.?charge|maintenance.?charge|debit.?card|atm)\b/i.test(n)) {
      return { ledgerCode: "5600", confidence: 0.89, category: "Bank Charges" };
    }

    // EMI / Loan
    if (/\b(emi|loan|interest|repayment)\b/i.test(n)) {
      return { ledgerCode: "5601", confidence: 0.82, category: "Interest on Loan" };
    }

    // Software / IT subscriptions
    if (/\b(software|subscription|license|aws|azure|google.?cloud|zoho|tally)\b/i.test(n)) {
      return { ledgerCode: "5401", confidence: 0.85, category: "Software & Subscriptions" };
    }

    // Marketing
    if (/\b(marketing|advertising|google.?ads|facebook|campaign|promotion)\b/i.test(n)) {
      return { ledgerCode: "5500", confidence: 0.84, category: "Marketing & Advertising" };
    }

    // Equipment maintenance
    if (/\b(maintenance|repair|amc|service.?contract|calibration)\b/i.test(n)) {
      return { ledgerCode: "5400", confidence: 0.83, category: "Equipment Maintenance" };
    }

    // Patient receipts (credit side)
    if (/\b(patient|collection|receipt|upi|imps|neft).*\b(cr|credit)?\b/i.test(n) && amount > 0) {
      return { ledgerCode: "1200", confidence: 0.70, category: "Patient Receipt" };
    }

    // Insurance receipts
    if (/\b(insurance|tpa|claim|mediclaim|health.?policy)\b/i.test(n)) {
      return { ledgerCode: "1201", confidence: 0.78, category: "Insurance Receipt" };
    }

    // Corporate receipts
    if (/\b(corporate|company|pvt.?ltd|limited|enterprise)\b/i.test(n)) {
      return { ledgerCode: "1202", confidence: 0.72, category: "Corporate Receipt" };
    }

    // Vendor payment
    if (/\b(vendor|supplier|purchase|bill.?payment)\b/i.test(n)) {
      return { ledgerCode: "2001", confidence: 0.75, category: "Vendor Payment" };
    }

    // Default: unmatched
    return { ledgerCode: "", confidence: 0.0, category: "Unmatched" };
  }
}

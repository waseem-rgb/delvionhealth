import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface MatchResult {
  matched: boolean;
  category: string;
  subCategory?: string | null;
  description?: string | null;
  confidence: number;
  matchType: string;
  ruleId?: string;
}

const DEFAULT_NARRATION_RULES: Array<{
  pattern: string;
  category: string;
  subCategory: string;
  description: string;
}> = [
  // REVENUE
  { pattern: "NEFT CR", category: "REVENUE", subCategory: "B2B_PAYMENT", description: "B2B payment received" },
  { pattern: "IMPS CR", category: "REVENUE", subCategory: "B2B_PAYMENT", description: "Payment received via IMPS" },
  { pattern: "UPI CR", category: "REVENUE", subCategory: "WALKIN_PAYMENT", description: "Walk-in UPI payment" },
  { pattern: "POS CR", category: "REVENUE", subCategory: "CARD_PAYMENT", description: "Card payment received" },
  { pattern: "RAZORPAY", category: "REVENUE", subCategory: "PAYMENT_GATEWAY", description: "Razorpay settlement" },
  { pattern: "PAYTM", category: "REVENUE", subCategory: "WALKIN_PAYMENT", description: "Paytm payment received" },
  { pattern: "PHONEPE", category: "REVENUE", subCategory: "WALKIN_PAYMENT", description: "PhonePe payment received" },
  { pattern: "INSURANCE", category: "REVENUE", subCategory: "INSURANCE", description: "Insurance claim settlement" },
  { pattern: "TPA", category: "REVENUE", subCategory: "INSURANCE", description: "TPA settlement received" },
  // REAGENTS
  { pattern: "BIORAD", category: "REAGENTS", subCategory: "QC_MATERIALS", description: "Bio-Rad QC controls" },
  { pattern: "BECKMAN", category: "REAGENTS", subCategory: "REAGENTS", description: "Beckman Coulter reagents" },
  { pattern: "ABBOTT", category: "REAGENTS", subCategory: "REAGENTS", description: "Abbott reagents" },
  { pattern: "ROCHE", category: "REAGENTS", subCategory: "REAGENTS", description: "Roche reagents" },
  { pattern: "SIEMENS", category: "REAGENTS", subCategory: "REAGENTS", description: "Siemens reagents" },
  { pattern: "REAGENT", category: "REAGENTS", subCategory: "REAGENTS", description: "Reagent purchase" },
  { pattern: "CONSUMABLE", category: "REAGENTS", subCategory: "CONSUMABLES", description: "Lab consumables" },
  { pattern: "VACUTAINER", category: "REAGENTS", subCategory: "CONSUMABLES", description: "Vacutainer tubes" },
  // SALARY
  { pattern: "SALARY", category: "SALARY", subCategory: "SALARY", description: "Staff salary payment" },
  { pattern: "SAL/", category: "SALARY", subCategory: "SALARY", description: "Staff salary" },
  { pattern: "PAYROLL", category: "SALARY", subCategory: "SALARY", description: "Payroll disbursement" },
  { pattern: "ESIC", category: "SALARY", subCategory: "STATUTORY", description: "ESIC contribution" },
  { pattern: "EPF", category: "SALARY", subCategory: "STATUTORY", description: "EPF contribution" },
  // RENT
  { pattern: "RENT", category: "RENT", subCategory: "LAB_RENT", description: "Lab premises rent" },
  { pattern: "LEASE", category: "RENT", subCategory: "LEASE", description: "Equipment lease" },
  // UTILITIES
  { pattern: "BESCOM", category: "UTILITIES", subCategory: "ELECTRICITY", description: "Electricity bill" },
  { pattern: "ELECTRICITY", category: "UTILITIES", subCategory: "ELECTRICITY", description: "Electricity payment" },
  { pattern: "BWSSB", category: "UTILITIES", subCategory: "WATER", description: "Water bill" },
  { pattern: "INTERNET", category: "UTILITIES", subCategory: "INTERNET", description: "Internet/broadband" },
  { pattern: "AIRTEL", category: "UTILITIES", subCategory: "TELEPHONE", description: "Airtel bill" },
  { pattern: "JIOFIBER", category: "UTILITIES", subCategory: "INTERNET", description: "JioFiber bill" },
  // MAINTENANCE
  { pattern: "AMC", category: "MAINTENANCE", subCategory: "AMC", description: "Annual maintenance contract" },
  { pattern: "REPAIR", category: "MAINTENANCE", subCategory: "REPAIR", description: "Repair charges" },
  // TAX
  { pattern: "GST", category: "TAX", subCategory: "GST", description: "GST payment" },
  { pattern: "TDS", category: "TAX", subCategory: "TDS", description: "TDS payment" },
  { pattern: "INCOME TAX", category: "TAX", subCategory: "INCOME_TAX", description: "Income tax payment" },
  { pattern: "ADVANCE TAX", category: "TAX", subCategory: "ADVANCE_TAX", description: "Advance tax" },
  // BANK CHARGES
  { pattern: "BANK CHARGES", category: "BANK_CHARGES", subCategory: "CHARGES", description: "Bank charges" },
  { pattern: "CHGS", category: "BANK_CHARGES", subCategory: "CHARGES", description: "Bank charges" },
  { pattern: "PROCESSING FEE", category: "BANK_CHARGES", subCategory: "FEES", description: "Processing fee" },
  // IT
  { pattern: "AWS", category: "IT", subCategory: "CLOUD", description: "AWS cloud services" },
  { pattern: "MICROSOFT", category: "IT", subCategory: "SOFTWARE", description: "Microsoft subscription" },
  { pattern: "GOOGLE", category: "IT", subCategory: "SOFTWARE", description: "Google Workspace" },
  // TRANSFERS
  { pattern: "SELF TRANSFER", category: "TRANSFER", subCategory: "INTERNAL", description: "Internal fund transfer" },
  { pattern: "OWN ACCOUNT", category: "TRANSFER", subCategory: "INTERNAL", description: "Own account transfer" },
  { pattern: "SWEEP", category: "TRANSFER", subCategory: "SWEEP", description: "Auto sweep" },
];

@Injectable()
export class NarrationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaultRules(tenantId: string): Promise<number> {
    const existing = await this.prisma.narrationRule.count({ where: { tenantId } });
    if (existing > 0) return 0;

    await this.prisma.narrationRule.createMany({
      data: DEFAULT_NARRATION_RULES.map((r) => ({
        tenantId,
        pattern: r.pattern,
        matchType: "CONTAINS",
        category: r.category,
        subCategory: r.subCategory,
        description: r.description,
        confidence: 100,
        usageCount: 0,
      })),
    });
    return DEFAULT_NARRATION_RULES.length;
  }

  async matchNarration(tenantId: string, narration: string): Promise<MatchResult> {
    const rules = await this.prisma.narrationRule.findMany({
      where: { tenantId },
      orderBy: [{ confidence: "desc" }, { usageCount: "desc" }],
    });

    const narrationUpper = narration.toUpperCase();

    for (const rule of rules) {
      let matched = false;
      if (rule.matchType === "CONTAINS") {
        matched = narrationUpper.includes(rule.pattern.toUpperCase());
      } else if (rule.matchType === "STARTS_WITH") {
        matched = narrationUpper.startsWith(rule.pattern.toUpperCase());
      } else if (rule.matchType === "REGEX") {
        try {
          matched = new RegExp(rule.pattern, "i").test(narration);
        } catch {
          matched = false;
        }
      }

      if (matched) {
        await this.prisma.narrationRule.update({
          where: { id: rule.id },
          data: { usageCount: { increment: 1 } },
        });
        return {
          matched: true,
          category: rule.category,
          subCategory: rule.subCategory,
          description: rule.description,
          confidence: rule.confidence,
          matchType: "AUTO_MATCHED",
          ruleId: rule.id,
        };
      }
    }

    return {
      matched: false,
      category: "SUSPENSE",
      matchType: "SUSPENSE",
      confidence: 0,
    };
  }

  async getRules(tenantId: string) {
    return this.prisma.narrationRule.findMany({
      where: { tenantId },
      orderBy: [{ category: "asc" }, { usageCount: "desc" }],
    });
  }

  async addRule(
    tenantId: string,
    dto: { pattern: string; matchType?: string; category: string; subCategory?: string; description?: string }
  ) {
    return this.prisma.narrationRule.create({
      data: {
        tenantId,
        pattern: dto.pattern,
        matchType: dto.matchType ?? "CONTAINS",
        category: dto.category,
        subCategory: dto.subCategory,
        description: dto.description,
        confidence: 100,
      },
    });
  }

  async deleteRule(tenantId: string, ruleId: string) {
    await this.prisma.narrationRule.deleteMany({
      where: { id: ruleId, tenantId },
    });
    return { deleted: true };
  }
}

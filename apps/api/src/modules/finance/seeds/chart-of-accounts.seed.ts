import { PrismaClient } from "@prisma/client";

const CHART_OF_ACCOUNTS = [
  // ASSETS (DEBIT_NORMAL)
  { code: "1001", name: "Cash in Hand", group: "ASSET", subGroup: "Current", normalBalance: "DEBIT" },
  { code: "1002", name: "Petty Cash", group: "ASSET", subGroup: "Current", normalBalance: "DEBIT" },
  { code: "1100", name: "HDFC Current Account", group: "ASSET", subGroup: "Bank", normalBalance: "DEBIT" },
  { code: "1101", name: "ICICI Current Account", group: "ASSET", subGroup: "Bank", normalBalance: "DEBIT" },
  { code: "1200", name: "Accounts Receivable - Patients", group: "ASSET", subGroup: "Receivable", normalBalance: "DEBIT" },
  { code: "1201", name: "Accounts Receivable - Insurance", group: "ASSET", subGroup: "Receivable", normalBalance: "DEBIT" },
  { code: "1202", name: "Accounts Receivable - Corporate", group: "ASSET", subGroup: "Receivable", normalBalance: "DEBIT" },
  { code: "1300", name: "Reagent Inventory", group: "ASSET", subGroup: "Inventory", normalBalance: "DEBIT" },
  { code: "1301", name: "Consumables Inventory", group: "ASSET", subGroup: "Inventory", normalBalance: "DEBIT" },
  { code: "1400", name: "Lab Equipment", group: "ASSET", subGroup: "Fixed", normalBalance: "DEBIT" },
  { code: "1401", name: "Computers & IT", group: "ASSET", subGroup: "Fixed", normalBalance: "DEBIT" },
  { code: "1402", name: "Furniture & Fixtures", group: "ASSET", subGroup: "Fixed", normalBalance: "DEBIT" },
  { code: "1500", name: "Security Deposits", group: "ASSET", subGroup: "Non-Current", normalBalance: "DEBIT" },

  // LIABILITIES (CREDIT_NORMAL)
  { code: "2001", name: "Accounts Payable - Vendors", group: "LIABILITY", subGroup: "Current", normalBalance: "CREDIT" },
  { code: "2100", name: "TDS Payable - 192 Salary", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2101", name: "TDS Payable - 194C Contractor", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2102", name: "TDS Payable - 194J Professional", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2200", name: "PF Payable - Employee", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2201", name: "PF Payable - Employer", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2300", name: "ESIC Payable - Employee", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2301", name: "ESIC Payable - Employer", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2400", name: "Professional Tax Payable", group: "LIABILITY", subGroup: "Statutory", normalBalance: "CREDIT" },
  { code: "2500", name: "Salary Payable", group: "LIABILITY", subGroup: "Current", normalBalance: "CREDIT" },
  { code: "2600", name: "Advance from Patients", group: "LIABILITY", subGroup: "Current", normalBalance: "CREDIT" },
  { code: "2700", name: "Bank Loan", group: "LIABILITY", subGroup: "Long-term", normalBalance: "CREDIT" },

  // INCOME (CREDIT_NORMAL)
  { code: "4001", name: "Lab Test Revenue", group: "INCOME", subGroup: "Primary", normalBalance: "CREDIT" },
  { code: "4002", name: "Home Collection Charges", group: "INCOME", subGroup: "Primary", normalBalance: "CREDIT" },
  { code: "4003", name: "Report Charges", group: "INCOME", subGroup: "Primary", normalBalance: "CREDIT" },
  { code: "4004", name: "Insurance Revenue", group: "INCOME", subGroup: "Primary", normalBalance: "CREDIT" },
  { code: "4005", name: "Corporate Revenue", group: "INCOME", subGroup: "Primary", normalBalance: "CREDIT" },
  { code: "4100", name: "Interest Income", group: "INCOME", subGroup: "Other", normalBalance: "CREDIT" },
  { code: "4101", name: "Miscellaneous Income", group: "INCOME", subGroup: "Other", normalBalance: "CREDIT" },

  // EXPENSES (DEBIT_NORMAL)
  { code: "5001", name: "Reagents & Chemicals", group: "EXPENSE", subGroup: "Direct", normalBalance: "DEBIT" },
  { code: "5002", name: "Consumables", group: "EXPENSE", subGroup: "Direct", normalBalance: "DEBIT" },
  { code: "5003", name: "Reference Lab Charges", group: "EXPENSE", subGroup: "Direct", normalBalance: "DEBIT" },
  { code: "5100", name: "Salaries - Lab Staff", group: "EXPENSE", subGroup: "Indirect", normalBalance: "DEBIT" },
  { code: "5101", name: "Salaries - Admin Staff", group: "EXPENSE", subGroup: "Indirect", normalBalance: "DEBIT" },
  { code: "5102", name: "Salaries - Management", group: "EXPENSE", subGroup: "Indirect", normalBalance: "DEBIT" },
  { code: "5200", name: "PF Contribution - Employer", group: "EXPENSE", subGroup: "Statutory", normalBalance: "DEBIT" },
  { code: "5201", name: "ESIC Contribution - Employer", group: "EXPENSE", subGroup: "Statutory", normalBalance: "DEBIT" },
  { code: "5202", name: "Professional Tax - Employer", group: "EXPENSE", subGroup: "Statutory", normalBalance: "DEBIT" },
  { code: "5300", name: "Rent", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
  { code: "5301", name: "Electricity & Utilities", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
  { code: "5302", name: "Internet & Telecom", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
  { code: "5400", name: "Equipment Maintenance", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
  { code: "5401", name: "Software & Subscriptions", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
  { code: "5500", name: "Marketing & Advertising", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
  { code: "5600", name: "Bank Charges", group: "EXPENSE", subGroup: "Financial", normalBalance: "DEBIT" },
  { code: "5601", name: "Interest on Loan", group: "EXPENSE", subGroup: "Financial", normalBalance: "DEBIT" },
  { code: "5700", name: "Depreciation", group: "EXPENSE", subGroup: "Non-Cash", normalBalance: "DEBIT" },
  { code: "5800", name: "Bad Debt Written Off", group: "EXPENSE", subGroup: "Exceptional", normalBalance: "DEBIT" },
  { code: "5900", name: "Miscellaneous Expense", group: "EXPENSE", subGroup: "Overhead", normalBalance: "DEBIT" },
];

export async function seedChartOfAccounts(prisma: PrismaClient, tenantId: string) {
  const existing = await prisma.gLAccount.count({ where: { tenantId } });
  if (existing > 0) {
    console.log(`Chart of accounts already seeded for tenant ${tenantId} (${existing} accounts)`);
    return;
  }

  const typeMap: Record<string, string> = {
    ASSET: "ASSET",
    LIABILITY: "LIABILITY",
    INCOME: "REVENUE",
    EXPENSE: "EXPENSE",
  };

  for (const acct of CHART_OF_ACCOUNTS) {
    await prisma.gLAccount.create({
      data: {
        tenantId,
        code: acct.code,
        name: acct.name,
        type: typeMap[acct.group] as any ?? acct.group as any,
        normalBalance: acct.normalBalance as any,
        group: acct.group,
        subGroup: acct.subGroup,
        isSystem: true,
        openingBalance: BigInt(0),
        currentBalance: BigInt(0),
      },
    });
  }

  console.log(`Seeded ${CHART_OF_ACCOUNTS.length} chart of accounts for tenant ${tenantId}`);
}

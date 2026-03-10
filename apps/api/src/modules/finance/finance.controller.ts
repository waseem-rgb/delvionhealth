import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { FinanceService } from "./finance.service";
import { AccountingService } from "./accounting.service";
import { NarrationEngineService } from "./narration-engine.service";
import { ReceivablesService } from "./services/receivables.service";
import { ProcurementService } from "./services/procurement.service";
import { PayrollCalculationService } from "./services/payroll.service";
import { ComplianceService } from "./services/compliance.service";
import { PayslipService } from "./services/payslip.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("finance")
@ApiBearerAuth()
@Controller("finance")
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly accountingService: AccountingService,
    private readonly narrationEngine: NarrationEngineService,
    private readonly receivablesService: ReceivablesService,
    private readonly procurementService: ProcurementService,
    private readonly payrollService: PayrollCalculationService,
    private readonly complianceService: ComplianceService,
    private readonly payslipService: PayslipService,
  ) {}

  // GL Accounts
  @Get("accounts")
  @ApiOperation({ summary: "Get GL accounts tree" })
  @ApiQuery({ name: "parentId", required: false })
  getAccounts(@CurrentUser() user: JwtPayload, @Query("parentId") parentId?: string) {
    return this.financeService.getAccounts(user.tenantId, parentId);
  }

  @Post("accounts")
  @ApiOperation({ summary: "Create GL account" })
  createAccount(@CurrentUser() user: JwtPayload, @Body() dto: { code: string; name: string; type: string; parentId?: string; normalBalance?: string }) {
    return this.financeService.createAccount(dto, user.tenantId);
  }

  // Journal Entries
  @Get("journal-entries")
  @ApiOperation({ summary: "List journal entries (paginated)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findJournalEntries(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.financeService.findJournalEntries(user.tenantId, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Post("journal-entries")
  @ApiOperation({ summary: "Post a journal entry (must be balanced)" })
  postJournalEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { description?: string; date?: string; reference?: string; lines: Array<{ glAccountId: string; debit: number; credit: number; description?: string }> }
  ) {
    return this.financeService.postJournalEntry(dto, user.tenantId, user.sub);
  }

  @Post("journal-entries/:id/reverse")
  @ApiOperation({ summary: "Reverse a journal entry" })
  reverseJournalEntry(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.financeService.reverseJournalEntry(id, user.tenantId, user.sub);
  }

  // Financial Reports
  @Get("trial-balance")
  @ApiOperation({ summary: "Trial balance" })
  @ApiQuery({ name: "asOf", required: false })
  getTrialBalance(@CurrentUser() user: JwtPayload, @Query("asOf") asOf?: string) {
    return this.financeService.getTrialBalance(user.tenantId, asOf);
  }

  @Get("profit-loss")
  @ApiOperation({ summary: "Profit & Loss statement" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getProfitLoss(
    @CurrentUser() user: JwtPayload,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return this.financeService.getProfitLoss(user.tenantId, from ?? defaultFrom, to ?? now.toISOString());
  }

  @Get("balance-sheet")
  @ApiOperation({ summary: "Balance sheet" })
  @ApiQuery({ name: "asOf", required: false })
  getBalanceSheet(@CurrentUser() user: JwtPayload, @Query("asOf") asOf?: string) {
    return this.financeService.getBalanceSheet(user.tenantId, asOf);
  }

  @Get("cash-flow")
  @ApiOperation({ summary: "Cash flow statement" })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getCashFlow(
    @CurrentUser() user: JwtPayload,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return this.financeService.getCashFlow(user.tenantId, from ?? defaultFrom, to ?? now.toISOString());
  }

  // Bank Accounts
  @Get("bank-accounts")
  @ApiOperation({ summary: "List bank accounts" })
  getBankAccounts(@CurrentUser() user: JwtPayload) {
    return this.financeService.getBankAccounts(user.tenantId);
  }

  @Post("bank-accounts")
  @ApiOperation({ summary: "Create bank account" })
  createBankAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { name: string; accountNumber: string; bankName: string; ifscCode?: string }
  ) {
    return this.financeService.createBankAccount(dto, user.tenantId);
  }

  @Post("bank-accounts/:id/import")
  @ApiOperation({ summary: "Import bank statement rows" })
  importBankStatement(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { rows: Array<{ transactionDate: string; description: string; amount: number; type: string; referenceNumber?: string }> }
  ) {
    return this.financeService.importBankStatement(id, dto.rows, user.tenantId);
  }

  @Get("bank-accounts/:id/statement")
  @ApiOperation({ summary: "Get bank statement" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getBankStatement(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.financeService.getBankStatement(id, user.tenantId, page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Post("bank-accounts/:id/reconcile")
  @ApiOperation({ summary: "Manual reconcile (match statement to JE)" })
  reconcile(
    @CurrentUser() user: JwtPayload,
    @Param("id") bankAccountId: string,
    @Body() dto: { matches: Array<{ statementId: string; journalEntryId: string }> }
  ) {
    return this.financeService.reconcile(user.tenantId, bankAccountId, dto.matches);
  }

  @Post("bank-accounts/:id/auto-reconcile")
  @ApiOperation({ summary: "Auto-reconcile bank statement" })
  autoReconcile(@CurrentUser() user: JwtPayload, @Param("id") bankAccountId: string) {
    return this.financeService.autoReconcile(user.tenantId, bankAccountId);
  }

  // Keep backward-compat
  @Get()
  @ApiOperation({ summary: "List GL accounts (alias)" })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.financeService.findAll(user.tenantId);
  }

  // ── Accounting — Statement Upload ─────────────────────────────────────

  @Post("statements/upload")
  @ApiOperation({ summary: "Upload bank statement (CSV/Excel)" })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadStatement(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body("bankAccountId") bankAccountId: string,
  ) {
    return this.accountingService.uploadStatement(user.tenantId, bankAccountId, file, user.sub);
  }

  @Get("statements")
  @ApiOperation({ summary: "List uploaded statements" })
  getUploadedStatements(@CurrentUser() user: JwtPayload) {
    return this.accountingService.getUploadedStatements(user.tenantId);
  }

  // ── Accounting — Transactions ─────────────────────────────────────────

  @Get("transactions")
  @ApiOperation({ summary: "List bank transactions with filters" })
  @ApiQuery({ name: "bankAccountId", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "matchType", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query("bankAccountId") bankAccountId?: string,
    @Query("category") category?: string,
    @Query("matchType") matchType?: string,
    @Query("type") type?: string,
    @Query("month") month?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.accountingService.getTransactions(user.tenantId, {
      bankAccountId, category, matchType, type, month, search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch("transactions/:id/categorize")
  @ApiOperation({ summary: "Categorize a transaction (resolve suspense)" })
  categorizeTransaction(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { category: string; subCategory?: string; description?: string; saveAsRule?: boolean },
  ) {
    return this.accountingService.categorizeTransaction(user.tenantId, id, dto);
  }

  @Patch("transactions/:id/mark-duplicate")
  @ApiOperation({ summary: "Mark transaction as duplicate" })
  markDuplicate(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.accountingService.markDuplicate(user.tenantId, id);
  }

  @Post("statements/:id/post")
  @ApiOperation({ summary: "Post all transactions from a statement" })
  postTransactions(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.accountingService.postTransactions(user.tenantId, id);
  }

  // ── Accounting — Cash Book ────────────────────────────────────────────

  @Get("cashbook")
  @ApiOperation({ summary: "Get cash book entries" })
  @ApiQuery({ name: "month", required: false })
  getCashBook(@CurrentUser() user: JwtPayload, @Query("month") month?: string) {
    return this.accountingService.getCashBookEntries(user.tenantId, month);
  }

  @Post("cashbook")
  @ApiOperation({ summary: "Add cash book entry" })
  addCashBookEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { entryDate: string; type: string; category?: string; description: string; amount: number; paidTo?: string; receivedFrom?: string; orderId?: string },
  ) {
    return this.accountingService.addCashBookEntry(user.tenantId, dto, user.sub);
  }

  @Delete("cashbook/:id")
  @ApiOperation({ summary: "Delete cash book entry" })
  deleteCashBookEntry(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.accountingService.deleteCashBookEntry(user.tenantId, id);
  }

  // ── Accounting — Narration Rules ──────────────────────────────────────

  @Get("narration-rules")
  @ApiOperation({ summary: "List narration rules" })
  getNarrationRules(@CurrentUser() user: JwtPayload) {
    return this.narrationEngine.getRules(user.tenantId);
  }

  @Post("narration-rules")
  @ApiOperation({ summary: "Add narration rule" })
  addNarrationRule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { pattern: string; matchType?: string; category: string; subCategory?: string; description?: string },
  ) {
    return this.narrationEngine.addRule(user.tenantId, dto);
  }

  @Delete("narration-rules/:id")
  @ApiOperation({ summary: "Delete narration rule" })
  deleteNarrationRule(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.narrationEngine.deleteRule(user.tenantId, id);
  }

  // ── Accounting — Combined Ledger ──────────────────────────────────────

  @Get("ledger")
  @ApiOperation({ summary: "Combined ledger (bank + cash)" })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "source", required: false })
  getLedger(
    @CurrentUser() user: JwtPayload,
    @Query("month") month?: string,
    @Query("category") category?: string,
    @Query("source") source?: string,
  ) {
    return this.accountingService.getLedger(user.tenantId, { month, category, source });
  }

  // ── Phase 2: Receivables ──────────────────────────────────────────────

  @Post("invoices")
  @ApiOperation({ summary: "Create finance invoice" })
  createInvoice(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.receivablesService.createInvoice(dto, user.tenantId, user.sub);
  }

  @Get("invoices")
  @ApiOperation({ summary: "List invoices with filters" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getInvoices(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.receivablesService.getInvoices(user.tenantId, {
      status, type, dateFrom, dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("invoices/:id")
  @ApiOperation({ summary: "Get invoice by ID" })
  getInvoiceById(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.receivablesService.getInvoiceById(id, user.tenantId);
  }

  @Post("payments")
  @ApiOperation({ summary: "Record payment against invoice" })
  recordPayment(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.receivablesService.recordPayment(dto, user.tenantId, user.sub);
  }

  @Get("aging-report")
  @ApiOperation({ summary: "Get accounts receivable aging report" })
  getAgingReport(@CurrentUser() user: JwtPayload) {
    return this.receivablesService.getAgingReport(user.tenantId);
  }

  @Get("insurance-claims")
  @ApiOperation({ summary: "List insurance claims" })
  getInsuranceClaims(@CurrentUser() user: JwtPayload) {
    return this.receivablesService.getInsuranceClaims(user.tenantId);
  }

  @Patch("insurance-claims/:id")
  @ApiOperation({ summary: "Update insurance claim" })
  updateInsuranceClaim(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: any) {
    return this.receivablesService.updateInsuranceClaim(id, user.tenantId, dto);
  }

  // ── Phase 2: Procurement ──────────────────────────────────────────────

  @Post("vendors")
  @ApiOperation({ summary: "Create vendor" })
  createVendor(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.procurementService.createVendor(dto, user.tenantId);
  }

  @Get("vendors")
  @ApiOperation({ summary: "List vendors" })
  getVendors(@CurrentUser() user: JwtPayload) {
    return this.procurementService.getVendors(user.tenantId);
  }

  @Post("purchase-orders")
  @ApiOperation({ summary: "Create purchase order" })
  createPurchaseOrder(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.procurementService.createPurchaseOrder(dto, user.tenantId, user.sub);
  }

  @Get("purchase-orders")
  @ApiOperation({ summary: "List purchase orders" })
  getPurchaseOrders(@CurrentUser() user: JwtPayload) {
    return this.procurementService.getPurchaseOrders(user.tenantId);
  }

  @Patch("purchase-orders/:id/approve")
  @ApiOperation({ summary: "Approve purchase order" })
  approvePurchaseOrder(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.procurementService.approvePurchaseOrder(id, user.tenantId, user.sub);
  }

  @Post("grns")
  @ApiOperation({ summary: "Create goods received note" })
  createGRN(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.procurementService.createGRN(dto, user.tenantId, user.sub);
  }

  @Post("grns/:id/confirm")
  @ApiOperation({ summary: "Confirm GRN and update inventory" })
  confirmGRN(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.procurementService.confirmGRN(id, user.tenantId, user.sub);
  }

  @Post("vendor-invoices")
  @ApiOperation({ summary: "Create vendor invoice" })
  createVendorInvoice(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.procurementService.createVendorInvoice(dto, user.tenantId);
  }

  @Post("vendor-invoices/:id/match")
  @ApiOperation({ summary: "Run 3-way match on vendor invoice" })
  threeWayMatch(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.procurementService.threeWayMatch(id, user.tenantId, user.sub);
  }

  @Post("vendor-payments")
  @ApiOperation({ summary: "Record vendor payment" })
  recordVendorPayment(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.procurementService.recordVendorPayment(dto, user.tenantId, user.sub);
  }

  @Get("inventory")
  @ApiOperation({ summary: "List inventory items" })
  getInventory(@CurrentUser() user: JwtPayload) {
    return this.procurementService.getInventory(user.tenantId);
  }

  @Post("inventory/out")
  @ApiOperation({ summary: "Record inventory consumption" })
  recordInventoryOut(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.procurementService.recordInventoryOut(dto, user.tenantId, user.sub);
  }

  // ── Phase 3: Payroll ───────────────────────────────────────────────────

  @Get("employees")
  @ApiOperation({ summary: "List employees with salary structures" })
  getEmployeesWithStructures(@CurrentUser() user: JwtPayload) {
    return this.payrollService.getEmployeesWithStructures(user.tenantId);
  }

  @Post("salary-structures")
  @ApiOperation({ summary: "Create salary structure for employee" })
  createSalaryStructure(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.payrollService.createSalaryStructure(dto, user.tenantId);
  }

  @Post("payroll/run")
  @ApiOperation({ summary: "Create payroll run for a month" })
  createPayrollRun(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { month: number; year: number },
  ) {
    return this.payrollService.createPayrollRun(dto.month, dto.year, user.tenantId, user.sub);
  }

  @Get("payroll/:id")
  @ApiOperation({ summary: "Get payroll run details" })
  getPayrollRun(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payrollService.getPayrollRun(id, user.tenantId);
  }

  @Post("payroll/:id/approve")
  @ApiOperation({ summary: "Approve payroll run" })
  approvePayrollRun(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payrollService.approvePayrollRun(id, user.tenantId, user.sub);
  }

  @Post("payroll/:id/post")
  @ApiOperation({ summary: "Post payroll run to journal" })
  postPayroll(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.payrollService.postPayroll(id, user.tenantId, user.sub);
  }

  @Get("payroll/:id/payslip/:employeeId")
  @ApiOperation({ summary: "Generate payslip for employee" })
  generatePayslip(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("employeeId") employeeId: string,
  ) {
    return this.payslipService.generatePayslip(id, employeeId, user.tenantId);
  }

  // ── Phase 3: Compliance ────────────────────────────────────────────────

  @Get("compliance-calendar")
  @ApiOperation({ summary: "Get compliance calendar" })
  @ApiQuery({ name: "month", required: false, type: Number })
  @ApiQuery({ name: "year", required: false, type: Number })
  getComplianceCalendar(
    @CurrentUser() user: JwtPayload,
    @Query("month") month?: string,
    @Query("year") year?: string,
  ) {
    return this.complianceService.getComplianceCalendar(
      user.tenantId,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
  }

  @Post("statutory-payments")
  @ApiOperation({ summary: "Record statutory payment" })
  recordStatutoryPayment(@CurrentUser() user: JwtPayload, @Body() dto: any) {
    return this.complianceService.recordStatutoryPayment(dto, user.tenantId, user.sub);
  }

  @Get("statutory-payments")
  @ApiOperation({ summary: "List statutory payments" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "period", required: false })
  getStatutoryPayments(
    @CurrentUser() user: JwtPayload,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("period") period?: string,
  ) {
    return this.complianceService.getStatutoryPayments(user.tenantId, { type, status, period });
  }
}

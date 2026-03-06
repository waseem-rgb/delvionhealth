import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { FinanceService } from "./finance.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("finance")
@ApiBearerAuth()
@Controller("finance")
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

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
}

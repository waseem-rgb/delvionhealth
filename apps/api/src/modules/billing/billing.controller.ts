import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { IssueRefundDto } from "./dto/issue-refund.dto";
import { CreateInsuranceClaimDto } from "./dto/create-insurance-claim.dto";
import { UpdateClaimStatusDto } from "./dto/update-claim-status.dto";

@ApiTags("billing")
@ApiBearerAuth()
@Controller("billing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── Invoices ──────────────────────────────────────────────────────────────

  @Get("invoices")
  @ApiOperation({ summary: "List invoices with optional filters" })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: InvoiceQueryDto) {
    return this.billingService.findAll(user.tenantId, query);
  }

  @Get("invoices/:id")
  @ApiOperation({ summary: "Get invoice by ID" })
  getInvoice(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.getInvoice(id, user.tenantId);
  }

  @Put("invoices/:id")
  @ApiOperation({ summary: "Update invoice (DRAFT or SENT only)" })
  updateInvoice(
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.updateInvoice(id, dto, user.tenantId);
  }

  @Get("invoices/:id/download")
  @ApiOperation({ summary: "Get presigned PDF download URL for invoice" })
  getInvoiceDownloadUrl(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.getInvoiceDownloadUrl(id, user.tenantId);
  }

  @Get("invoices/:id/payments")
  @ApiOperation({ summary: "Get all payments for an invoice" })
  getPaymentsByInvoice(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.getPaymentsByInvoice(id, user.tenantId);
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Post("payments")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Record a payment for an invoice" })
  recordPayment(@Body() dto: RecordPaymentDto, @CurrentUser() user: JwtPayload) {
    return this.billingService.recordPayment(dto, user.tenantId, user.sub);
  }

  @Post("payments/:id/refund")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Issue a refund for a payment" })
  issueRefund(
    @Param("id") id: string,
    @Body() dto: IssueRefundDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.issueRefund({ ...dto, paymentId: id }, user.tenantId, user.sub);
  }

  // ── Receivables / AR ──────────────────────────────────────────────────────

  @Get("receivables")
  @ApiOperation({ summary: "AR aging buckets and top overdue invoices" })
  getReceivables(@CurrentUser() user: JwtPayload) {
    return this.billingService.getReceivables(user.tenantId);
  }

  @Get("summary")
  @ApiOperation({ summary: "Collection summary with daily breakdown and by-method" })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  getCollectionSummary(
    @CurrentUser() user: JwtPayload,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string
  ) {
    const now = new Date();
    const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = dateTo ? new Date(dateTo) : now;
    return this.billingService.getCollectionSummary(user.tenantId, from, to);
  }

  // ── Insurance Claims ──────────────────────────────────────────────────────

  @Get("claims")
  @ApiOperation({ summary: "List insurance claims" })
  findClaims(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string
  ) {
    return this.billingService.findClaims(user.tenantId, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      dateFrom,
      dateTo,
    });
  }

  @Post("claims")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create an insurance claim for an invoice" })
  createInsuranceClaim(@Body() dto: CreateInsuranceClaimDto, @CurrentUser() user: JwtPayload) {
    return this.billingService.createInsuranceClaim(dto, user.tenantId);
  }

  @Put("claims/:id/status")
  @ApiOperation({ summary: "Update insurance claim status" })
  updateClaimStatus(
    @Param("id") id: string,
    @Body() dto: UpdateClaimStatusDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.updateClaimStatus(id, dto, user.tenantId, user.sub);
  }

  // ── Denial Management ──────────────────────────────────────────────────────

  @Post("claims/:id/deny")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Record denial for an insurance claim" })
  recordDenial(
    @Param("id") id: string,
    @Body() dto: { denialCode: string; denialReason: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.recordDenial(id, dto, user.tenantId);
  }

  @Post("claims/:id/appeal")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Appeal a denied insurance claim" })
  appealClaim(
    @Param("id") id: string,
    @Body() dto: { appealNotes: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.appealClaim(id, dto, user.tenantId);
  }

  @Post("claims/:id/resubmit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resubmit an appealed insurance claim" })
  resubmitClaim(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.billingService.resubmitClaim(id, user.tenantId);
  }

  @Get("denials/dashboard")
  @ApiOperation({ summary: "Denial analytics dashboard" })
  getDenialDashboard(@CurrentUser() user: JwtPayload) {
    return this.billingService.getDenialDashboard(user.tenantId);
  }

  // ── Payment Plans ──────────────────────────────────────────────────────────

  @Get("payment-plans")
  @ApiOperation({ summary: "List patient payment plans" })
  findPaymentPlans(
    @CurrentUser() user: JwtPayload,
    @Query("patientId") patientId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.billingService.findPaymentPlans(user.tenantId, {
      patientId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("payment-plans")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a patient payment plan" })
  createPaymentPlan(
    @Body() dto: { patientId: string; invoiceId: string; totalAmount: number; installmentCount: number; frequency: string; notes?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.createPaymentPlan(dto, user.tenantId, user.sub);
  }

  @Post("payment-plans/:planId/installments/:instId/pay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Record payment for an installment" })
  recordInstallmentPayment(
    @Param("planId") planId: string,
    @Param("instId") instId: string,
    @Body() dto: { amount: number; method: string; reference?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.billingService.recordInstallmentPayment(planId, instId, dto, user.tenantId);
  }

  @Post("upload-proof")
  @ApiOperation({ summary: "Upload payment proof (screenshot, slip, pre-auth letter)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  async uploadPaymentProof(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException("File too large (5MB max)");
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException("Only JPG, PNG, WebP, and PDF are allowed");
    return this.billingService.uploadPaymentProof(file, user.tenantId);
  }
}

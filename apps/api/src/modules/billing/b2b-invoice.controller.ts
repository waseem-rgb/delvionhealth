import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { B2BInvoiceService } from "./b2b-invoice.service";
import type { GenerateB2BInvoiceDto, RecordB2BPaymentDto } from "./b2b-invoice.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("billing-b2b")
@ApiBearerAuth()
@Controller("billing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class B2BInvoiceController {
  constructor(private readonly b2bService: B2BInvoiceService) {}

  // ── B2B Invoices ────────────────────────────────────────────────────────

  @Get("b2b-invoices")
  @ApiOperation({ summary: "List B2B invoices with filters" })
  @ApiQuery({ name: "organizationId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("organizationId") organizationId?: string,
    @Query("status") status?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.b2bService.findAll(user.tenantId, {
      organizationId,
      status,
      dateFrom,
      dateTo,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("b2b-invoices/generate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Generate a B2B invoice for an organization" })
  generateInvoice(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateB2BInvoiceDto,
  ) {
    return this.b2bService.generateInvoice(user.tenantId, dto);
  }

  @Get("b2b-invoices/:id")
  @ApiOperation({ summary: "Get B2B invoice by ID with line items and payments" })
  findOne(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.b2bService.findOne(id, user.tenantId);
  }

  @Put("b2b-invoices/:id/send")
  @ApiOperation({ summary: "Send B2B invoice to organization" })
  sendInvoice(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.b2bService.sendInvoice(id, user.tenantId);
  }

  @Post("b2b-invoices/:id/payment")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Record a payment against a B2B invoice" })
  recordPayment(
    @Param("id") id: string,
    @Body() dto: RecordB2BPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.b2bService.recordPayment(id, dto, user.tenantId, user.sub);
  }

  @Get("b2b-invoices/:id/download")
  @ApiOperation({ summary: "Get presigned PDF download URL for B2B invoice" })
  downloadInvoice(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.b2bService.getDownloadUrl(id, user.tenantId);
  }

  // ── Outstanding ─────────────────────────────────────────────────────────

  @Get("outstanding")
  @ApiOperation({ summary: "Outstanding report across all organizations" })
  getOutstandingReport(@CurrentUser() user: JwtPayload) {
    return this.b2bService.getOutstandingReport(user.tenantId);
  }

  // ── Organization Statement ──────────────────────────────────────────────

  @Get("organizations/statement")
  @ApiOperation({ summary: "Account statement for an organization" })
  @ApiQuery({ name: "organizationId", required: true })
  @ApiQuery({ name: "fromDate", required: true })
  @ApiQuery({ name: "toDate", required: true })
  getOrganizationStatement(
    @CurrentUser() user: JwtPayload,
    @Query("organizationId") organizationId: string,
    @Query("fromDate") fromDate: string,
    @Query("toDate") toDate: string,
  ) {
    return this.b2bService.getOrganizationStatement(
      user.tenantId,
      organizationId,
      fromDate,
      toDate,
    );
  }
}

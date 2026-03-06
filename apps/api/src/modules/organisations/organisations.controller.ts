import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { OrganisationsService } from "./organisations.service";
import { MinioService } from "../reports/minio.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("organisations")
@ApiBearerAuth()
@Controller("organisations")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly minio: MinioService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List organisations with filters" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "paymentType", required: false })
  @ApiQuery({ name: "isActive", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("paymentType") paymentType?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.organisationsService.findAll(user.tenantId, {
      search,
      paymentType,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE)
  @ApiOperation({ summary: "Create organisation" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.organisationsService.create(user.tenantId, body as Parameters<OrganisationsService["create"]>[1]);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get organisation details" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organisationsService.findOne(id, user.tenantId);
  }

  @Put(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE)
  @ApiOperation({ summary: "Update organisation" })
  update(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.organisationsService.update(id, user.tenantId, body);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-delete organisation" })
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organisationsService.softDelete(id, user.tenantId);
  }

  @Post(":id/generate-login")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Generate login credentials for organisation" })
  generateLogin(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { loginType: string; loginEmail: string; loginPassword: string },
  ) {
    return this.organisationsService.generateLogin(id, user.tenantId, body);
  }

  @Get(":id/ledger")
  @ApiOperation({ summary: "Get organisation payment ledger" })
  getLedger(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organisationsService.getLedger(id, user.tenantId);
  }

  @Post(":id/payment")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.FINANCE_EXECUTIVE)
  @ApiOperation({ summary: "Record payment from organisation" })
  recordPayment(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { amount: number; method?: string; reference?: string; notes?: string },
  ) {
    return this.organisationsService.recordPayment(id, user.tenantId, body);
  }

  @Get(":id/rates")
  @ApiOperation({ summary: "Get organisation rate list items" })
  getOrgRates(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organisationsService.getOrgRateList(id, user.tenantId);
  }

  @Get(":id/overview")
  @ApiOperation({ summary: "Get organisation overview with KPIs and chart data" })
  getOverview(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organisationsService.getOrgOverview(id, user.tenantId);
  }

  @Get(":id/invoices")
  @ApiOperation({ summary: "Get paginated invoices for organisation" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getOrgInvoices(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.organisationsService.getOrgInvoices(id, user.tenantId, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
    });
  }

  @Get(":id/ledger-entries")
  @ApiOperation({ summary: "Get paginated ledger entries for organisation" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  getLedgerEntries(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.organisationsService.getOrgLedgerEntries(id, user.tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
    });
  }

  @Get(":id/ai-insights")
  @ApiOperation({ summary: "Generate AI insights for organisation" })
  getAiInsights(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.organisationsService.getOrgAiInsights(id, user.tenantId);
  }

  @Post(":id/upload-header")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload org report header image" })
  async uploadHeader(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const objectKey = `org-branding/${user.tenantId}/${id}/header.${file.mimetype.split("/")[1] || "png"}`;
    await this.minio.upload(objectKey, file.buffer, file.mimetype);
    const url = await this.minio.getPresignedUrl(objectKey, 86400 * 365);
    await this.organisationsService.update(id, user.tenantId, { headerImageUrl: objectKey });
    return { url, objectKey };
  }

  @Post(":id/upload-footer")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload org report footer image" })
  async uploadFooter(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const objectKey = `org-branding/${user.tenantId}/${id}/footer.${file.mimetype.split("/")[1] || "png"}`;
    await this.minio.upload(objectKey, file.buffer, file.mimetype);
    const url = await this.minio.getPresignedUrl(objectKey, 86400 * 365);
    await this.organisationsService.update(id, user.tenantId, { footerImageUrl: objectKey });
    return { url, objectKey };
  }
}

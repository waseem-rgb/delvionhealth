import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { MinioService } from "../reports/minio.service";
import {
  CreateTenantDto,
  CreateBranchDto,
  UpdateTenantDto,
  UpdateTenantConfigDto,
} from "./dto/create-tenant.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("tenants")
@ApiBearerAuth()
@Controller("tenants")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly minio: MinioService,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a new tenant (super admin only)" })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "List all tenants (super admin only)" })
  findAll() {
    return this.tenantsService.findAll();
  }

  // Literal routes must come BEFORE param routes to avoid :id swallowing them
  @Get("my-settings")
  @ApiOperation({ summary: "Get current tenant settings" })
  getMySettings(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.findById(user.tenantId);
  }

  @Put("my-settings")
  @ApiOperation({ summary: "Update current tenant settings" })
  updateMySettings(
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantsService.updateSettings(user.tenantId, dto);
  }

  @Get("report-settings")
  @ApiOperation({ summary: "Get tenant report branding settings" })
  getReportSettings(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getReportSettings(user.tenantId);
  }

  @Put("report-settings")
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update tenant report branding settings" })
  updateReportSettings(
    @Body() dto: {
      reportHeaderHtml?: string | null;
      reportFooterHtml?: string | null;
      reportHeaderImageUrl?: string | null;
      reportFooterImageUrl?: string | null;
      showHeaderFooter?: boolean;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantsService.updateReportSettings(user.tenantId, dto);
  }

  @Post("upload-report-image")
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.LAB_MANAGER)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload report header or footer image" })
  async uploadReportImage(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Query("type") type: "header" | "footer",
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!["header", "footer"].includes(type)) throw new BadRequestException("type must be 'header' or 'footer'");

    const objectKey = `report-branding/${user.tenantId}/${type}-${Date.now()}.${file.mimetype.split("/")[1] || "png"}`;
    await this.minio.upload(objectKey, file.buffer, file.mimetype);
    const url = await this.minio.getPresignedUrl(objectKey, 86400 * 365);

    const field = type === "header" ? "reportHeaderImageUrl" : "reportFooterImageUrl";
    await this.tenantsService.updateReportSettings(user.tenantId, { [field]: objectKey });

    return { url, objectKey };
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Get tenant details" })
  findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }

  @Put(":id")
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Update tenant" })
  update(@Param("id") id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Put(":id/config")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Update tenant config" })
  updateConfig(
    @Param("id") id: string,
    @Body() dto: UpdateTenantConfigDto
  ) {
    return this.tenantsService.updateConfig(id, dto);
  }

  // Branches
  @Post(":id/branches")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Create a new branch" })
  createBranch(@Param("id") id: string, @Body() dto: CreateBranchDto) {
    return this.tenantsService.createBranch(id, dto);
  }

  @Get(":id/branches")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "List branches" })
  getBranches(@Param("id") id: string) {
    return this.tenantsService.getBranches(id);
  }

  @Put(":id/branches/:branchId")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Update branch" })
  updateBranch(
    @Param("id") id: string,
    @Param("branchId") branchId: string,
    @Body() dto: Partial<CreateBranchDto>
  ) {
    return this.tenantsService.updateBranch(id, branchId, dto);
  }

  @Delete(":id/branches/:branchId")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate branch" })
  deactivateBranch(
    @Param("id") id: string,
    @Param("branchId") branchId: string
  ) {
    return this.tenantsService.deactivateBranch(id, branchId);
  }
}

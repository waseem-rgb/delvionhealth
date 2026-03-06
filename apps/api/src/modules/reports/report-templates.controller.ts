import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ReportTemplatesService } from "./report-templates.service";
import type {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
} from "./report-templates.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("report-templates")
@ApiBearerAuth()
@Controller("report-templates")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReportTemplatesController {
  constructor(
    private readonly reportTemplatesService: ReportTemplatesService
  ) {}

  @Get()
  @ApiOperation({ summary: "List all active report templates" })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.reportTemplatesService.findAll(user.tenantId);
  }

  @Get("default")
  @ApiOperation({ summary: "Get default report template" })
  findDefault(@CurrentUser() user: JwtPayload) {
    return this.reportTemplatesService.findDefault(user.tenantId);
  }

  @Post("ai-generate")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Generate template header/footer with AI" })
  aiGenerate(
    @Body()
    body: {
      instruction: string;
      templateType: string;
      existingHeader?: string;
      existingFooter?: string;
    },
    @TenantId() tenantId: string,
  ) {
    return this.reportTemplatesService.generateTemplateWithAI(
      tenantId,
      body.instruction,
      body.templateType,
      body.existingHeader,
      body.existingFooter,
    );
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create a new report template" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReportTemplateDto
  ) {
    return this.reportTemplatesService.create(user.tenantId, dto);
  }

  @Put(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update a report template" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateReportTemplateDto
  ) {
    return this.reportTemplatesService.update(user.tenantId, id, dto);
  }

  @Put(":id/set-default")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Set a report template as default" })
  setDefault(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reportTemplatesService.setDefault(user.tenantId, id);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Delete a report template (soft delete)" })
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.reportTemplatesService.remove(user.tenantId, id);
  }
}

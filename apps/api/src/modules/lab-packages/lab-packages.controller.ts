import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { LabPackagesService } from "./lab-packages.service";
import { AiPackageService } from "./ai-package.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import { Role } from "@delvion/types";

@ApiTags("lab-packages")
@ApiBearerAuth()
@Controller("lab-packages")
@UseGuards(JwtAuthGuard, TenantGuard)
export class LabPackagesController {
  constructor(
    private readonly labPackagesService: LabPackagesService,
    private readonly aiPackageService: AiPackageService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List lab packages" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("category") category?: string,
    @Query("gender") gender?: string,
    @Query("active") active?: string,
    @Query("search") search?: string,
  ) {
    return this.labPackagesService.findAll(user.tenantId, {
      category,
      gender,
      isActive: active !== undefined ? active === "true" : undefined,
      search,
    });
  }

  @Post("ai-chat")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FRONT_DESK)
  @ApiOperation({ summary: "AI package builder chat" })
  aiChat(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      sessionId?: string;
      message: string;
      sessionType?: string;
      context?: {
        patientAge?: number;
        patientGender?: string;
        symptoms?: string;
        budget?: number;
      };
    },
  ) {
    return this.aiPackageService.chat(
      user.tenantId,
      body.sessionId ?? null,
      body.message,
      body.sessionType ?? "PACKAGE_BUILDER",
      body.context ?? {},
      user.sub,
    );
  }

  @Post("save-from-ai")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Save AI suggestion as package" })
  saveFromAI(@CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.aiPackageService.saveFromAI(user.tenantId, body, user.sub);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create lab package" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, any>,
  ) {
    return this.labPackagesService.create(user.tenantId, dto, user.sub);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get package by id" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.labPackagesService.findOne(user.tenantId, id);
  }

  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update lab package" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: Record<string, any>,
  ) {
    return this.labPackagesService.update(user.tenantId, id, dto);
  }

  @Patch(":id/toggle")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Toggle package active/inactive" })
  toggle(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.labPackagesService.toggleActive(user.tenantId, id);
  }

  @Post(":id/duplicate")
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Duplicate package" })
  duplicate(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.labPackagesService.duplicate(user.tenantId, id, user.sub);
  }
}

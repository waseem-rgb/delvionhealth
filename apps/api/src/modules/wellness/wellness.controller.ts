import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Res,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import { WellnessService } from "./wellness.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("wellness")
@ApiBearerAuth()
@Controller("wellness")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class WellnessController {
  constructor(private readonly wellnessService: WellnessService) {}

  @Public()
  @Get("share/:token")
  @ApiOperation({ summary: "View shared wellness dashboard (public)" })
  async viewShared(@Param("token") token: string, @Res() res: Response) {
    const dashboard = await this.wellnessService.getByShareToken(token);
    if (!dashboard.htmlContent) {
      res.status(404).send("<h2>Dashboard not yet generated</h2>");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(dashboard.htmlContent);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "List all wellness dashboards" })
  list(@TenantId() tenantId: string) {
    return this.wellnessService.list(tenantId);
  }

  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Get wellness dashboard by ID" })
  getById(@Param("id") id: string, @TenantId() tenantId: string) {
    return this.wellnessService.getById(id, tenantId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create a new wellness dashboard" })
  create(
    @CurrentUser() user: JwtPayload,
    @TenantId() tenantId: string,
    @Body()
    dto: {
      title: string;
      corporateName: string;
      organizationId?: string;
      campDateFrom: string;
      campDateTo: string;
      testIds?: string[];
    },
  ) {
    return this.wellnessService.create(tenantId, {
      ...dto,
      userId: user.sub,
    });
  }

  @Post(":id/generate")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Generate wellness dashboard with AI" })
  generate(@Param("id") id: string, @TenantId() tenantId: string) {
    return this.wellnessService.generate(id, tenantId);
  }

  @Post(":id/publish")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Toggle publish status of wellness dashboard" })
  publish(@Param("id") id: string, @TenantId() tenantId: string) {
    return this.wellnessService.publish(id, tenantId);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Delete a wellness dashboard" })
  remove(@Param("id") id: string, @TenantId() tenantId: string) {
    return this.wellnessService.remove(id, tenantId);
  }

}

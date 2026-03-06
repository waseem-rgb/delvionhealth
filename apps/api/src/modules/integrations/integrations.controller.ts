import { Controller, Get, Post, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { IntegrationsService } from "./integrations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("integrations")
@ApiBearerAuth()
@Controller("integrations")
@UseGuards(JwtAuthGuard, TenantGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: "List integrations" })
  findAll(@CurrentUser() user: JwtPayload): Promise<unknown[]> {
    return this.integrationsService.findAll(user.tenantId);
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  @Get("api-keys")
  @ApiOperation({ summary: "List API keys for the tenant" })
  listApiKeys(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.listApiKeys(user.tenantId);
  }

  @Post("api-keys")
  @ApiOperation({ summary: "Create a new API key" })
  createApiKey(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; permissions?: string[] }
  ) {
    return this.integrationsService.createApiKey(
      user.tenantId,
      user.sub,
      body.name,
      body.permissions ?? ["read"]
    );
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Delete (deactivate) an API key" })
  deleteApiKey(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.integrationsService.deleteApiKey(id, user.tenantId);
  }
}

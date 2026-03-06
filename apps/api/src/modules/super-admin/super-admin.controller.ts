import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SuperAdminService } from './super-admin.service';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import type { JwtPayload } from '@delvion/types';
import { Role } from '@delvion/types';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  getPlatformStats() {
    return this.superAdminService.getPlatformStats();
  }

  @Get('mrr-trend')
  getMRRTrend(@Query('months') months?: string) {
    return this.superAdminService.getMRRTrend(months ? parseInt(months) : 12);
  }

  @Get('health')
  getPlatformHealth() {
    return this.superAdminService.getPlatformHealth();
  }

  @Get('plans')
  listPlans() {
    return this.superAdminService['prisma'].subscriptionPlan.findMany({
      where: { isActive: true },
    });
  }

  @Get('tenants')
  listTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('planId') planId?: string,
  ) {
    return this.superAdminService.listTenants({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
      search,
      planId,
    });
  }

  @Post('tenants')
  provisionTenant(@Body() dto: ProvisionTenantDto, @CurrentUser() user: JwtPayload) {
    return this.superAdminService.provisionTenant(dto, user.sub);
  }

  @Get('tenants/:id')
  getTenantDetail(@Param('id') id: string) {
    return this.superAdminService.getTenantDetail(id);
  }

  @Put('tenants/:id/suspend')
  suspendTenant(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.superAdminService.suspendTenant(id, body.reason, user.sub);
  }

  @Put('tenants/:id/reactivate')
  reactivateTenant(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.superAdminService.reactivateTenant(id, user.sub);
  }

  @Put('tenants/:id/plan')
  changePlan(
    @Param('id') id: string,
    @Body() body: { planName: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.superAdminService.changePlan(id, body.planName, user.sub);
  }

  @Get('feature-flags')
  listFeatureFlags() {
    return this.superAdminService.listFeatureFlags();
  }

  @Get('tenants/:id/flags')
  getTenantFlags(@Param('id') id: string) {
    return this.superAdminService.getTenantFlags(id);
  }

  @Put('tenants/:id/flags/:key')
  setFeatureFlag(
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: { value: boolean },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.superAdminService.setFeatureFlag(id, key, body.value, user.sub);
  }

  @Get('tenants/:id/usage')
  getCurrentUsage(@Param('id') id: string) {
    return this.superAdminService.getCurrentUsage(id);
  }

  @Get('audit-log')
  getAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
  ) {
    return this.superAdminService.getAuditLog({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      tenantId,
      action,
    });
  }
}

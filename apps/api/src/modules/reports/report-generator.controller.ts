import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportGeneratorService } from './report-generator.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@delvion/types';

@ApiTags('report-generator')
@ApiBearerAuth()
@Controller('report-generator')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportGeneratorController {
  constructor(private svc: ReportGeneratorService) {}

  @Post('start')
  start(@CurrentUser() user: JwtPayload) {
    return this.svc.startJob(user.tenantId);
  }

  @Get('status')
  status(@CurrentUser() user: JwtPayload) {
    return this.svc.getStatus(user.tenantId);
  }

  @Get('templates')
  list(@CurrentUser() user: JwtPayload, @Query('search') search?: string) {
    return this.svc.listTemplates(user.tenantId, search);
  }

  @Get('templates/:testId')
  getOne(@CurrentUser() user: JwtPayload, @Param('testId') testId: string) {
    return this.svc.getTemplate(user.tenantId, testId);
  }

  @Patch('templates/:testId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('testId') testId: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.svc.updateTemplate(user.tenantId, testId, dto);
  }

  @Post('templates/:testId/regenerate')
  regenerate(@CurrentUser() user: JwtPayload, @Param('testId') testId: string) {
    return this.svc.regenerateOne(user.tenantId, testId);
  }
}

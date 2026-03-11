import { Controller, Get, Post, Param, Query, Request, UseGuards } from '@nestjs/common';
import { RepeatAnalyticsService } from './repeat-analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('revenue-crm/repeat-analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RepeatAnalyticsController {
  constructor(private svc: RepeatAnalyticsService) {}

  @Post('run')
  run(@Request() req: any) { return this.svc.runAnalysis(req.user.tenantId); }

  @Get('status')
  status(@Request() req: any) { return this.svc.getStatus(req.user.tenantId); }

  @Get('summary')
  summary(@Request() req: any) { return this.svc.getSummary(req.user.tenantId); }

  @Get('candidates')
  candidates(@Request() req: any, @Query('priority') priority?: string, @Query('page') page?: string) {
    return this.svc.getCandidates(req.user.tenantId, priority, parseInt(page || '1'));
  }

  @Post('candidates/:id/remind')
  remind(@Request() req: any, @Param('id') id: string) {
    return this.svc.generateReminderMessage(req.user.tenantId, id);
  }

  @Post('candidates/:id/contacted')
  markContacted(@Request() req: any, @Param('id') id: string) {
    return this.svc.markContacted(req.user.tenantId, id);
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('revenue-crm')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CampaignsController {
  constructor(private svc: CampaignsService) {}

  @Get('campaigns/stats')
  stats(@Request() req: any) { return this.svc.getStats(req.user.tenantId); }

  @Get('campaigns')
  findAll(@Request() req: any, @Query('type') type?: string, @Query('status') status?: string) {
    return this.svc.findAll(req.user.tenantId, type, status);
  }

  @Post('campaigns')
  create(@Request() req: any, @Body() dto: Record<string, unknown>) {
    return this.svc.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get('campaigns/:id')
  findOne(@Request() req: any, @Param('id') id: string) { return this.svc.findOne(req.user.tenantId, id); }

  @Patch('campaigns/:id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.svc.update(req.user.tenantId, id, dto);
  }

  @Delete('campaigns/:id')
  delete(@Request() req: any, @Param('id') id: string) { return this.svc.delete(req.user.tenantId, id); }

  @Post('campaigns/:id/launch')
  launch(@Request() req: any, @Param('id') id: string) { return this.svc.launch(req.user.tenantId, id); }

  @Post('campaigns/:id/pause')
  pause(@Request() req: any, @Param('id') id: string) { return this.svc.pause(req.user.tenantId, id); }

  @Get('campaigns/:id/analytics')
  analytics(@Request() req: any, @Param('id') id: string) { return this.svc.getAnalytics(req.user.tenantId, id); }

  @Get('campaigns/:id/recipients')
  recipients(
    @Request() req: any,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getRecipients(req.user.tenantId, id, parseInt(page || '1'), parseInt(limit || '50'));
  }

  @Post('ai/generate-content')
  generateContent(@Body() dto: { channels: string[]; goal: string; userDescription: string }) {
    return this.svc.generateAiContent(dto);
  }

  @Post('ai/best-schedule-time')
  bestScheduleTime(@Body() dto: { campaignType: string; targetAudience: string; channel: string }) {
    return this.svc.getBestScheduleTime(dto);
  }
}

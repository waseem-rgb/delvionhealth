import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('revenue-crm')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContentController {
  constructor(private svc: ContentService) {}

  @Get('content')
  findAll(
    @Request() req: any,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.svc.findAll(req.user.tenantId, channel, status, type);
  }

  @Get('content/calendar')
  calendar(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.svc.getCalendar(
      req.user.tenantId,
      parseInt(month || String(new Date().getMonth() + 1)),
      parseInt(year || String(new Date().getFullYear())),
    );
  }

  @Post('content')
  create(@Request() req: any, @Body() dto: Record<string, unknown>) {
    return this.svc.create(req.user.tenantId, req.user.sub, dto);
  }

  @Patch('content/:id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.svc.update(req.user.tenantId, id, dto);
  }

  @Delete('content/:id')
  delete(@Request() req: any, @Param('id') id: string) { return this.svc.delete(req.user.tenantId, id); }

  @Post('content/:id/schedule')
  schedule(@Request() req: any, @Param('id') id: string, @Body() dto: { scheduledAt: string }) {
    return this.svc.schedule(req.user.tenantId, id, dto.scheduledAt);
  }

  @Post('content/:id/publish')
  publish(@Request() req: any, @Param('id') id: string) { return this.svc.publish(req.user.tenantId, id); }

  @Post('ai/generate-content-multi')
  generateMulti(@Body() dto: { brief: string; audience: string; tone: string; formats: string[] }) {
    return this.svc.generateMultiChannelContent(dto);
  }
}

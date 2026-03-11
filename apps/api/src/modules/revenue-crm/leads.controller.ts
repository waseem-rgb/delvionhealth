import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('revenue-crm')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LeadsController {
  constructor(private svc: LeadsService) {}

  @Get('leads/stats')
  stats(@Request() req: any) { return this.svc.getStats(req.user.tenantId); }

  @Get('lead-lists')
  getLists(@Request() req: any) { return this.svc.getLeadLists(req.user.tenantId); }

  @Post('lead-lists/upload')
  upload(@Request() req: any, @Body() dto: { listName: string; leads: any[] }) {
    return this.svc.uploadLeads(req.user.tenantId, req.user.sub, dto.listName, dto.leads);
  }

  @Get('lead-lists/:id/leads')
  getListLeads(@Request() req: any, @Param('id') id: string, @Query('page') page?: string) {
    return this.svc.getLeadListLeads(req.user.tenantId, id, parseInt(page || '1'));
  }

  @Get('leads')
  getAllLeads(@Request() req: any, @Query('status') status?: string, @Query('page') page?: string) {
    return this.svc.getAllLeads(req.user.tenantId, status, parseInt(page || '1'));
  }

  @Patch('leads/:id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.svc.updateLead(req.user.tenantId, id, dto);
  }
}

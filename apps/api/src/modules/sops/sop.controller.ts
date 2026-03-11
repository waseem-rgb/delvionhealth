import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { SopService } from './sop.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('sops')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SopController {
  constructor(private svc: SopService) {}

  @Post('generate-all')
  generateAll(@Request() req: any) { return this.svc.startGenerationJob(req.user.tenantId); }

  @Get('generation-status')
  generationStatus(@Request() req: any) { return this.svc.getGenerationStatus(req.user.tenantId); }

  @Get('stats')
  stats(@Request() req: any) { return this.svc.getStats(req.user.tenantId); }

  @Get()
  findAll(
    @Request() req: any,
    @Query('dept') dept?: string,
    @Query('standard') standard?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(req.user.tenantId, {
      dept, standard, status, search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) { return this.svc.findOne(req.user.tenantId, id); }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.update(req.user.tenantId, id, req.user.sub, dto);
  }

  @Post(':id/approve')
  approve(@Request() req: any, @Param('id') id: string) { return this.svc.approve(req.user.tenantId, id, req.user.sub); }

  @Post(':id/regenerate')
  regenerate(@Request() req: any, @Param('id') id: string) { return this.svc.regenerate(req.user.tenantId, id); }

  @Get(':id/versions')
  getVersions(@Request() req: any, @Param('id') id: string) { return this.svc.getVersions(req.user.tenantId, id); }

  @Post(':id/restore/:versionId')
  restoreVersion(@Request() req: any, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.svc.restoreVersion(req.user.tenantId, id, versionId, req.user.sub);
  }
}

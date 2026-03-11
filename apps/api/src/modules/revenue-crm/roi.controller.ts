import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { RoiService } from './roi.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('revenue-crm')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RoiController {
  constructor(private svc: RoiService) {}

  @Get('roi')
  getRoi(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getRoiData(req.user.tenantId, from, to);
  }
}

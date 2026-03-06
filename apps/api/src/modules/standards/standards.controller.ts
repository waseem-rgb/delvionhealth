import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LoincMappingService } from './loinc-mapping.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@delvion/types';

@ApiTags('standards')
@ApiBearerAuth()
@Controller('standards')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StandardsController {
  constructor(private readonly loincService: LoincMappingService) {}

  @Get('loinc/search')
  @ApiOperation({ summary: 'Search LOINC by test name (fuzzy)' })
  search(@Query('q') q: string) {
    if (!q) return null;
    return this.loincService.findByName(q);
  }

  @Get('loinc')
  @ApiOperation({ summary: 'List all LOINC entries' })
  listAll() {
    return this.loincService.getAllEntries();
  }

  @Get('loinc/:code')
  @ApiOperation({ summary: 'Find LOINC entry by code' })
  findByCode(@Param('code') code: string) {
    return this.loincService.findByLoincCode(code);
  }

  @Post('loinc/enrich')
  @ApiOperation({ summary: 'Auto-enrich test catalog with LOINC codes (admin only)' })
  enrichCatalog(@CurrentUser() user: JwtPayload) {
    return this.loincService.enrichTestCatalog(user.tenantId);
  }
}

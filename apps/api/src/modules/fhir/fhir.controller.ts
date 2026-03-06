import { Controller, Get, Post, Param, Query, Body, Header, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FhirService } from './fhir.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@delvion/types';

@ApiTags('fhir')
@Controller('fhir')
export class FhirController {
  constructor(private readonly fhirService: FhirService) {}

  @Get('metadata')
  @Header('Content-Type', 'application/fhir+json')
  getCapabilityStatement() {
    return this.fhirService.getCapabilityStatement();
  }

  @Get('Patient/:id')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getPatient(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fhirService.getPatient(id, user.tenantId);
  }

  @Get('Patient')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  searchPatients(
    @CurrentUser() user: JwtPayload,
    @Query('name') name?: string,
    @Query('identifier') identifier?: string,
  ) {
    return this.fhirService.searchPatients({ name, identifier }, user.tenantId);
  }

  @Post('Patient')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  createPatient(@Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.fhirService.createPatient(body, user.tenantId);
  }

  @Get('DiagnosticReport')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getDiagnosticReport(@Query('subject') subject: string, @CurrentUser() user: JwtPayload) {
    return this.fhirService.getDiagnosticReport(subject, user.tenantId);
  }

  @Get('Observation/:id')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getObservation(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fhirService.getObservation(id, user.tenantId);
  }

  @Get('Observation')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  searchObservations(@Query('subject') subject: string, @CurrentUser() user: JwtPayload) {
    return this.fhirService.searchObservations(subject, user.tenantId);
  }

  @Get('ServiceRequest/:id')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getServiceRequest(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fhirService.getServiceRequest(id, user.tenantId);
  }

  @Post('ServiceRequest')
  @ApiBearerAuth()
  @Header('Content-Type', 'application/fhir+json')
  @UseGuards(JwtAuthGuard, TenantGuard)
  createServiceRequest(@Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
    return this.fhirService.createServiceRequest(body, user.tenantId);
  }
}

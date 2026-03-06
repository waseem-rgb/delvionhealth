import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { PortalService } from "./portal.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal")
@UseGuards(JwtAuthGuard, TenantGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get("bookings")
  @ApiOperation({ summary: "Patient bookings/appointments" })
  getBookings(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string) {
    return this.portalService.getBookings(patientId, user.tenantId);
  }

  @Get("reports")
  @ApiOperation({ summary: "Patient lab reports" })
  getReports(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string) {
    return this.portalService.getReports(patientId, user.tenantId);
  }

  @Get("track")
  @ApiOperation({ summary: "Track sample by MRN" })
  @ApiQuery({ name: "mrn", required: true })
  trackSample(@CurrentUser() user: JwtPayload, @Query("mrn") mrn: string) {
    return this.portalService.trackSample(mrn, user.tenantId);
  }

  @Get("profile")
  @ApiOperation({ summary: "Get patient profile" })
  getProfile(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string) {
    return this.portalService.getProfile(patientId, user.tenantId);
  }

  @Post("profile")
  @ApiOperation({ summary: "Update patient profile" })
  updateProfile(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string, @Body() dto: Record<string, unknown>) {
    return this.portalService.updateProfile(patientId, dto, user.tenantId);
  }

  @Get("health-insights")
  @ApiOperation({ summary: "Patient health insights + score" })
  getHealthInsights(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string) {
    return this.portalService.getHealthInsights(patientId, user.tenantId);
  }

  @Get("health-insights/trends")
  @ApiOperation({ summary: "Health trend for a specific test" })
  @ApiQuery({ name: "testCatalogId", required: true })
  getHealthTrends(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string, @Query("testCatalogId") testCatalogId: string) {
    return this.portalService.getHealthTrends(patientId, testCatalogId, user.tenantId);
  }

  @Get("family")
  @ApiOperation({ summary: "Get family profiles" })
  getFamilyProfiles(@CurrentUser() user: JwtPayload, @Query("patientId") patientId: string) {
    return this.portalService.getFamilyProfiles(patientId, user.tenantId);
  }

  @Post("family")
  @ApiOperation({ summary: "Add family member" })
  addFamilyMember(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { primaryPatientId: string; memberPatientId: string; relationship: string }
  ) {
    return this.portalService.addFamilyMember(dto.primaryPatientId, dto.memberPatientId, dto.relationship, user.tenantId);
  }

  @Delete("family/:id")
  @ApiOperation({ summary: "Remove family member" })
  removeFamilyMember(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Query("primaryPatientId") primaryPatientId: string) {
    return this.portalService.removeFamilyMember(id, primaryPatientId, user.tenantId);
  }
}

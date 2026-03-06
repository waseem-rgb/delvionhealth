import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AppointmentsService } from "./appointments.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("appointments")
@ApiBearerAuth()
@Controller("appointments")
@UseGuards(JwtAuthGuard, TenantGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: "List appointments" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("date") date?: string,
    @Query("limit") limit?: string
  ) {
    return this.appointmentsService.findAll(user.tenantId, {
      status,
      date,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update appointment status" })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { status: string }
  ) {
    return this.appointmentsService.updateStatus(id, user.tenantId, body.status);
  }

  @Post(":id/remind")
  @ApiOperation({ summary: "Send reminder for appointment" })
  sendReminder(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.appointmentsService.sendReminder(id, user.tenantId);
  }
}

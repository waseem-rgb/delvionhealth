import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { InstrumentsService, CreateLoggerDto } from "./instruments.service";
import { NotificationsService } from "../notifications/notifications.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";
import type { TempUnit } from "@prisma/client";

@ApiTags("temperature")
@Controller("temperature")
export class TemperatureController {
  constructor(
    private readonly instrumentsService: InstrumentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get("loggers")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  findLoggers(@CurrentUser() user: JwtPayload) {
    return this.instrumentsService.findLoggers(user.tenantId);
  }

  @Post("loggers")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  createLogger(@Body() dto: CreateLoggerDto, @CurrentUser() user: JwtPayload) {
    return this.instrumentsService.createLogger(dto, user.tenantId);
  }

  @Put("loggers/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateLogger(
    @Param("id") id: string,
    @Body() dto: Partial<CreateLoggerDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instrumentsService.updateLogger(id, dto, user.tenantId);
  }

  @Get("loggers/:id/readings")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  findReadings(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.instrumentsService.findReadings(
      id,
      user.tenantId,
      from,
      to,
      limit ? parseInt(limit, 10) : 500,
    );
  }

  @Get("loggers/:id/alert-summary")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  alertSummary(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.instrumentsService.getAlertSummary(id, user.tenantId, from, to);
  }

  // API-key authenticated endpoint (no JWT) for IoT devices
  @Post("readings")
  async ingestReading(
    @Headers("x-logger-key") apiKey: string,
    @Body() body: { temperature: number; unit?: TempUnit; recordedAt?: string },
  ) {
    if (!apiKey) throw new UnauthorizedException("Missing X-Logger-Key header");

    const unit: TempUnit = body.unit ?? "CELSIUS";
    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
    const result = await this.instrumentsService.ingestReading(apiKey, body.temperature, unit, recordedAt);

    if (!result) throw new UnauthorizedException("Invalid API key");

    // Fire alert notification if out of range (non-blocking)
    if (result.isAlert) {
      this.notificationsService.sendToRole(
        result.logger.tenantId,
        Role.LAB_MANAGER,
        {
          title: "Temperature Alert",
          body: `${result.logger.name} (${result.logger.location ?? ""}): ${body.temperature}${unit === "CELSIUS" ? "\u00b0C" : "\u00b0F"} is out of range [${result.logger.alertMin}\u2013${result.logger.alertMax}]`,
          type: "TEMPERATURE_ALERT",
          entityId: result.logger.id,
          entityType: "TemperatureLogger",
        },
      ).catch(() => {});
    }

    return { received: true, isAlert: result.isAlert };
  }
}

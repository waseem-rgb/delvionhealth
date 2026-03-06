import { Controller, Get, Post, Put, Delete, Query, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { InstrumentsService, CreateConnectionDto, UpdateConnectionDto } from "./instruments.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("instruments")
@ApiBearerAuth()
@Controller("instruments")
@UseGuards(JwtAuthGuard, TenantGuard)
export class InstrumentsController {
  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get()
  @ApiOperation({ summary: "List instruments" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    return this.instrumentsService.findAll(user.tenantId, { status, limit: limit ? parseInt(limit, 10) : 50 });
  }

  @Get("messages/stats")
  @ApiOperation({ summary: "Get message stats for last 24h" })
  getMessageStats(@CurrentUser() user: JwtPayload) {
    return this.instrumentsService.getMessageStats(user.tenantId);
  }

  @Get("messages")
  @ApiOperation({ summary: "List instrument messages" })
  findMessages(
    @CurrentUser() user: JwtPayload,
    @Query("connectionId") connectionId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.instrumentsService.findMessages(user.tenantId, {
      connectionId, from, to, status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Put("connections/:connId")
  @ApiOperation({ summary: "Update instrument connection" })
  updateConnection(
    @Param("connId") connId: string,
    @Body() dto: UpdateConnectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instrumentsService.updateConnection(connId, dto, user.tenantId);
  }

  @Delete("connections/:connId")
  @ApiOperation({ summary: "Delete instrument connection" })
  deleteConnection(@Param("connId") connId: string, @CurrentUser() user: JwtPayload) {
    return this.instrumentsService.deleteConnection(connId, user.tenantId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get instrument by ID" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.instrumentsService.findOne(id, user.tenantId);
  }

  @Get(":id/connections")
  @ApiOperation({ summary: "List connections for an instrument" })
  findConnections(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.instrumentsService.findConnections(id, user.tenantId);
  }

  @Post(":id/connections")
  @ApiOperation({ summary: "Create a connection for an instrument" })
  createConnection(
    @Param("id") id: string,
    @Body() dto: CreateConnectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instrumentsService.createConnection(id, dto, user.tenantId);
  }
}

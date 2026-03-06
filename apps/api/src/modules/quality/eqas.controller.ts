import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { EqasService } from "./eqas.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("quality/eqas")
@ApiBearerAuth()
@Controller("quality/eqas")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.LAB_MANAGER)
export class EqasController {
  constructor(private readonly eqasService: EqasService) {}

  @Post("rounds")
  @ApiOperation({ summary: "Create an EQAS round" })
  createRound(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      programName: string;
      roundNumber: string;
      year: number;
      scheme?: string;
      department?: string;
      startDate?: string;
      endDate?: string;
      dueDate?: string;
      notes?: string;
    },
  ) {
    return this.eqasService.createRound(user.tenantId, user.sub, dto);
  }

  @Get("rounds")
  @ApiOperation({ summary: "List EQAS rounds" })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiQuery({ name: "department", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getRounds(
    @CurrentUser() user: JwtPayload,
    @Query("year") year?: number,
    @Query("department") department?: string,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.eqasService.getRounds(user.tenantId, {
      year: year ? Number(year) : undefined,
      department, status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post("rounds/:id/results")
  @ApiOperation({ summary: "Submit results for an EQAS round" })
  submitResults(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: {
      results: Array<{
        analyte: string;
        parameter?: string;
        assignedValue?: number;
        reportedValue?: number;
        yourValue?: number;
        peerMean?: number;
        peerSD?: number;
        acceptableRange?: string;
        evaluation?: string;
        notes?: string;
      }>;
    },
  ) {
    return this.eqasService.submitResults(user.tenantId, user.sub, id, dto.results);
  }
}

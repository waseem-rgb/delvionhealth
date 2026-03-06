import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { AccessionService } from "./accession.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("lab-accession")
@ApiBearerAuth()
@Controller("lab/accession")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.TENANT_ADMIN,
  Role.LAB_MANAGER,
  Role.LAB_TECHNICIAN,
  Role.FRONT_DESK,
)
export class AccessionController {
  constructor(private readonly accessionService: AccessionService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get accession stats for today" })
  @ApiQuery({ name: "date", required: false })
  getStats(
    @CurrentUser() user: JwtPayload,
    @Query("date") date?: string,
  ) {
    return this.accessionService.getAccessionStats(user.tenantId, date);
  }

  @Get()
  @ApiOperation({ summary: "Get orders pending accession" })
  @ApiQuery({ name: "date", required: false })
  @ApiQuery({ name: "collectionType", required: false })
  @ApiQuery({ name: "isStatOnly", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getAccessionList(
    @CurrentUser() user: JwtPayload,
    @Query("date") date?: string,
    @Query("collectionType") collectionType?: string,
    @Query("isStatOnly") isStatOnly?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.accessionService.getAccessionList(user.tenantId, {
      date,
      collectionType,
      isStatOnly: isStatOnly === "true",
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("order/:orderId/tubes")
  @ApiOperation({ summary: "Get tubes required for accession" })
  getTubesForOrder(
    @Param("orderId") orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accessionService.getAccessionTubesForOrder(orderId, user.tenantId);
  }

  @Post("submit")
  @ApiOperation({ summary: "Submit tube-by-tube accession" })
  submitAccession(
    @Body() body: {
      orderId: string;
      tubes: { tubeKey: string; barcode: string; testIds: string[] }[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accessionService.submitAccession(
      body.orderId,
      body.tubes,
      user.tenantId,
      user.sub,
    );
  }

  @Post(":id/receive")
  @ApiOperation({ summary: "Receive/accession a sample" })
  accessionSample(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accessionService.accessionSample(id, user.sub, user.tenantId);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a sample" })
  rejectSample(
    @Param("id") id: string,
    @Body() body: { reason: string; note: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accessionService.rejectSample(
      id,
      body.reason,
      body.note,
      user.sub,
      user.tenantId,
    );
  }

  @Post("bulk-receive")
  @ApiOperation({ summary: "Bulk receive multiple orders" })
  bulkAccession(
    @Body() body: { orderIds: string[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.accessionService.bulkAccession(
      body.orderIds,
      user.sub,
      user.tenantId,
    );
  }
}

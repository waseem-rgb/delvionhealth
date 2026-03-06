import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { OutsourcingService } from "./outsourcing.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("outsourcing")
@ApiBearerAuth()
@Controller("outsourcing")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OutsourcingController {
  constructor(private readonly outsourcingService: OutsourcingService) {}

  // POST /outsourcing
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create an outsource request for an order" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { orderId: string; reflabId: string; testIds: string[] },
  ) {
    return this.outsourcingService.createOutsource(
      user.tenantId,
      body.orderId,
      body.reflabId,
      body.testIds,
      user.sub,
    );
  }

  // GET /outsourcing
  @Get()
  @ApiOperation({ summary: "List outsourced samples with filters" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "reflabId", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("status") status?: string,
    @Query("reflabId") reflabId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.outsourcingService.findAll(user.tenantId, {
      status,
      reflabId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // GET /outsourcing/pending-dispatch
  @Get("pending-dispatch")
  @ApiOperation({ summary: "Get all samples pending dispatch to reference labs" })
  getPendingDispatch(@CurrentUser() user: JwtPayload) {
    return this.outsourcingService.getPendingDispatch(user.tenantId);
  }

  // GET /outsourcing/awaiting-results
  @Get("awaiting-results")
  @ApiOperation({ summary: "Get all dispatched samples awaiting results" })
  getAwaitingResults(@CurrentUser() user: JwtPayload) {
    return this.outsourcingService.getAwaitingResults(user.tenantId);
  }

  // PUT /outsourcing/:id/dispatch
  @Put(":id/dispatch")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN)
  @ApiOperation({ summary: "Mark outsourced sample as dispatched" })
  dispatch(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { dispatchRef: string },
  ) {
    return this.outsourcingService.dispatchToReflab(id, body.dispatchRef, user.tenantId);
  }

  // PUT /outsourcing/:id/received
  @Put(":id/received")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN)
  @ApiOperation({ summary: "Mark outsourced sample as received by reference lab" })
  markReceived(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.outsourcingService.markReceivedByReflab(id, user.tenantId);
  }

  // POST /outsourcing/:id/results
  @Post(":id/results")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.LAB_TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Enter results received from reference lab" })
  receiveResults(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { results: Array<{ testCatalogId: string; value: string; unit?: string }> },
  ) {
    return this.outsourcingService.receiveResults(id, body.results, user.tenantId, user.sub);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { SamplesService } from "./samples.service";
import {
  AccessionSampleDto,
  UpdateSampleStatusDto,
  MoveSampleDto,
  RejectSampleDto,
} from "./dto/accession-sample.dto";
import { QuerySampleDto } from "./dto/query-sample.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role, SampleStatus } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("samples")
@ApiBearerAuth()
@Controller("samples")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SamplesController {
  constructor(private readonly samplesService: SamplesService) {}

  @Post("accession")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.LAB_TECHNICIAN,
    Role.PHLEBOTOMIST,
    Role.FRONT_DESK
  )
  @ApiOperation({ summary: "Accession (register) a new sample with barcode" })
  accession(@CurrentUser() user: JwtPayload, @Body() dto: AccessionSampleDto) {
    return this.samplesService.accession(user.tenantId, user.sub, dto);
  }

  @Get("counts")
  @ApiOperation({ summary: "Get sample counts by status" })
  @ApiQuery({ name: "branchId", required: false })
  getCounts(
    @CurrentUser() user: JwtPayload,
    @Query("branchId") branchId?: string
  ) {
    return this.samplesService.getCounts(user.tenantId, branchId);
  }

  @Get("queue")
  @ApiOperation({ summary: "Get prioritised sample queue" })
  @ApiQuery({ name: "branchId", required: false })
  getQueue(
    @CurrentUser() user: JwtPayload,
    @Query("branchId") branchId?: string
  ) {
    return this.samplesService.getQueue(user.tenantId, branchId);
  }

  @Get("order/:orderId")
  @ApiOperation({ summary: "Get all samples for an order" })
  getSamplesByOrder(
    @CurrentUser() user: JwtPayload,
    @Param("orderId") orderId: string
  ) {
    return this.samplesService.getSamplesByOrder(orderId, user.tenantId);
  }

  @Get("barcode/:barcodeId")
  @ApiOperation({ summary: "Find sample by barcode" })
  findByBarcode(
    @CurrentUser() user: JwtPayload,
    @Param("barcodeId") barcodeId: string
  ) {
    return this.samplesService.findByBarcode(user.tenantId, barcodeId);
  }

  @Get()
  @ApiOperation({ summary: "List samples" })
  @ApiQuery({ name: "status", required: false, enum: SampleStatus })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QuerySampleDto
  ) {
    return this.samplesService.findAll(user.tenantId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get sample details" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.samplesService.findOne(user.tenantId, id);
  }

  @Get(":id/custody")
  @ApiOperation({ summary: "Get chain of custody for a sample" })
  getChainOfCustody(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.samplesService.getChainOfCustody(id, user.tenantId);
  }

  @Put(":id/status")
  @Roles(
    Role.SUPER_ADMIN,
    Role.LAB_MANAGER,
    Role.LAB_TECHNICIAN,
    Role.PHLEBOTOMIST
  )
  @ApiOperation({ summary: "Update sample status" })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateSampleStatusDto
  ) {
    return this.samplesService.updateStatus(user.tenantId, id, user.sub, dto);
  }

  @Put(":id/move")
  @Roles(
    Role.SUPER_ADMIN,
    Role.LAB_MANAGER,
    Role.LAB_TECHNICIAN,
    Role.PHLEBOTOMIST
  )
  @ApiOperation({ summary: "Move sample to a different location" })
  move(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: MoveSampleDto
  ) {
    return this.samplesService.move(user.tenantId, id, user.sub, dto);
  }

  @Put(":id/reject")
  @Roles(
    Role.SUPER_ADMIN,
    Role.LAB_MANAGER,
    Role.LAB_TECHNICIAN,
    Role.PATHOLOGIST
  )
  @ApiOperation({ summary: "Reject a sample" })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: RejectSampleDto
  ) {
    return this.samplesService.reject(user.tenantId, id, user.sub, dto);
  }
}

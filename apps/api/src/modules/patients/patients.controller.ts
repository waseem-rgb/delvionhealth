import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { PatientsService } from "./patients.service";
import { MergePatientsService } from "./merge-patients.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { QueryPatientDto } from "./dto/query-patient.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly mergePatientsService: MergePatientsService,
  ) {}

  // POST /patients
  @Post()
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK,
    Role.PHLEBOTOMIST
  )
  @ApiOperation({ summary: "Register a new patient" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePatientDto
  ) {
    return this.patientsService.create(user.tenantId, dto);
  }

  // GET /patients
  @Get()
  @ApiOperation({ summary: "List patients with search and pagination" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryPatientDto
  ) {
    return this.patientsService.findAll(user.tenantId, query);
  }

  // GET /patients/search?q=
  @Get("search")
  @ApiOperation({ summary: "Quick patient search (CommandPalette)" })
  @ApiQuery({ name: "q", required: true })
  search(
    @CurrentUser() user: JwtPayload,
    @Query("q") q: string
  ) {
    return this.patientsService.search(user.tenantId, q ?? "");
  }

  // GET /patients/search/phone?q=
  @Get("search/phone")
  @ApiOperation({ summary: "Search patients by phone number (Registration)" })
  @ApiQuery({ name: "q", required: true })
  searchByPhone(
    @CurrentUser() user: JwtPayload,
    @Query("q") q: string
  ) {
    return this.patientsService.searchByPhone(user.tenantId, q ?? "");
  }

  // GET /patients/mrn/preview
  @Get("mrn/preview")
  @ApiOperation({ summary: "Preview the next MRN that will be assigned" })
  previewMrn(@CurrentUser() user: JwtPayload) {
    return this.patientsService.previewMrn(user.tenantId);
  }

  // GET /patients/duplicates
  @Get("duplicates")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Find potential duplicate patients (by phone)" })
  findDuplicates(@CurrentUser() user: JwtPayload) {
    return this.mergePatientsService.findDuplicates(user.tenantId);
  }

  // POST /patients/merge
  @Post("merge")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Merge two patient records (keep one, deactivate other)" })
  mergePatients(
    @CurrentUser() user: JwtPayload,
    @Body() body: { keepId: string; mergeId: string },
  ) {
    return this.mergePatientsService.mergePatients(
      body.keepId,
      body.mergeId,
      user.tenantId,
      user.sub,
    );
  }

  // GET /patients/mrn/:mrn
  @Get("mrn/:mrn")
  @ApiOperation({ summary: "Find patient by MRN" })
  findByMrn(
    @CurrentUser() user: JwtPayload,
    @Param("mrn") mrn: string
  ) {
    return this.patientsService.findByMrn(user.tenantId, mrn);
  }

  // GET /patients/:id
  @Get(":id")
  @ApiOperation({ summary: "Get patient details" })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.patientsService.findOne(user.tenantId, id);
  }

  // GET /patients/:id/timeline
  @Get(":id/timeline")
  @ApiOperation({ summary: "Get chronological activity timeline for a patient" })
  getTimeline(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.patientsService.getTimeline(user.tenantId, id);
  }

  // GET /patients/:id/stats
  @Get(":id/stats")
  @ApiOperation({ summary: "Get summary statistics for a patient" })
  getStats(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.patientsService.getStats(user.tenantId, id);
  }

  // GET /patients/:id/orders
  @Get(":id/orders")
  @ApiOperation({ summary: "Get paginated orders for a patient" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getPatientOrders(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.patientsService.getPatientOrders(
      user.tenantId,
      id,
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 20
    );
  }

  // PUT /patients/:id
  @Put(":id")
  @Roles(
    Role.SUPER_ADMIN,
    Role.TENANT_ADMIN,
    Role.LAB_MANAGER,
    Role.FRONT_DESK
  )
  @ApiOperation({ summary: "Update patient record" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdatePatientDto
  ) {
    return this.patientsService.update(user.tenantId, id, dto);
  }

  // DELETE /patients/:id
  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete patient (blocks if active orders exist)" })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string
  ) {
    return this.patientsService.softDelete(user.tenantId, id);
  }
}

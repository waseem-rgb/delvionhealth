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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ReferencelabService } from "./referencelab.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("reference-labs")
@ApiBearerAuth()
@Controller("reference-labs")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReferencelabController {
  constructor(private readonly reflabService: ReferencelabService) {}

  // GET /reference-labs
  @Get()
  @ApiOperation({ summary: "List all active reference labs" })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.reflabService.findAll(user.tenantId);
  }

  // POST /reference-labs
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new reference lab" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name: string;
      code: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
    },
  ) {
    return this.reflabService.create(user.tenantId, body);
  }

  // GET /reference-labs/:id
  @Get(":id")
  @ApiOperation({ summary: "Get reference lab details with tests" })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.reflabService.findOne(user.tenantId, id);
  }

  // PUT /reference-labs/:id
  @Put(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update reference lab details" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      code?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
    },
  ) {
    return this.reflabService.update(user.tenantId, id, body);
  }

  // DELETE /reference-labs/:id
  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a reference lab" })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    return this.reflabService.remove(user.tenantId, id);
  }

  // POST /reference-labs/:id/tests
  @Post(":id/tests")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add or update test mappings for a reference lab" })
  addTests(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body()
    body: {
      tests: Array<{
        testCatalogId: string;
        externalCode?: string;
        cost: number;
        tat: number;
      }>;
    },
  ) {
    return this.reflabService.addTests(user.tenantId, id, body.tests);
  }

  // DELETE /reference-labs/:id/tests/:testCatalogId
  @Delete(":id/tests/:testCatalogId")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a test mapping from a reference lab" })
  removeTest(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("testCatalogId") testCatalogId: string,
  ) {
    return this.reflabService.removeTest(user.tenantId, id, testCatalogId);
  }

  // GET /reference-labs/:id/cost?testIds=id1,id2
  @Get(":id/cost")
  @ApiOperation({ summary: "Calculate outsourcing cost for selected tests" })
  @ApiQuery({ name: "testIds", required: true, description: "Comma-separated test catalog IDs" })
  calculateCost(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query("testIds") testIds: string,
  ) {
    const ids = testIds.split(",").map((id) => id.trim()).filter(Boolean);
    return this.reflabService.calculateCost(user.tenantId, id, ids);
  }
}

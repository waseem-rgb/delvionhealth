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
import { OrganizationService } from "./organization.service";
import type { CreateOrganizationDto, UpdateOrganizationDto } from "./organization.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("organizations")
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: "List organizations with search and pagination" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.orgService.findAll(user.tenantId, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new organization" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgService.create(user.tenantId, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get organization by ID with stats" })
  findOne(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orgService.findOne(user.tenantId, id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update organization" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orgService.update(user.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-delete organization (set isActive=false)" })
  remove(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orgService.remove(user.tenantId, id);
  }
}

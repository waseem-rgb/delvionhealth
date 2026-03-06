import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";
import type { Role } from "@delvion/types";
import { IsString, IsEmail, IsOptional, IsBoolean } from "class-validator";

class InviteUserDto {
  @IsEmail() email!: string;
  @IsString() role!: Role;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() branchId?: string;
}

class UpdateRoleDto {
  @IsString() role!: Role;
}

class UpdateStatusDto {
  @IsBoolean() isActive!: boolean;
}

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List users for tenant" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "role", required: false })
  @ApiQuery({ name: "isActive", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("role") role?: Role,
    @Query("isActive") isActive?: string,
  ) {
    return this.usersService.findAll(user.tenantId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post("invite")
  @ApiOperation({ summary: "Invite a new team member" })
  invite(@Body() dto: InviteUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.invite(dto, user.tenantId);
  }

  @Put(":id/role")
  @ApiOperation({ summary: "Update user role" })
  updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateRole(id, dto.role, user.tenantId);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Activate or deactivate user" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateStatus(id, dto.isActive, user.tenantId, user.sub);
  }
}

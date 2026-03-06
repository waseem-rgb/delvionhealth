import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import { DoctorsService } from "./doctors.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("doctors")
@ApiBearerAuth()
@Controller("doctors")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @ApiOperation({ summary: "List doctors" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "isActive", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("search") search?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.doctorsService.findAll(user.tenantId, {
      search,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
  }

  @Get("for-signing")
  @ApiOperation({ summary: "Get doctors for report signing by department" })
  @ApiQuery({ name: "department", required: false })
  findForSigning(
    @CurrentUser() user: JwtPayload,
    @Query("department") department?: string,
  ) {
    return this.doctorsService.findForSigning(user.tenantId, department);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Create doctor" })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.doctorsService.create(
      user.tenantId,
      body as Parameters<DoctorsService["create"]>[1],
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get doctor details" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.doctorsService.findOne(id, user.tenantId);
  }

  @Put(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Update doctor" })
  update(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.doctorsService.update(id, user.tenantId, body);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-delete doctor" })
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.doctorsService.softDelete(id, user.tenantId);
  }

  @Post(":id/upload-signature")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload doctor signature image" })
  uploadSignature(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.doctorsService.uploadSignature(id, user.tenantId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
  }

  @Post(":id/generate-passkey")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER)
  @ApiOperation({ summary: "Generate random passkey for doctor" })
  generatePasskey(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.doctorsService.generatePasskey(id, user.tenantId);
  }

  @Post(":id/login")
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: "Create login credentials for doctor" })
  createLogin(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { loginUsername: string; loginPassword: string },
  ) {
    return this.doctorsService.createLogin(id, user.tenantId, body);
  }
}

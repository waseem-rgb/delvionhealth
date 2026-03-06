import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { DocumentService } from "./document.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("quality/documents")
@ApiBearerAuth()
@Controller("quality/documents")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.TENANT_ADMIN, Role.LAB_MANAGER)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @ApiOperation({ summary: "Create a quality document" })
  createDocument(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      title: string;
      type?: string;
      category?: string;
      version?: string;
      content?: string;
      fileUrl?: string;
      docNumber?: string;
      certType?: string;
      issuerName?: string;
      issuedDate?: string;
      expiryDate?: string;
      nextReviewDate?: string;
    },
  ) {
    return this.documentService.createDocument(user.tenantId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List quality documents" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  getDocuments(
    @CurrentUser() user: JwtPayload,
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.documentService.getDocuments(user.tenantId, {
      category, status, type,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get("vault-status")
  @ApiOperation({ summary: "Get document vault status by type" })
  getVaultStatus(@CurrentUser() user: JwtPayload) {
    return this.documentService.getVaultStatus(user.tenantId);
  }

  @Get("expiring")
  @ApiOperation({ summary: "Get documents expiring soon" })
  @ApiQuery({ name: "days", required: false, type: Number })
  getExpiringDocuments(
    @CurrentUser() user: JwtPayload,
    @Query("days") days?: number,
  ) {
    return this.documentService.getExpiringDocuments(user.tenantId, days ? Number(days) : 90);
  }

  @Patch(":id/approve")
  @ApiOperation({ summary: "Approve a document" })
  approveDocument(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.documentService.approveDocument(user.tenantId, id, user.sub);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a document" })
  updateDocument(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: {
      title?: string;
      category?: string;
      version?: string;
      content?: string;
      fileUrl?: string;
      status?: string;
      expiryDate?: string;
      nextReviewDate?: string;
    },
  ) {
    return this.documentService.updateDocument(user.tenantId, id, user.sub, dto);
  }
}

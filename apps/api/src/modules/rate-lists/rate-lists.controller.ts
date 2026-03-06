import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from "@nestjs/swagger";
import type { Response } from "express";
import { RateListsService } from "./rate-lists.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@delvion/types";
import type { JwtPayload } from "@delvion/types";

@ApiTags("rate-lists")
@ApiBearerAuth()
@Controller("rate-lists")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE)
export class RateListsController {
  constructor(private readonly rateListsService: RateListsService) {}

  @Get()
  @ApiOperation({ summary: "List all rate lists" })
  @ApiQuery({ name: "listType", required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("listType") listType?: string,
  ) {
    return this.rateListsService.findAll(user.tenantId, listType);
  }

  @Get("default")
  @ApiOperation({ summary: "Get default rate list" })
  getDefault(@CurrentUser() user: JwtPayload) {
    return this.rateListsService.getDefaultRateList(user.tenantId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get rate list with items" })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.rateListsService.findOne(id, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: "Create rate list" })
  create(
    @Body() body: {
      name: string;
      description?: string;
      isDefault?: boolean;
      listType?: string;
      startDate?: string;
      endDate?: string;
      copiedFromId?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rateListsService.create(user.tenantId, body);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update rate list" })
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean; startDate?: string | null; endDate?: string | null },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rateListsService.update(id, user.tenantId, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete rate list" })
  delete(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.rateListsService.delete(id, user.tenantId);
  }

  @Post(":id/set-default")
  @ApiOperation({ summary: "Set rate list as default" })
  setDefault(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.rateListsService.setDefault(id, user.tenantId);
  }

  @Get(":id/items")
  @ApiOperation({ summary: "Get rate list items" })
  getItems(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.rateListsService.getItems(id, user.tenantId);
  }

  @Put(":id/items")
  @ApiOperation({ summary: "Bulk update prices (with audit log)" })
  bulkUpdatePrices(
    @Param("id") id: string,
    @Body() body: { items: { testCatalogId: string; price: number; isActive?: boolean }[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rateListsService.bulkUpdatePrices(id, user.tenantId, user.sub, body.items);
  }

  @Get(":id/audit")
  @ApiOperation({ summary: "Get price change audit log" })
  getAudit(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.rateListsService.getAuditLog(id, user.tenantId);
  }

  @Post(":id/upload")
  @ApiOperation({ summary: "Upload Excel to update rate list prices" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  async uploadList(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.rateListsService.uploadRateList(id, file.buffer, user.sub, user.tenantId);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Download rate list as Excel" })
  async downloadList(
    @Param("id") id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const XLSX = await import("xlsx");
    const data = await this.rateListsService.getDownloadData(id, user.tenantId);

    const headers = [
      "Code", "Test Name", "Department", "Category", "Sample Type",
      "TAT (hours)", "MRP (\u20B9)", "List Price (\u20B9)", "Concession %", "Active",
    ];
    const rows = data.items.map((i) => [
      i.code, i.name, i.department, i.category, i.sampleType,
      i.tat, i.mrp, i.listPrice, i.concession, i.isActive ? "Yes" : "No",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [10, 40, 15, 15, 15, 10, 12, 12, 10, 8].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, data.listName.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${data.listName.replace(/[^a-zA-Z0-9 ]/g, "")}_${dateStr}.xlsx"`,
    });
    res.send(buf);
  }
}

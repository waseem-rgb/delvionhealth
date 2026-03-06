import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ProcurementService } from "./procurement.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtPayload } from "@delvion/types";

@ApiTags("procurement")
@ApiBearerAuth()
@Controller("procurement")
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get("vendors")
  @ApiOperation({ summary: "List vendors" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findVendors(@CurrentUser() user: JwtPayload, @Query("search") search?: string, @Query("page") page?: number, @Query("limit") limit?: number) {
    return this.procurementService.findVendors(user.tenantId, { search, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Post("vendors")
  @ApiOperation({ summary: "Create vendor" })
  createVendor(@CurrentUser() user: JwtPayload, @Body() dto: { name: string; contactPerson?: string; email?: string; phone?: string; address?: string; gstNumber?: string; paymentTerms?: number }) {
    return this.procurementService.createVendor(dto, user.tenantId);
  }

  @Put("vendors/:id")
  @ApiOperation({ summary: "Update vendor" })
  updateVendor(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.procurementService.updateVendor(id, dto, user.tenantId);
  }

  @Post("vendors/:id/rate")
  @ApiOperation({ summary: "Rate vendor (1-5 stars)" })
  rateVendor(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { rating: number }) {
    return this.procurementService.rateVendor(id, dto.rating, user.tenantId);
  }

  @Get("grn")
  @ApiOperation({ summary: "List GRNs" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findGRNs(@CurrentUser() user: JwtPayload, @Query("status") status?: string, @Query("page") page?: number, @Query("limit") limit?: number) {
    return this.procurementService.findGRNs(user.tenantId, { status, page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 });
  }

  @Post("grn")
  @ApiOperation({ summary: "Create GRN" })
  createGRN(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { vendorId: string; purchaseOrderId?: string; notes?: string; items: Array<{ inventoryItemId: string; quantityOrdered: number; quantityReceived: number; unitPrice: number; expiryDate?: string; lotNumber?: string }> }
  ) {
    return this.procurementService.createGRN(dto, user.tenantId, user.sub);
  }

  @Post("grn/:id/receive")
  @ApiOperation({ summary: "Receive GRN (updates stock)" })
  receiveGRN(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.procurementService.receiveGRN(id, user.tenantId, user.sub);
  }

  @Get("grn/:id")
  @ApiOperation({ summary: "Get GRN detail" })
  findOneGRN(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.procurementService.findOneGRN(id, user.tenantId);
  }

  @Get("inventory/lots")
  @ApiOperation({ summary: "Inventory items with FIFO lots" })
  getInventoryWithLots(@CurrentUser() user: JwtPayload) {
    return this.procurementService.getInventoryWithLots(user.tenantId);
  }

  @Post("inventory/:id/consume")
  @ApiOperation({ summary: "Consume inventory (FIFO)" })
  consumeInventory(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: { quantity: number }) {
    return this.procurementService.consumeInventory(id, dto.quantity, user.tenantId);
  }

  @Post("low-stock-check")
  @ApiOperation({ summary: "Manual trigger: auto-PO for low stock" })
  checkLowStock(@CurrentUser() user: JwtPayload) {
    return this.procurementService.checkLowStock(user.tenantId);
  }
}

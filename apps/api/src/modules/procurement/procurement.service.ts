import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Vendors ──────────────────────────────────

  async createVendor(dto: { name: string; contactPerson?: string; email?: string; phone?: string; address?: string; gstNumber?: string; paymentTerms?: number }, tenantId: string) {
    return this.prisma.vendor.create({ data: { tenantId, ...dto } });
  }

  async findVendors(tenantId: string, query: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId, isActive: true };
    if (query.search) where["name"] = { contains: query.search, mode: "insensitive" };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
      this.prisma.vendor.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateVendor(id: string, dto: Record<string, unknown>, tenantId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId } });
    if (!vendor) throw new NotFoundException("Vendor not found");
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  async rateVendor(id: string, rating: number, tenantId: string) {
    return this.prisma.vendor.update({ where: { id }, data: { rating } });
  }

  // ── GRN ──────────────────────────────────────

  async createGRN(
    dto: {
      vendorId: string;
      purchaseOrderId?: string;
      notes?: string;
      items: Array<{ inventoryItemId: string; quantityOrdered: number; quantityReceived: number; unitPrice: number; expiryDate?: string; lotNumber?: string }>;
    },
    tenantId: string,
    userId: string
  ) {
    const totalAmount = dto.items.reduce((s, i) => s + i.quantityReceived * i.unitPrice, 0);
    return this.prisma.goodsReceivedNote.create({
      data: {
        tenantId,
        vendorId: dto.vendorId,
        purchaseOrderId: dto.purchaseOrderId,
        notes: dto.notes,
        totalAmount,
        receivedById: userId,
        status: "DRAFT" as never,
        items: {
          create: dto.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            unitPrice: item.unitPrice,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            lotNumber: item.lotNumber,
          })),
        },
      },
      include: { items: true, vendor: { select: { name: true } } },
    });
  }

  async receiveGRN(grnId: string, tenantId: string, userId: string) {
    const grn = await this.prisma.goodsReceivedNote.findFirst({
      where: { id: grnId, tenantId },
      include: { items: true },
    });
    if (!grn) throw new NotFoundException("GRN not found");

    return this.prisma.$transaction(async (tx) => {
      await tx.goodsReceivedNote.update({
        where: { id: grnId },
        data: { status: "RECEIVED" as never, receivedAt: new Date() },
      });

      for (const item of grn.items) {
        // Create FIFO InventoryLot
        await tx.inventoryLot.create({
          data: {
            tenantId,
            inventoryItemId: item.inventoryItemId,
            grnItemId: item.id,
            quantity: item.quantityReceived,
            remainingQuantity: item.quantityReceived,
            unitCost: item.unitPrice,
            expiryDate: item.expiryDate,
            lotNumber: item.lotNumber,
            receivedAt: new Date(),
          },
        });

        // Update InventoryItem stock
        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: { currentStock: { increment: item.quantityReceived } },
        });

        // Stock movement record
        await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: item.inventoryItemId,
            type: "IN",
            quantity: item.quantityReceived,
            reference: `GRN-${grnId}`,
            movedById: userId,
          },
        });
      }

      return tx.goodsReceivedNote.findUnique({ where: { id: grnId }, include: { items: true } });
    });
  }

  async findGRNs(tenantId: string, query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.goodsReceivedNote.findMany({
        where,
        include: { vendor: { select: { name: true } }, items: { select: { quantityReceived: true, unitPrice: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.goodsReceivedNote.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOneGRN(id: string, tenantId: string) {
    const grn = await this.prisma.goodsReceivedNote.findFirst({
      where: { id, tenantId },
      include: {
        vendor: true,
        items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
      },
    });
    if (!grn) throw new NotFoundException("GRN not found");
    return grn;
  }

  // ── FIFO Inventory ────────────────────────────

  async consumeInventory(inventoryItemId: string, quantity: number, tenantId: string) {
    const lots = await this.prisma.inventoryLot.findMany({
      where: { inventoryItemId, tenantId, remainingQuantity: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
    });

    const totalAvailable = lots.reduce((s, l) => s + l.remainingQuantity, 0);
    if (totalAvailable < quantity) {
      throw new Error(`Insufficient stock: need ${quantity}, have ${totalAvailable}`);
    }

    let remaining = quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const consume = Math.min(lot.remainingQuantity, remaining);
      await this.prisma.inventoryLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: { decrement: consume } },
      });
      remaining -= consume;
    }

    await this.prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: { decrement: quantity } },
    });

    return { consumed: quantity, remainingStock: totalAvailable - quantity };
  }

  async getInventoryWithLots(tenantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true },
      include: {
        lots: {
          where: { remainingQuantity: { gt: 0 } },
          orderBy: { receivedAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return items.map((item) => {
      const nearestExpiry = item.lots.filter((l) => l.expiryDate).sort((a, b) => (a.expiryDate?.getTime() ?? 0) - (b.expiryDate?.getTime() ?? 0))[0]?.expiryDate ?? null;
      const daysToExpiry = nearestExpiry ? Math.floor((nearestExpiry.getTime() - Date.now()) / 86400000) : null;
      return { ...item, nearestExpiry, daysToExpiry, expiryWarning: daysToExpiry !== null && daysToExpiry <= 30 };
    });
  }

  // ── Auto PO (Cron) ────────────────────────────

  @Cron("0 9 * * *")
  async dailyLowStockCheck() {
    this.logger.log("Running daily low-stock check...");
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });
    for (const tenant of tenants) {
      await this.checkLowStock(tenant.id);
    }
  }

  async checkLowStock(tenantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true },
    });

    const lowStock = items.filter((i) => Number(i.currentStock) <= Number(i.reorderLevel));
    let created = 0;

    for (const item of lowStock) {
      if (!item.vendorId) continue;

      // Check if a pending PO already exists
      const existingPO = await this.prisma.purchaseOrder.findFirst({
        where: { tenantId, vendorId: item.vendorId, status: { in: ["DRAFT", "SENT", "CONFIRMED"] } },
      });
      if (existingPO) continue;

      const date = new Date();
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
      const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
      const poNumber = `DH-PO-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      await this.prisma.purchaseOrder.create({
        data: {
          tenantId,
          vendorId: item.vendorId,
          poNumber,
          status: "DRAFT" as never,
          createdById: "system",
        },
      });
      created++;
    }

    this.logger.log(`Created ${created} auto-POs for tenant ${tenantId}`);
    return { checked: lowStock.length, created };
  }
}

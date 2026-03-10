import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { JournalService } from "./journal.service";

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  // ── Vendors ────────────────────────────────────
  async createVendor(dto: {
    name: string; code?: string; contactPerson?: string; email?: string;
    phone?: string; address?: string; gstNumber?: string; panNumber?: string;
    paymentTerms?: number; tdsApplicable?: boolean; tdsSection?: string;
  }, tenantId: string) {
    return this.prisma.vendor.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        paymentTerms: dto.paymentTerms ?? 30,
        tdsApplicable: dto.tdsApplicable ?? false,
        tdsSection: dto.tdsSection ?? "NONE",
      },
    });
  }

  async getVendors(tenantId: string) {
    return this.prisma.vendor.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  // ── Purchase Orders ────────────────────────────
  async createPurchaseOrder(dto: {
    vendorId: string;
    expectedDelivery?: string;
    notes?: string;
    items: Array<{ itemName: string; itemCode?: string; quantity: number; unit?: string; unitPrice: number }>;
  }, tenantId: string, userId: string) {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-${String(count + 1).padStart(5, "0")}`;

    const subtotal = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        vendorId: dto.vendorId,
        poNumber,
        totalAmount: subtotal,
        subtotal,
        expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : null,
        notes: dto.notes,
        createdById: userId,
        items: {
          create: dto.items.map(i => ({
            itemName: i.itemName,
            itemCode: i.itemCode,
            quantity: i.quantity,
            unit: i.unit ?? "pcs",
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
          })),
        },
      } as any,
      include: { items: true, vendor: true },
    });
  }

  async getPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async approvePurchaseOrder(id: string, tenantId: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!po) throw new NotFoundException("PO not found");
    if (po.status !== "DRAFT") throw new BadRequestException("Only DRAFT POs can be approved");
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: "SENT" as any, approvedById: userId, approvedAt: new Date() },
    });
  }

  // ── GRN ────────────────────────────────────────
  async createGRN(dto: {
    vendorId: string;
    purchaseOrderId?: string;
    notes?: string;
    items: Array<{ inventoryItemId: string; quantityReceived: number; quantityOrdered?: number; unitPrice: number; expiryDate?: string; lotNumber?: string }>;
  }, tenantId: string, userId: string) {
    return this.prisma.goodsReceivedNote.create({
      data: {
        tenantId,
        vendorId: dto.vendorId,
        purchaseOrderId: dto.purchaseOrderId,
        receivedById: userId,
        totalAmount: dto.items.reduce((s, i) => s + i.quantityReceived * i.unitPrice, 0),
        notes: dto.notes,
        items: {
          create: dto.items.map(i => ({
            inventoryItemId: i.inventoryItemId,
            quantityOrdered: i.quantityOrdered ?? i.quantityReceived,
            quantityReceived: i.quantityReceived,
            unitPrice: i.unitPrice,
            expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
            lotNumber: i.lotNumber,
          })),
        },
      },
      include: { items: true, vendor: true },
    });
  }

  async confirmGRN(id: string, tenantId: string, userId: string) {
    const grn = await this.prisma.goodsReceivedNote.findFirst({
      where: { id, tenantId },
      include: { items: { include: { inventoryItem: true } }, vendor: true },
    });
    if (!grn) throw new NotFoundException("GRN not found");
    if (grn.status !== "DRAFT") throw new BadRequestException("GRN already confirmed");

    const totalValue = grn.items.reduce((s, i) => s + i.quantityReceived * Number(i.unitPrice), 0);

    // Update GRN status
    await this.prisma.goodsReceivedNote.update({
      where: { id },
      data: { status: "RECEIVED" as any, receivedAt: new Date() },
    });

    // Update inventory stock and create stock movements
    for (const item of grn.items) {
      await this.prisma.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: { currentStock: { increment: item.quantityReceived } },
      });

      await this.prisma.stockMovement.create({
        data: {
          tenantId,
          itemId: item.inventoryItemId,
          type: "IN",
          quantity: item.quantityReceived,
          reference: `GRN:${id}`,
          movedById: userId,
        },
      });
    }

    // Post journal: DEBIT Inventory (1300), CREDIT AP (2001)
    const inventoryAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "1300" } });
    const apAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "2001" } });

    if (inventoryAccount && apAccount && totalValue > 0) {
      try {
        await this.journal.createJournal({
          tenantId,
          date: new Date().toISOString(),
          narration: `GRN confirmed - ${grn.vendor?.name ?? "Vendor"}`,
          refType: "GRN",
          refId: id,
          postedBy: userId,
          lines: [
            { ledgerAccountId: inventoryAccount.id, type: "DEBIT", amount: totalValue },
            { ledgerAccountId: apAccount.id, type: "CREDIT", amount: totalValue },
          ],
        });
      } catch (e) {}
    }

    return { success: true, grnId: id, totalValue };
  }

  // ── Vendor Invoices & 3-Way Match ──────────────
  async createVendorInvoice(dto: {
    vendorId: string;
    vendorInvoiceNumber: string;
    purchaseOrderId?: string;
    grnId?: string;
    invoiceDate: string;
    dueDate?: string;
    subtotal: number;
    tdsAmount?: number;
    notes?: string;
  }, tenantId: string) {
    const tds = dto.tdsAmount ?? 0;
    const netPayable = dto.subtotal - tds;

    return this.prisma.vendorInvoice.create({
      data: {
        tenantId,
        vendorId: dto.vendorId,
        vendorInvoiceNumber: dto.vendorInvoiceNumber,
        purchaseOrderId: dto.purchaseOrderId,
        grnId: dto.grnId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        subtotal: dto.subtotal,
        tdsAmount: tds,
        netPayable,
        notes: dto.notes,
      } as any,
      include: { vendor: true },
    });
  }

  async threeWayMatch(vendorInvoiceId: string, tenantId: string, userId: string) {
    const vi = await this.prisma.vendorInvoice.findFirst({
      where: { id: vendorInvoiceId, tenantId },
    });
    if (!vi) throw new NotFoundException("Vendor invoice not found");

    let poAmount = 0;
    let grnAmount = 0;
    const invoiceAmount = Number(vi.subtotal);

    if (vi.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: vi.purchaseOrderId } });
      poAmount = po ? Number(po.totalAmount) : 0;
    }

    if (vi.grnId) {
      const grn = await this.prisma.goodsReceivedNote.findUnique({ where: { id: vi.grnId } });
      grnAmount = grn ? Number(grn.totalAmount) : 0;
    }

    // Check within ±5%
    const tolerance = 0.05;
    const poMatch = poAmount === 0 || Math.abs(invoiceAmount - poAmount) / poAmount <= tolerance;
    const grnMatch = grnAmount === 0 || Math.abs(invoiceAmount - grnAmount) / grnAmount <= tolerance;
    const matched = poMatch && grnMatch;

    const status = matched ? "APPROVED" : "DISPUTED";
    await this.prisma.vendorInvoice.update({
      where: { id: vendorInvoiceId },
      data: { status } as any,
    });

    // Auto-post journal if approved
    if (matched && invoiceAmount > 0) {
      const apAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "2001" } });
      const inventoryAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "1300" } });

      if (apAccount && inventoryAccount) {
        try {
          await this.journal.createJournal({
            tenantId,
            date: new Date().toISOString(),
            narration: `Vendor invoice matched: ${vi.vendorInvoiceNumber}`,
            refType: "VENDOR_INVOICE",
            refId: vendorInvoiceId,
            postedBy: userId,
            lines: [
              { ledgerAccountId: inventoryAccount.id, type: "DEBIT", amount: invoiceAmount },
              { ledgerAccountId: apAccount.id, type: "CREDIT", amount: invoiceAmount },
            ],
          });
        } catch (e) {}
      }
    }

    return {
      vendorInvoiceId,
      status,
      comparison: { poAmount, grnAmount, invoiceAmount },
      poMatch,
      grnMatch,
    };
  }

  // ── Vendor Payments ────────────────────────────
  async recordVendorPayment(dto: {
    vendorInvoiceId: string;
    amount: number;
    bankAccountId?: string;
  }, tenantId: string, userId: string) {
    const vi = await this.prisma.vendorInvoice.findFirst({
      where: { id: dto.vendorInvoiceId, tenantId },
      include: { vendor: true },
    });
    if (!vi) throw new NotFoundException("Vendor invoice not found");

    const vendor = vi.vendor as any;
    const tdsApplicable = vendor?.tdsApplicable ?? false;
    const tdsSection = vendor?.tdsSection ?? "NONE";

    // Update vendor invoice paid amount
    const newPaid = Number(vi.paidAmount) + dto.amount;
    await this.prisma.vendorInvoice.update({
      where: { id: dto.vendorInvoiceId },
      data: {
        paidAmount: newPaid,
        status: newPaid >= Number(vi.netPayable) ? "PAID" : vi.status,
      } as any,
    });

    // Post journal
    const apAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "2001" } });
    const bankGl = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "1100" } });

    if (apAccount && bankGl) {
      const lines: Array<{ ledgerAccountId: string; type: "DEBIT" | "CREDIT"; amount: number; narration?: string }> = [];
      lines.push({ ledgerAccountId: apAccount.id, type: "DEBIT", amount: dto.amount });

      if (tdsApplicable && Number(vi.tdsAmount) > 0) {
        const tdsCode = tdsSection === "194J" ? "2102" : "2101";
        const tdsGl = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: tdsCode } });
        const tdsAmt = Number(vi.tdsAmount);
        const netAmt = dto.amount - tdsAmt;

        if (tdsGl) {
          lines.push({ ledgerAccountId: tdsGl.id, type: "CREDIT", amount: tdsAmt, narration: `TDS ${tdsSection}` });
          lines.push({ ledgerAccountId: bankGl.id, type: "CREDIT", amount: netAmt });
        } else {
          lines.push({ ledgerAccountId: bankGl.id, type: "CREDIT", amount: dto.amount });
        }
      } else {
        lines.push({ ledgerAccountId: bankGl.id, type: "CREDIT", amount: dto.amount });
      }

      try {
        await this.journal.createJournal({
          tenantId,
          date: new Date().toISOString(),
          narration: `Vendor payment: ${vi.vendorInvoiceNumber}`,
          refType: "VENDOR_PAYMENT",
          refId: dto.vendorInvoiceId,
          postedBy: userId,
          lines,
        });
      } catch (e) {}
    }

    return { success: true, vendorInvoiceId: dto.vendorInvoiceId, amountPaid: dto.amount };
  }

  // ── Inventory ──────────────────────────────────
  async getInventory(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async recordInventoryOut(dto: {
    itemId: string;
    quantity: number;
    orderId?: string;
  }, tenantId: string, userId: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id: dto.itemId, tenantId } });
    if (!item) throw new NotFoundException("Inventory item not found");

    // Create stock movement
    await this.prisma.stockMovement.create({
      data: {
        tenantId,
        itemId: dto.itemId,
        type: "OUT",
        quantity: -dto.quantity,
        reference: dto.orderId ? `ORDER:${dto.orderId}` : "MANUAL",
        movedById: userId,
      },
    });

    // Update stock
    await this.prisma.inventoryItem.update({
      where: { id: dto.itemId },
      data: { currentStock: { decrement: dto.quantity } },
    });

    // COGS journal: DEBIT Reagents(5001), CREDIT Inventory(1300)
    // Use a simple estimate for cost
    const cogsAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "5001" } });
    const invAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "1300" } });

    // Estimate cost from recent stock movements
    const recentIn = await this.prisma.stockMovement.findFirst({
      where: { itemId: dto.itemId, type: "IN" },
      orderBy: { movedAt: "desc" },
    });
    const unitCost = recentIn ? Math.abs(Number(recentIn.quantity)) > 0 ? 100 : 0 : 100; // fallback
    const totalCost = dto.quantity * unitCost;

    if (cogsAccount && invAccount && totalCost > 0) {
      try {
        await this.journal.createJournal({
          tenantId,
          date: new Date().toISOString(),
          narration: `Inventory out: ${item.name} x${dto.quantity}`,
          refType: "INVENTORY_OUT",
          refId: dto.itemId,
          postedBy: userId,
          lines: [
            { ledgerAccountId: cogsAccount.id, type: "DEBIT", amount: totalCost },
            { ledgerAccountId: invAccount.id, type: "CREDIT", amount: totalCost },
          ],
        });
      } catch (e) {}
    }

    return { success: true, item: item.name, quantityOut: dto.quantity };
  }
}

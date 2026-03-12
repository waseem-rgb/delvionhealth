import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateOrderDto } from "./dto/create-order.dto";
import type { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import type { QueryOrderDto } from "./dto/query-order.dto";
import type { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { DiscountType } from "./dto/create-order.dto";
import { OrderStatus, SampleStatus, InvoiceStatus } from "@delvion/types";
import type { PaginationMeta } from "@delvion/types";
import { Decimal } from "@prisma/client/runtime/library";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../notifications/push.service";
import { RateListsService } from "../rate-lists/rate-lists.service";

// ─────────────────────────────────────────────
// Order status state machine
// ─────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.PENDING_COLLECTION, OrderStatus.CANCELLED],
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.PENDING_COLLECTION, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PENDING_COLLECTION, OrderStatus.SAMPLE_COLLECTED, OrderStatus.CANCELLED],
  [OrderStatus.PENDING_COLLECTION]: [OrderStatus.SAMPLE_COLLECTED, OrderStatus.CANCELLED],
  [OrderStatus.SAMPLE_COLLECTED]: [OrderStatus.RECEIVED, OrderStatus.SAMPLE_REJECTED],
  [OrderStatus.RECEIVED]: [OrderStatus.PENDING_PROCESSING, OrderStatus.IN_PROCESSING, OrderStatus.SAMPLE_REJECTED],
  [OrderStatus.SAMPLE_REJECTED]: [OrderStatus.PENDING_COLLECTION, OrderStatus.CANCELLED],
  [OrderStatus.PENDING_PROCESSING]: [OrderStatus.IN_PROCESSING],
  [OrderStatus.IN_PROCESSING]: [OrderStatus.PENDING_APPROVAL, OrderStatus.RESULTED],
  [OrderStatus.PENDING_APPROVAL]: [OrderStatus.APPROVED, OrderStatus.IN_PROCESSING],
  [OrderStatus.RESULTED]: [OrderStatus.REPORTED],
  [OrderStatus.APPROVED]: [OrderStatus.DISPATCHED, OrderStatus.REPORTED],
  [OrderStatus.REPORTED]: [OrderStatus.DISPATCHED, OrderStatus.DELIVERED],
  [OrderStatus.DISPATCHED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.ARCHIVED],
  [OrderStatus.ARCHIVED]: [],
  [OrderStatus.CANCELLED]: [],
};

// ─────────────────────────────────────────────
// Number generators (count-based, no randomness)
// ─────────────────────────────────────────────

type PrismaTx = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

async function generateOrderNumber(tenantId: string, tx: PrismaTx): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const count = await tx.order.count({
    where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
  });
  return `DH-ORD-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

async function generateInvoiceNumber(tenantId: string, tx: PrismaTx): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const count = await tx.invoice.count({
    where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
  });
  return `DH-INV-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

function generateBarcodeId(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BC-${datePart}-${rand}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly pushService: PushService,
    private readonly rateListsService: RateListsService,
  ) {}

  // ───────────────────────────────────────────
  // Create — full transaction
  // ───────────────────────────────────────────

  async create(tenantId: string, createdById: string, dto: CreateOrderDto) {
    // Validate patient & branch (outside tx for early error)
    const [patient, branch] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: dto.patientId, tenantId, isActive: true },
        select: {
          id: true, firstName: true, lastName: true, mrn: true,
          reportDeliveryMode: true, preferredChannel: true,
          reportMobile: true, reportEmail: true,
        },
      }),
      this.prisma.tenantBranch.findFirst({
        where: { id: dto.branchId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    if (!patient) throw new NotFoundException("Patient not found");
    if (!branch) throw new NotFoundException("Branch not found");

    // Fetch test catalog items
    const testIds = dto.items.map((i) => i.testCatalogId);
    const tests = await this.prisma.testCatalog.findMany({
      where: { id: { in: testIds }, tenantId, isActive: true },
    });

    if (tests.length !== testIds.length) {
      const foundIds = new Set(tests.map((t) => t.id));
      const missing = testIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Tests not found or inactive: ${missing.join(", ")}`);
    }

    const testMap = new Map(tests.map((t) => [t.id, t]));

    // Resolve rate list: explicit rateListId > org rateListId
    let effectiveRateListId: string | undefined = dto.rateListId ?? undefined;
    if (dto.organizationId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: dto.organizationId, tenantId, isActive: true },
        select: { id: true, rateListId: true },
      });
      if (!org) throw new BadRequestException("Organisation not found or inactive");
      if (!effectiveRateListId) {
        effectiveRateListId = org.rateListId ?? undefined;
      }
    }

    // Calculate pricing — use org rate list if available
    let totalAmount = new Decimal(0);
    const orderItemsData: Array<{
      testCatalogId: string; quantity: number;
      price: Decimal; discount: Decimal; status: OrderStatus;
    }> = [];
    for (const item of dto.items) {
      const test = testMap.get(item.testCatalogId)!;
      const qty = item.quantity ?? 1;
      const discountPct = new Decimal(item.discount ?? 0);
      let unitPrice = test.price;
      if (effectiveRateListId) {
        const ratePrice = await this.rateListsService.getTestPrice(
          item.testCatalogId, tenantId, effectiveRateListId,
        );
        unitPrice = new Decimal(ratePrice);
      }
      const lineTotal = unitPrice.mul(qty);
      const lineNet = lineTotal.mul(new Decimal(1).minus(discountPct.div(100)));
      totalAmount = totalAmount.add(lineNet);
      orderItemsData.push({
        testCatalogId: item.testCatalogId,
        quantity: qty,
        price: unitPrice,
        discount: discountPct,
        status: OrderStatus.PENDING,
      });
    }

    // Order-level discount
    let orderDiscountAmount = new Decimal(dto.discountAmount ?? 0);
    if (dto.discountType === DiscountType.PERCENT) {
      orderDiscountAmount = totalAmount.mul(
        new Decimal(dto.discountAmount ?? 0).div(100)
      );
    }
    const netAmount = Decimal.max(totalAmount.minus(orderDiscountAmount), new Decimal(0));

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tenantId, tx);
      const invoiceNumber = await generateInvoiceNumber(tenantId, tx);

      const isCreditOrder = dto.isCreditOrder === true;

      // Determine initial status: IMAGING tests have no physical tube — skip accession.
      // Only PATHOLOGY, MOLECULAR, GENETIC require sample collection/accession.
      const REQUIRES_ACCESSION = new Set(["PATHOLOGY", "MOLECULAR", "GENETIC"]);
      const needsAccession = tests.some(
        (t) => REQUIRES_ACCESSION.has((t.investigationType ?? "PATHOLOGY") as string)
      );
      const initialStatus = needsAccession
        ? OrderStatus.PENDING_COLLECTION
        : OrderStatus.CONFIRMED;

      // 1. Create order (no samples — barcodes scanned during accession for lab tests)
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          orderNumber,
          status: initialStatus,
          priority: dto.priority ?? "ROUTINE",
          totalAmount,
          discountAmount: orderDiscountAmount,
          netAmount,
          notes: dto.notes,
          createdById,
          isCreditOrder,
          collectionType: (dto.collectionType ?? "WALK_IN") as never,
          billedAt: new Date(),
          ...(dto.organizationId && { organizationId: dto.organizationId }),
          // Inherit delivery preferences from patient (can be overridden per order)
          reportDeliveryMode: patient.reportDeliveryMode ?? "MANUAL",
          preferredChannel: patient.preferredChannel ?? [],
          ...(patient.reportMobile && { reportMobile: patient.reportMobile }),
          ...(patient.reportEmail && { reportEmail: patient.reportEmail }),
          items: { create: orderItemsData },
        },
        include: {
          items: { include: { testCatalog: true } },
          patient: {
            select: { id: true, mrn: true, firstName: true, lastName: true },
          },
          branch: { select: { id: true, name: true } },
        },
      });

      // 3. Create invoice with payment metadata
      const amountPaid = isCreditOrder ? new Decimal(0)
        : new Decimal(dto.amountReceived ?? Number(netAmount));
      const invoiceBalance = Decimal.max(netAmount.minus(amountPaid), new Decimal(0));

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          orderId: newOrder.id,
          patientId: dto.patientId,
          invoiceNumber,
          subtotal: totalAmount,
          discount: orderDiscountAmount,
          tax: new Decimal(0),
          total: netAmount,
          amountPaid,
          balance: invoiceBalance,
          status: isCreditOrder ? InvoiceStatus.DRAFT
            : amountPaid.gte(netAmount) ? InvoiceStatus.PAID
            : InvoiceStatus.DRAFT,
          paymentMode: isCreditOrder ? "CREDIT" : (dto.paymentMethod ?? "CASH"),
          isCreditOrder,
          paymentRemark: dto.paymentRemark ?? null,
          paymentRefNumber: dto.paymentRefNumber ?? null,
          paymentScreenshotUrl: dto.paymentScreenshotUrl ?? null,
          paymentScreenshotKey: dto.paymentScreenshotKey ?? null,
          insuranceTpaName: dto.insuranceTpaName ?? null,
          insurancePolicyNo: dto.insurancePolicyNo ?? null,
          ...(dto.organizationId && { organizationId: dto.organizationId }),
        },
      });

      // 3b. If payment collected, record it
      if (!isCreditOrder && amountPaid.gt(0)) {
        await tx.payment.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            amount: amountPaid,
            method: (dto.paymentMethod ?? "CASH") as "CASH" | "CARD" | "UPI" | "BANK_TRANSFER" | "WALLET" | "INSURANCE" | "CREDIT",
            reference: dto.paymentRefNumber ?? null,
            notes: dto.paymentRemark ?? null,
            recordedById: createdById,
          },
        });
      }

      // 3c. If credit order with org → post to org ledger
      if (isCreditOrder && dto.organizationId) {
        const lastEntry = await tx.orgLedger.findFirst({
          where: { tenantId, orgId: dto.organizationId },
          orderBy: { createdAt: "desc" },
          select: { runningTotal: true },
        });
        const prevBalance = lastEntry ? Number(lastEntry.runningTotal) : 0;
        const newBalance = prevBalance + Number(netAmount);

        await tx.orgLedger.create({
          data: {
            tenantId,
            orgId: dto.organizationId,
            type: "CREDIT_SALE",
            orderId: newOrder.id,
            invoiceId: invoice.id,
            description: `Order ${orderNumber} — credit sale`,
            amount: netAmount,
            runningTotal: newBalance,
            createdById,
          },
        });

        await tx.organization.update({
          where: { id: dto.organizationId },
          data: { currentOutstanding: { increment: Number(netAmount) } },
        });
      }

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: createdById,
          action: "CREATE",
          entity: "Order",
          entityId: newOrder.id,
          newValue: { orderNumber, netAmount: netAmount.toFixed(2) },
        },
      });

      return { ...newOrder, invoiceId: invoice.id };
    });

    // 5. Realtime emit (after tx commits)
    this.realtime.emitOrderUpdate(tenantId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    });

    // 6. Multi-channel notification: order confirmed
    const fullPatient = await this.prisma.patient.findUnique({
      where: { id: order.patientId },
      select: { firstName: true, email: true, phone: true },
    }).catch(() => null);

    if (fullPatient?.email) {
      const testNames = order.items?.map((i: { testCatalog?: { name?: string } }) => i.testCatalog?.name ?? "").filter(Boolean).join(", ");
      this.notifications.sendEmail(
        fullPatient.email,
        `Order Confirmed – ${order.orderNumber}`,
        `<p>Dear ${fullPatient.firstName},</p>
         <p>Your lab order <strong>${order.orderNumber}</strong> has been confirmed.</p>
         <p><strong>Tests:</strong> ${testNames || "See attached order"}</p>
         <p>You will be notified when your results are ready.</p>
         <p>— DELViON Health</p>`,
      ).catch(() => {});
    }
    if (fullPatient?.phone) {
      this.notifications.sendSMS(
        fullPatient.phone,
        `DELViON: Order ${order.orderNumber} confirmed. You'll be notified when results are ready.`,
      ).catch(() => {});
    }

    // Non-blocking push notification to patient
    this.prisma.patient.findUnique({
      where: { id: order.patientId },
      select: { userId: true },
    }).then((patient) => {
      if (patient?.userId) {
        this.pushService.notifyOrderConfirmed(patient.userId, order.orderNumber).catch(() => {});
      }
    }).catch(() => {});

    return order;
  }

  // ───────────────────────────────────────────
  // List
  // ───────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: QueryOrderDto
  ): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Support comma-separated status values e.g. "APPROVED,REPORTED"
    const statusValues = query.status
      ? query.status.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Support q as alias for search
    const searchTerm = query.search || query.q;

    const where = {
      tenantId,
      ...(statusValues.length === 1
        ? { status: statusValues[0] as never }
        : statusValues.length > 1
        ? { status: { in: statusValues as never[] } }
        : {}),
      ...(query.priority && { priority: query.priority as string }),
      ...(query.branchId && { branchId: query.branchId }),
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.collectionType && { collectionType: query.collectionType as never }),
      ...(query.reportDeliveryMode && { reportDeliveryMode: query.reportDeliveryMode }),
      ...(query.deliveredDate
        ? {
            dispatchedAt: {
              gte: new Date(`${query.deliveredDate}T00:00:00.000Z`),
              lte: new Date(`${query.deliveredDate}T23:59:59.999Z`),
            },
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
      ...(searchTerm
        ? {
            OR: [
              { orderNumber: { contains: searchTerm, mode: "insensitive" as const } },
              {
                patient: {
                  OR: [
                    { firstName: { contains: searchTerm, mode: "insensitive" as const } },
                    { lastName: { contains: searchTerm, mode: "insensitive" as const } },
                    { mrn: { contains: searchTerm, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          patient: {
            select: { id: true, mrn: true, firstName: true, lastName: true },
          },
          branch: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ───────────────────────────────────────────
  // Find one
  // ───────────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        patient: true,
        branch: true,
        items: { include: { testCatalog: true } },
        samples: true,
        invoices: { select: { id: true, invoiceNumber: true, total: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  // ───────────────────────────────────────────
  // Search (CommandPalette)
  // ───────────────────────────────────────────

  async search(tenantId: string, q: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { patient: { firstName: { contains: q, mode: "insensitive" } } },
          { patient: { lastName: { contains: q, mode: "insensitive" } } },
          { patient: { mrn: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        priority: true,
        createdAt: true,
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
      },
    });

    return orders;
  }

  // ───────────────────────────────────────────
  // Update status
  // ───────────────────────────────────────────

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateOrderStatusDto,
    userId: string
  ) {
    const order = await this.findOne(tenantId, id);

    const allowed = STATUS_TRANSITIONS[order.status as OrderStatus];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id },
        data: { status: dto.status },
      });

      // If status → SAMPLE_COLLECTED, update all pending samples
      if (dto.status === OrderStatus.SAMPLE_COLLECTED) {
        await tx.sample.updateMany({
          where: { orderId: id, status: SampleStatus.PENDING_COLLECTION },
          data: { status: SampleStatus.COLLECTED, collectedAt: new Date() },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "STATUS_CHANGE",
          entity: "Order",
          entityId: id,
          oldValue: { status: order.status },
          newValue: { status: dto.status, notes: dto.notes },
        },
      });

      return upd;
    });

    // Realtime
    this.realtime.emitOrderUpdate(tenantId, {
      orderId: id,
      orderNumber: order.orderNumber,
      status: dto.status,
    });

    return updated;
  }

  // ───────────────────────────────────────────
  // Apply discount
  // ───────────────────────────────────────────

  async applyDiscount(
    tenantId: string,
    id: string,
    dto: ApplyDiscountDto,
    userId: string
  ) {
    const order = await this.findOne(tenantId, id);

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        "Discount can only be applied to PENDING or CONFIRMED orders"
      );
    }

    let discountAmount: Decimal;
    if (dto.discountType === DiscountType.PERCENT) {
      discountAmount = order.totalAmount.mul(
        new Decimal(dto.discountValue).div(100)
      );
    } else if (dto.discountType === DiscountType.FLAT) {
      discountAmount = new Decimal(dto.discountValue);
    } else {
      discountAmount = new Decimal(0);
    }

    const netAmount = Decimal.max(
      order.totalAmount.minus(discountAmount),
      new Decimal(0)
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { discountAmount, netAmount },
      });

      // Update draft invoice if exists
      await tx.invoice.updateMany({
        where: { orderId: id, status: InvoiceStatus.DRAFT },
        data: { discount: discountAmount, total: netAmount },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "APPLY_DISCOUNT",
          entity: "Order",
          entityId: id,
          oldValue: { discountAmount: order.discountAmount.toFixed(2) },
          newValue: {
            discountType: dto.discountType,
            discountValue: dto.discountValue,
            reason: dto.reason,
            newDiscountAmount: discountAmount.toFixed(2),
          },
        },
      });

      return updated;
    });
  }

  // ───────────────────────────────────────────
  // Add item (PENDING / CONFIRMED only)
  // ───────────────────────────────────────────

  async addItem(
    tenantId: string,
    orderId: string,
    item: { testCatalogId: string; quantity?: number; discount?: number },
    userId: string
  ) {
    const order = await this.findOne(tenantId, orderId);
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException("Items can only be added to PENDING or CONFIRMED orders");
    }

    const test = await this.prisma.testCatalog.findFirst({
      where: { id: item.testCatalogId, tenantId, isActive: true },
    });
    if (!test) throw new NotFoundException("Test not found or inactive");

    const qty = item.quantity ?? 1;
    const discountPct = new Decimal(item.discount ?? 0);
    const lineTotal = test.price.mul(qty);
    const lineNet = lineTotal.mul(new Decimal(1).minus(discountPct.div(100)));
    const newTotal = order.totalAmount.add(lineNet);
    const newNet = Decimal.max(newTotal.minus(order.discountAmount), new Decimal(0));

    return this.prisma.$transaction(async (tx) => {
      const newItem = await tx.orderItem.create({
        data: {
          orderId,
          testCatalogId: item.testCatalogId,
          quantity: qty,
          price: test.price,
          discount: discountPct,
          status: OrderStatus.PENDING,
        },
        include: { testCatalog: true },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { totalAmount: newTotal, netAmount: newNet },
      });

      await tx.invoice.updateMany({
        where: { orderId, status: InvoiceStatus.DRAFT },
        data: {
          subtotal: newTotal,
          total: newNet,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "ADD_ITEM",
          entity: "Order",
          entityId: orderId,
          newValue: { testCatalogId: item.testCatalogId, qty, lineNet: lineNet.toFixed(2) },
        },
      });

      return newItem;
    });
  }

  // ───────────────────────────────────────────
  // Remove item
  // ───────────────────────────────────────────

  async removeItem(
    tenantId: string,
    orderId: string,
    itemId: string,
    userId: string
  ) {
    const order = await this.findOne(tenantId, orderId);
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException("Items can only be removed from PENDING or CONFIRMED orders");
    }

    const orderItem = order.items.find((i) => i.id === itemId);
    if (!orderItem) throw new NotFoundException("Order item not found");

    if (order.items.length === 1) {
      throw new BadRequestException("Cannot remove the last item from an order");
    }

    const lineNet = orderItem.price
      .mul(orderItem.quantity)
      .mul(new Decimal(1).minus(orderItem.discount.div(100)));
    const newTotal = Decimal.max(order.totalAmount.minus(lineNet), new Decimal(0));
    const newNet = Decimal.max(newTotal.minus(order.discountAmount), new Decimal(0));

    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });

      await tx.order.update({
        where: { id: orderId },
        data: { totalAmount: newTotal, netAmount: newNet },
      });

      await tx.invoice.updateMany({
        where: { orderId, status: InvoiceStatus.DRAFT },
        data: { subtotal: newTotal, total: newNet },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "REMOVE_ITEM",
          entity: "Order",
          entityId: orderId,
          oldValue: { itemId, testCatalogId: orderItem.testCatalogId },
        },
      });
    });
  }

  // ───────────────────────────────────────────
  // Test Catalog with org-aware pricing
  // ───────────────────────────────────────────

  async getTestCatalog(
    tenantId: string,
    search?: string,
    category?: string,
    orgId?: string,
  ) {
    // Build where clause
    const where: Record<string, unknown> = { tenantId, isActive: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const tests = await this.prisma.testCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        category: true,
        department: true,
        sampleType: true,
        turnaroundHours: true,
        type: true,
      },
    });

    // Resolve org-specific pricing if orgId provided
    let orgPriceMap = new Map<string, number>();
    let hasOrgPricing = false;
    let orgRateListName: string | null = null;

    if (orgId) {
      const org = await this.prisma.organization.findFirst({
        where: { id: orgId, tenantId, isActive: true },
        select: { rateListId: true },
      });
      if (org?.rateListId) {
        const rateItems = await this.prisma.rateListItem.findMany({
          where: { rateListId: org.rateListId, isActive: true },
          select: { testCatalogId: true, price: true },
        });
        rateItems.forEach((ri) => orgPriceMap.set(ri.testCatalogId, Number(ri.price)));
        hasOrgPricing = rateItems.length > 0;

        const rl = await this.prisma.rateList.findUnique({
          where: { id: org.rateListId },
          select: { name: true },
        });
        orgRateListName = rl?.name ?? null;
      }
    }

    const enriched = tests.map((t) => {
      const mrp = Number(t.price);
      const orgPrice = orgPriceMap.get(t.id);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        category: t.category,
        department: t.department,
        sampleType: t.sampleType,
        turnaroundHours: t.turnaroundHours,
        type: t.type,
        mrp,
        price: orgPrice ?? mrp,
        priceSource: orgPrice !== undefined ? "ORG" as const : "CATALOG" as const,
      };
    });

    // Group by category
    const grouped: Record<string, typeof enriched> = {};
    enriched.forEach((t) => {
      const cat = t.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    return {
      tests: enriched,
      grouped,
      total: enriched.length,
      hasOrgPricing,
      orgRateListName,
    };
  }

  // ───────────────────────────────────────────
  // Cancel
  // ───────────────────────────────────────────

  async cancel(tenantId: string, id: string, userId: string): Promise<void> {
    const order = await this.findOne(tenantId, id);

    const cancellable: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
    if (!cancellable.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        `Order in ${order.status} state cannot be cancelled`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "CANCEL",
          entity: "Order",
          entityId: id,
          oldValue: { status: order.status },
        },
      });
    });

    this.realtime.emitOrderUpdate(tenantId, {
      orderId: id,
      orderNumber: order.orderNumber,
      status: OrderStatus.CANCELLED,
    });
  }
}

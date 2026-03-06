import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RateListsService } from "../rate-lists/rate-lists.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { InvoiceStatus, OrderStatus } from "@delvion/types";
import { Decimal } from "@prisma/client/runtime/library";

interface CreateBillDto {
  patientId: string;
  branchId: string;
  tests: { testCatalogId: string; price?: number; concession?: number }[];
  paymentMode: string;
  amountPaid: number;
  rateListId?: string;
  organizationId?: string;
  notes?: string;
  priority?: string;
  collectionType?: string;
}

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
  return `INV-${now.getFullYear()}-${String(count + 1).padStart(4, "0")}`;
}

function generateBarcodeId(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BC-${datePart}-${rand}`;
}

@Injectable()
export class PatientBillingService {
  private readonly logger = new Logger(PatientBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateListsService: RateListsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async createBill(tenantId: string, userId: string, dto: CreateBillDto) {
    // Validate patient
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, mrn: true, branchId: true },
    });
    if (!patient) throw new NotFoundException("Patient not found");

    const branchId = dto.branchId || patient.branchId;

    // Validate tests
    if (!dto.tests.length) throw new BadRequestException("At least one test required");

    const testIds = dto.tests.map((t) => t.testCatalogId);
    const tests = await this.prisma.testCatalog.findMany({
      where: { id: { in: testIds }, tenantId, isActive: true },
      select: { id: true, name: true, code: true, price: true, sampleType: true, turnaroundHours: true },
    });

    if (tests.length !== testIds.length) {
      throw new BadRequestException("One or more tests not found or inactive");
    }

    // Build items with pricing
    const testMap = new Map(tests.map((t) => [t.id, t]));
    const lineItems: { testCatalogId: string; testName: string; price: number; concession: number; finalPrice: number }[] = [];

    for (const item of dto.tests) {
      const test = testMap.get(item.testCatalogId)!;
      let price = item.price ?? Number(test.price);

      // Get rate list price if applicable
      if (dto.rateListId && !item.price) {
        price = await this.rateListsService.getTestPrice(
          item.testCatalogId,
          tenantId,
          dto.rateListId,
        );
      }

      const concession = item.concession ?? 0;
      const finalPrice = Math.max(0, price - concession);

      lineItems.push({
        testCatalogId: item.testCatalogId,
        testName: test.name,
        price,
        concession,
        finalPrice,
      });
    }

    const subtotal = lineItems.reduce((s, i) => s + i.price, 0);
    const totalDiscount = lineItems.reduce((s, i) => s + i.concession, 0);
    const total = lineItems.reduce((s, i) => s + i.finalPrice, 0);
    const amountPaid = Math.min(dto.amountPaid, total);
    const balance = total - amountPaid;

    let paymentStatus: string;
    if (dto.paymentMode === "CREDIT") {
      paymentStatus = "CREDIT";
    } else if (amountPaid >= total) {
      paymentStatus = "PAID";
    } else if (amountPaid > 0) {
      paymentStatus = "PARTIAL";
    } else {
      paymentStatus = "PENDING";
    }

    // Create everything in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tenantId, tx);
      const invoiceNumber = await generateInvoiceNumber(tenantId, tx);

      // Create order
      const order = await tx.order.create({
        data: {
          tenantId,
          branchId,
          patientId: dto.patientId,
          orderNumber,
          status: OrderStatus.PENDING_COLLECTION,
          priority: dto.priority ?? "ROUTINE",
          totalAmount: new Decimal(subtotal),
          discountAmount: new Decimal(totalDiscount),
          netAmount: new Decimal(total),
          paymentStatus,
          notes: dto.notes,
          createdById: userId,
          collectionType: (dto.collectionType ?? "WALK_IN") as never,
          billedAt: new Date(),
          billingStatus: paymentStatus,
          items: {
            create: lineItems.map((item) => ({
              testCatalogId: item.testCatalogId,
              price: new Decimal(item.price),
              discount: new Decimal(item.concession),
            })),
          },
          samples: {
            create: [{
              tenantId,
              branchId,
              barcodeId: generateBarcodeId(),
              type: tests[0]?.sampleType ?? "SERUM",
            }],
          },
        },
      });

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          orderId: order.id,
          patientId: dto.patientId,
          invoiceNumber,
          subtotal: new Decimal(subtotal),
          discount: new Decimal(totalDiscount),
          total: new Decimal(total),
          status: paymentStatus === "PAID" ? InvoiceStatus.PAID : InvoiceStatus.SENT,
          amountPaid: new Decimal(amountPaid),
          balance: new Decimal(balance),
          paymentMode: dto.paymentMode,
          billedAt: new Date(),
          organizationId: dto.organizationId,
          createdById: userId,
          items: {
            create: lineItems.map((item) => ({
              testCatalogId: item.testCatalogId,
              testName: item.testName,
              price: new Decimal(item.price),
              discount: new Decimal(item.concession),
              finalPrice: new Decimal(item.finalPrice),
            })),
          },
        },
      });

      // Record payment if any
      if (amountPaid > 0 && dto.paymentMode !== "CREDIT") {
        await tx.payment.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            amount: new Decimal(amountPaid),
            method: dto.paymentMode as never,
            recordedById: userId,
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "PATIENT_BILL_CREATED",
          module: "billing",
          entity: "Invoice",
          entityId: invoice.id,
          targetRef: invoiceNumber,
          changes: {
            orderNumber,
            invoiceNumber,
            total,
            paymentMode: dto.paymentMode,
            paymentStatus,
          },
        },
      });

      return { order, invoice, invoiceNumber, orderNumber };
    });

    // Emit realtime event
    try {
      this.realtime.emitToTenant(tenantId, "order:created", {
        orderId: result.order.id,
        orderNumber: result.orderNumber,
        patientName: `${patient.firstName} ${patient.lastName}`,
      });
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoiceNumber,
      orderId: result.order.id,
      orderNumber: result.orderNumber,
      total,
      amountPaid,
      balance,
      paymentStatus,
    };
  }

  async getRecentTests(patientId: string, tenantId: string, limit = 5) {
    const recentOrders = await this.prisma.order.findMany({
      where: { patientId, tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        items: {
          include: {
            testCatalog: {
              select: { id: true, name: true, code: true, price: true },
            },
          },
        },
      },
    });

    const testMap = new Map<string, { id: string; name: string; code: string; price: number; lastOrdered: Date }>();
    for (const order of recentOrders) {
      for (const item of order.items) {
        if (!testMap.has(item.testCatalogId)) {
          testMap.set(item.testCatalogId, {
            id: item.testCatalog.id,
            name: item.testCatalog.name,
            code: item.testCatalog.code,
            price: Number(item.testCatalog.price),
            lastOrdered: order.createdAt,
          });
        }
      }
    }

    return Array.from(testMap.values()).slice(0, limit);
  }
}

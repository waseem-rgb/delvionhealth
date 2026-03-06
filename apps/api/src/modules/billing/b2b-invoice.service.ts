import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MinioService } from "../reports/minio.service";
import { EmailService } from "../email/email.service";
import { generateB2BInvoiceHtml } from "./templates/b2b-invoice.template";
import type { B2BInvoiceTemplateData } from "./templates/b2b-invoice.template";
import type { Prisma } from "@prisma/client";

// B2BInvoiceStatus values from Prisma enum
const B2B_STATUS = {
  DRAFT: "B2B_DRAFT" as const,
  SENT: "B2B_SENT" as const,
  PARTIAL: "B2B_PARTIAL" as const,
  PAID: "B2B_PAID" as const,
  OVERDUE: "B2B_OVERDUE" as const,
  CANCELLED: "B2B_CANCELLED" as const,
};

export interface GenerateB2BInvoiceDto {
  organizationId: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
  orderIds?: string[]; // if provided, use these specific orders
  notes?: string;
}

export interface RecordB2BPaymentDto {
  amount: number;
  paymentMode: string;
  referenceNo?: string;
  paymentDate?: string;
  notes?: string;
}

export interface B2BInvoiceQueryDto {
  organizationId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class B2BInvoiceService {
  private readonly logger = new Logger(B2BInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly emailService: EmailService,
  ) {}

  // ── Invoice number generation ─────────────────────────────────────────────

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.b2BInvoice.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(`${year}-01-01T00:00:00.000Z`),
          },
        },
      });
      return `INV-B2B-${year}-${String(count + 1).padStart(4, "0")}`;
    });
  }

  // ── Generate Invoice ──────────────────────────────────────────────────────

  async generateInvoice(tenantId: string, dto: GenerateB2BInvoiceDto) {
    const org = await this.prisma.organization.findFirst({
      where: { id: dto.organizationId, tenantId, isActive: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd < periodStart) {
      throw new BadRequestException("periodEnd must be after periodStart");
    }

    // Find orders: either explicit orderIds or all orders in the period
    let orderWhere: Prisma.OrderWhereInput;
    if (dto.orderIds && dto.orderIds.length > 0) {
      orderWhere = {
        id: { in: dto.orderIds },
        tenantId,
      };
    } else {
      // Find orders in the period -- since there's no direct org-patient link,
      // we select orders that already have b2b line items for this org,
      // OR orders within the date range that haven't been B2B-invoiced yet.
      // In practice, a lab would select orders explicitly. We'll find un-invoiced
      // orders in the period.
      orderWhere = {
        tenantId,
        createdAt: { gte: periodStart, lte: periodEnd },
        // Only orders not already on a B2B line item for this org
        NOT: {
          b2bLineItems: {
            some: {
              invoice: { organizationId: dto.organizationId },
            },
          },
        },
      };
    }

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        items: {
          include: { testCatalog: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (orders.length === 0) {
      throw new BadRequestException("No orders found for the given criteria");
    }

    // Build line items
    const lineItems: Array<{
      orderId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPct: number;
      totalPrice: number;
    }> = [];

    let subtotal = 0;

    for (const order of orders) {
      const patientName = `${order.patient.firstName} ${order.patient.lastName}`;
      const testNames = order.items.map((i) => i.testCatalog.name).join(", ");
      const orderTotal = Number(order.netAmount);
      const discountedPrice = orderTotal * (1 - org.discountPct / 100);

      lineItems.push({
        orderId: order.id,
        description: `${patientName} (${order.patient.mrn}) — ${testNames}`,
        quantity: 1,
        unitPrice: orderTotal,
        discountPct: org.discountPct,
        totalPrice: Math.round(discountedPrice * 100) / 100,
      });

      subtotal += Math.round(discountedPrice * 100) / 100;
    }

    const discountAmount = lineItems.reduce(
      (sum, li) => sum + (li.unitPrice - li.totalPrice),
      0,
    );
    const taxRate = 0.18; // 18% GST
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const invoiceNumber = await this.generateInvoiceNumber(tenantId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + org.creditDays);

    // Create invoice + line items in a transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.b2BInvoice.create({
        data: {
          tenantId,
          invoiceNumber,
          organizationId: org.id,
          periodStart,
          periodEnd,
          dueDate,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: B2B_STATUS.DRAFT,
          notes: dto.notes,
          lineItems: {
            create: lineItems.map((li) => ({
              orderId: li.orderId,
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              discountPct: li.discountPct,
              totalPrice: li.totalPrice,
            })),
          },
        },
        include: {
          lineItems: true,
          organization: { select: { name: true, code: true } },
        },
      });

      // Update organization outstanding and stats
      await tx.organization.update({
        where: { id: org.id },
        data: {
          currentOutstanding: { increment: totalAmount },
          totalOrders: { increment: orders.length },
          totalRevenue: { increment: totalAmount },
        },
      });

      return inv;
    });

    this.logger.log(
      `B2B Invoice ${invoiceNumber} generated for org ${org.name}: ${totalAmount}`,
    );

    return invoice;
  }

  // ── Send Invoice ──────────────────────────────────────────────────────────

  async sendInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.b2BInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        organization: true,
      },
    });
    if (!invoice) throw new NotFoundException("B2B Invoice not found");
    if (invoice.status !== B2B_STATUS.DRAFT) {
      throw new BadRequestException("Can only send DRAFT invoices");
    }

    await this.prisma.b2BInvoice.update({
      where: { id: invoiceId },
      data: { status: B2B_STATUS.SENT },
    });

    // Send email to organization if email is available
    if (invoice.organization.email) {
      try {
        await this.emailService.sendMail({
          to: invoice.organization.email,
          subject: `Invoice ${invoice.invoiceNumber} from DELViON Health`,
          html: `
            <h2>Invoice ${invoice.invoiceNumber}</h2>
            <p>Dear ${invoice.organization.contactPerson ?? invoice.organization.name},</p>
            <p>Please find attached your invoice for the period
              ${invoice.periodStart.toLocaleDateString("en-IN")} to
              ${invoice.periodEnd.toLocaleDateString("en-IN")}.</p>
            <p><strong>Total Amount:</strong> ₹${invoice.totalAmount.toLocaleString("en-IN")}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString("en-IN")}</p>
            <p>Thank you for your business.</p>
            <p>DELViON Health</p>
          `,
        });
      } catch (err) {
        this.logger.warn(`Failed to send B2B invoice email: ${String(err)}`);
      }
    }

    return { success: true, message: "Invoice sent" };
  }

  // ── Record Payment ────────────────────────────────────────────────────────

  async recordPayment(
    invoiceId: string,
    dto: RecordB2BPaymentDto,
    tenantId: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.b2BInvoice.findFirst({
        where: { id: invoiceId, tenantId },
      });
      if (!invoice) throw new NotFoundException("B2B Invoice not found");
      if (
        invoice.status === B2B_STATUS.PAID ||
        invoice.status === B2B_STATUS.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot record payment on ${invoice.status} invoice`,
        );
      }

      const outstanding = invoice.totalAmount - invoice.paidAmount;
      if (dto.amount > outstanding + 0.01) {
        throw new BadRequestException(
          `Payment amount ₹${dto.amount} exceeds outstanding balance ₹${outstanding.toFixed(2)}`,
        );
      }

      const payment = await tx.b2BPayment.create({
        data: {
          tenantId,
          invoiceId,
          amount: dto.amount,
          paymentMode: dto.paymentMode,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          referenceNo: dto.referenceNo,
          notes: dto.notes,
          recordedById: userId,
        },
      });

      const newPaid = invoice.paidAmount + dto.amount;
      const newStatus =
        newPaid >= invoice.totalAmount - 0.01
          ? B2B_STATUS.PAID
          : B2B_STATUS.PARTIAL;

      await tx.b2BInvoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaid, status: newStatus },
      });

      // Update organization outstanding
      await tx.organization.update({
        where: { id: invoice.organizationId },
        data: { currentOutstanding: { decrement: dto.amount } },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "B2B_PAYMENT_RECORDED",
          entity: "B2BInvoice",
          entityId: invoiceId,
          newValue: {
            amount: dto.amount,
            paymentMode: dto.paymentMode,
            paymentId: payment.id,
          },
        },
      });

      return payment;
    });
  }

  // ── PDF Generation ────────────────────────────────────────────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer") as typeof import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateInvoicePDF(invoiceId: string, tenantId: string): Promise<string> {
    const invoice = await this.findOne(invoiceId, tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, config: true },
    });
    const cfg = (tenant.config ?? {}) as Record<string, string>;

    const templateData: B2BInvoiceTemplateData = {
      tenant: {
        name: tenant.name,
        phone: cfg["phone"],
        email: cfg["email"],
        gstin: cfg["gstin"],
        address: cfg["address"],
        bankName: cfg["bankName"],
        bankAccount: cfg["bankAccount"],
        bankIfsc: cfg["bankIfsc"],
      },
      organization: {
        name: invoice.organization.name,
        code: invoice.organization.code,
        contactPerson: invoice.organization.contactPerson,
        email: invoice.organization.email,
        phone: invoice.organization.phone,
        address: invoice.organization.address,
        gstNumber: invoice.organization.gstNumber,
      },
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        generatedAt: invoice.generatedAt,
        dueDate: invoice.dueDate,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        subtotal: invoice.subtotal,
        discountAmount: invoice.discountAmount,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        status: invoice.status,
      },
      lineItems: invoice.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPct: li.discountPct,
        totalPrice: li.totalPrice,
      })),
      payments: invoice.payments.map((p) => ({
        amount: p.amount,
        paymentMode: p.paymentMode,
        paymentDate: p.paymentDate,
        referenceNo: p.referenceNo,
      })),
    };

    const html = generateB2BInvoiceHtml(templateData);
    const buffer = await this.renderPdf(html);
    const objectKey = `b2b-invoices/${tenantId}/${invoice.invoiceNumber}.pdf`;
    await this.minio.upload(objectKey, buffer, "application/pdf");
    await this.prisma.b2BInvoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: objectKey },
    });

    return this.minio.getPresignedUrl(objectKey, 3600);
  }

  async getDownloadUrl(invoiceId: string, tenantId: string): Promise<{ url: string }> {
    const invoice = await this.prisma.b2BInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { pdfUrl: true },
    });
    if (!invoice) throw new NotFoundException("B2B Invoice not found");
    if (invoice.pdfUrl) {
      return { url: await this.minio.getPresignedUrl(invoice.pdfUrl, 3600) };
    }
    const url = await this.generateInvoicePDF(invoiceId, tenantId);
    return { url };
  }

  // ── Organization Statement ────────────────────────────────────────────────

  async getOrganizationStatement(
    tenantId: string,
    orgId: string,
    fromDate: string,
    toDate: string,
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, tenantId },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Invoices in period
    const invoices = await this.prisma.b2BInvoice.findMany({
      where: {
        tenantId,
        organizationId: orgId,
        generatedAt: { gte: from, lte: to },
      },
      orderBy: { generatedAt: "asc" },
      select: {
        id: true,
        invoiceNumber: true,
        generatedAt: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
      },
    });

    // Payments in period
    const payments = await this.prisma.b2BPayment.findMany({
      where: {
        tenantId,
        invoice: { organizationId: orgId },
        paymentDate: { gte: from, lte: to },
      },
      orderBy: { paymentDate: "asc" },
      select: {
        id: true,
        amount: true,
        paymentMode: true,
        paymentDate: true,
        referenceNo: true,
        invoice: { select: { invoiceNumber: true } },
      },
    });

    // Opening balance: all invoices before period minus all payments before period
    const [invoicesBefore, paymentsBefore] = await Promise.all([
      this.prisma.b2BInvoice.aggregate({
        where: {
          tenantId,
          organizationId: orgId,
          generatedAt: { lt: from },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.b2BPayment.aggregate({
        where: {
          tenantId,
          invoice: { organizationId: orgId },
          paymentDate: { lt: from },
        },
        _sum: { amount: true },
      }),
    ]);

    const openingBalance =
      (invoicesBefore._sum.totalAmount ?? 0) -
      (paymentsBefore._sum.amount ?? 0);

    const periodInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const periodPaid = payments.reduce((s, p) => s + p.amount, 0);
    const closingBalance = openingBalance + periodInvoiced - periodPaid;

    return {
      organization: { id: org.id, name: org.name, code: org.code },
      period: { from: fromDate, to: toDate },
      openingBalance: Math.round(openingBalance * 100) / 100,
      invoices,
      payments,
      periodInvoiced: Math.round(periodInvoiced * 100) / 100,
      periodPaid: Math.round(periodPaid * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
    };
  }

  // ── Outstanding Report ────────────────────────────────────────────────────

  async getOutstandingReport(tenantId: string) {
    const orgs = await this.prisma.organization.findMany({
      where: { tenantId, currentOutstanding: { gt: 0 } },
      orderBy: { currentOutstanding: "desc" },
      select: {
        id: true,
        name: true,
        code: true,
        currentOutstanding: true,
        creditDays: true,
        totalOrders: true,
        totalRevenue: true,
        contactPerson: true,
        phone: true,
        email: true,
      },
    });

    // For each org, get oldest unpaid invoice
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const oldestUnpaid = await this.prisma.b2BInvoice.findFirst({
          where: {
            tenantId,
            organizationId: org.id,
            status: { in: [B2B_STATUS.SENT, B2B_STATUS.PARTIAL, B2B_STATUS.OVERDUE] },
          },
          orderBy: { dueDate: "asc" },
          select: { invoiceNumber: true, dueDate: true, totalAmount: true, paidAmount: true },
        });

        const daysOverdue = oldestUnpaid?.dueDate
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(oldestUnpaid.dueDate).getTime()) / 86_400_000,
              ),
            )
          : 0;

        return { ...org, oldestUnpaid, daysOverdue };
      }),
    );

    const totalOutstanding = orgs.reduce((s, o) => s + o.currentOutstanding, 0);

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      organizationCount: orgs.length,
      organizations: enriched,
    };
  }

  // ── Find All ──────────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: B2BInvoiceQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.B2BInvoiceWhereInput = {
      tenantId,
      ...(query.organizationId && { organizationId: query.organizationId }),
      ...(query.status && { status: query.status as never }),
      ...(query.dateFrom || query.dateTo
        ? {
            generatedAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
      ...(query.search && {
        OR: [
          { invoiceNumber: { contains: query.search, mode: "insensitive" } },
          { organization: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.b2BInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            select: { id: true, name: true, code: true },
          },
          _count: { select: { lineItems: true } },
        },
      }),
      this.prisma.b2BInvoice.count({ where }),
    ]);

    const enriched = invoices.map((inv) => {
      const balance = inv.totalAmount - inv.paidAmount;
      const isOverdue =
        inv.dueDate < new Date() &&
        inv.status !== B2B_STATUS.PAID &&
        inv.status !== B2B_STATUS.CANCELLED;
      return { ...inv, balance, isOverdue };
    });

    return {
      data: enriched,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Find One ──────────────────────────────────────────────────────────────

  async findOne(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.b2BInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        organization: true,
        lineItems: {
          include: {
            order: {
              select: { orderNumber: true, patient: { select: { firstName: true, lastName: true, mrn: true } } },
            },
          },
        },
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!invoice) throw new NotFoundException("B2B Invoice not found");

    const balance = invoice.totalAmount - invoice.paidAmount;
    const isOverdue =
      invoice.dueDate < new Date() &&
      invoice.status !== B2B_STATUS.PAID &&
      invoice.status !== B2B_STATUS.CANCELLED;

    return { ...invoice, balance, isOverdue };
  }
}

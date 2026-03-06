import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MinioService } from "../reports/minio.service";
import { NotificationsService } from "../notifications/notifications.service";
import { generateInvoiceHtml } from "./templates/invoice.template";
import type { InvoiceTemplateData } from "./templates/invoice.template";
import { InvoiceStatus, PaymentMethod, PaymentStatus, ClaimStatus } from "@delvion/types";
import type { Prisma } from "@prisma/client";
import type { InvoiceQueryDto } from "./dto/invoice-query.dto";
import type { RecordPaymentDto } from "./dto/record-payment.dto";
import type { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import type { IssueRefundDto } from "./dto/issue-refund.dto";
import type { CreateInsuranceClaimDto } from "./dto/create-insurance-claim.dto";
import type { UpdateClaimStatusDto } from "./dto/update-claim-status.dto";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly notifications: NotificationsService
  ) {}

  // ── Invoice number generation ─────────────────────────────────────────────

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(
              `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00.000Z`
            ),
          },
        },
      });
      return `DH-INV-${dateStr}-${String(count + 1).padStart(4, "0")}`;
    });
  }

  // ── Invoice CRUD ───────────────────────────────────────────────────────────

  async getInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true, phone: true, email: true, address: true },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            items: { include: { testCatalog: { select: { name: true, code: true } } } },
          },
        },
        payments: { orderBy: { paidAt: "desc" } },
        insuranceClaims: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const completedPayments = invoice.payments.filter((p) => p.status === PaymentStatus.COMPLETED);
    const amountPaid = completedPayments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Number(invoice.total) - amountPaid;
    const isOverdue =
      invoice.dueDate != null &&
      new Date(invoice.dueDate) < new Date() &&
      invoice.status !== InvoiceStatus.PAID &&
      invoice.status !== InvoiceStatus.CANCELLED;

    return { ...invoice, amountPaid, balance, isOverdue };
  }

  async findAll(tenantId: string, query: InvoiceQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(query.status && { status: query.status }),
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
      ...(query.overdue && {
        dueDate: { lt: now },
        status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
      }),
      ...(query.search && {
        OR: [
          { invoiceNumber: { contains: query.search, mode: "insensitive" } },
          { patient: { firstName: { contains: query.search, mode: "insensitive" } } },
          { patient: { lastName: { contains: query.search, mode: "insensitive" } } },
          { patient: { mrn: { contains: query.search, mode: "insensitive" } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          order: { select: { id: true, orderNumber: true } },
          payments: { where: { status: PaymentStatus.COMPLETED }, select: { amount: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const enriched = invoices.map((inv) => {
      const amountPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const balance = Number(inv.total) - amountPaid;
      const isOverdue =
        inv.dueDate != null &&
        new Date(inv.dueDate) < now &&
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.CANCELLED;
      return { ...inv, amountPaid, balance, isOverdue };
    });

    return { data: enriched, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateInvoice(invoiceId: string, dto: UpdateInvoiceDto, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.SENT) {
      throw new BadRequestException("Can only edit DRAFT or SENT invoices");
    }
    const newDiscount = dto.discountAmount ?? Number(invoice.discount);
    const newTax = dto.taxAmount ?? Number(invoice.tax);
    const newTotal = Number(invoice.subtotal) - newDiscount + newTax;

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        discount: newDiscount,
        tax: newTax,
        total: newTotal,
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  // ── Payment recording ──────────────────────────────────────────────────────

  async recordPayment(dto: RecordPaymentDto, tenantId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId },
        include: { payments: { where: { status: PaymentStatus.COMPLETED } } },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException("Cannot record payment on cancelled invoice");
      }

      const currentPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = Number(invoice.total) - currentPaid;

      if (dto.amount > outstanding + 0.01) {
        throw new BadRequestException(
          `Payment amount ₹${dto.amount} exceeds outstanding balance ₹${outstanding.toFixed(2)}`
        );
      }

      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          status: PaymentStatus.COMPLETED,
          recordedById: userId,
          notes: dto.notes,
        },
      });

      const newPaid = currentPaid + dto.amount;
      const newStatus =
        newPaid >= Number(invoice.total) - 0.01
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          status: newStatus,
          ...(newStatus === InvoiceStatus.PAID && { paidAt: new Date() }),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "PAYMENT_RECORDED",
          entity: "Invoice",
          entityId: dto.invoiceId,
          newValue: { amount: dto.amount, method: dto.method, paymentId: payment.id },
        },
      });

      return payment;
    });
  }

  async issueRefund(dto: IssueRefundDto, tenantId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.payment.findFirst({ where: { id: dto.paymentId, tenantId } });
      if (!original) throw new NotFoundException("Payment not found");
      if (original.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException("Can only refund COMPLETED payments");
      }
      if (dto.amount > Number(original.amount)) {
        throw new BadRequestException("Refund amount exceeds original payment");
      }

      const refund = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: original.invoiceId,
          amount: -dto.amount,
          method: original.method,
          reference: `REFUND-${original.id.slice(-6)}`,
          status: PaymentStatus.COMPLETED,
          recordedById: userId,
          notes: dto.reason,
          paidAt: new Date(),
        },
      });

      await tx.payment.update({ where: { id: dto.paymentId }, data: { status: PaymentStatus.REFUNDED } });

      const invoice = await tx.invoice.findUnique({
        where: { id: original.invoiceId },
        include: { payments: { where: { status: PaymentStatus.COMPLETED } } },
      });
      if (invoice) {
        const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
        const balance = Number(invoice.total) - paid;
        const newStatus =
          balance <= 0.01
            ? InvoiceStatus.PAID
            : paid > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : InvoiceStatus.SENT;
        await tx.invoice.update({
          where: { id: original.invoiceId },
          data: { status: newStatus, ...(balance > 0.01 && { paidAt: null }) },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "PAYMENT_REFUNDED",
          entity: "Payment",
          entityId: original.id,
          newValue: { refundAmount: dto.amount, reason: dto.reason },
        },
      });

      return refund;
    });
  }

  // ── PDF generation ─────────────────────────────────────────────────────────

  private async renderInvoicePdf(html: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer") as typeof import("puppeteer");
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateInvoicePdf(invoiceId: string, tenantId: string): Promise<string> {
    const inv = await this.getInvoice(invoiceId, tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, config: true },
    });
    const cfg = (tenant.config ?? {}) as Record<string, string>;

    const templateData: InvoiceTemplateData = {
      tenant: {
        name: tenant.name,
        phone: cfg["phone"],
        email: cfg["email"],
        gstin: cfg["gstin"],
      },
      patient: {
        fullName: `${inv.patient.firstName} ${inv.patient.lastName}`,
        mrn: inv.patient.mrn,
        phone: inv.patient.phone,
        email: inv.patient.email,
        address: inv.patient.address,
      },
      invoice: {
        invoiceNumber: inv.invoiceNumber,
        createdAt: inv.createdAt,
        dueDate: inv.dueDate,
        subtotal: Number(inv.subtotal),
        discount: Number(inv.discount),
        tax: Number(inv.tax),
        total: Number(inv.total),
        status: inv.status,
      },
      order: {
        orderNumber: inv.order.orderNumber,
        orderItems: inv.order.items.map((item) => ({
          testName: item.testCatalog.name,
          price: Number(item.price),
          quantity: item.quantity,
        })),
      },
      payments: inv.payments
        .filter((p) => p.status === PaymentStatus.COMPLETED && Number(p.amount) > 0)
        .map((p) => ({ amount: Number(p.amount), method: p.method, paidAt: p.paidAt, reference: p.reference })),
      amountPaid: inv.amountPaid,
      balance: inv.balance,
    };

    const html = generateInvoiceHtml(templateData);
    const buffer = await this.renderInvoicePdf(html);
    const objectKey = `invoices/${tenantId}/${inv.invoiceNumber}.pdf`;
    await this.minio.upload(objectKey, buffer, "application/pdf");
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl: objectKey } });

    return this.minio.getPresignedUrl(objectKey, 3600);
  }

  async getInvoiceDownloadUrl(invoiceId: string, tenantId: string): Promise<{ url: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { pdfUrl: true },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.pdfUrl) {
      return { url: await this.minio.getPresignedUrl(invoice.pdfUrl, 3600) };
    }
    const url = await this.generateInvoicePdf(invoiceId, tenantId);
    return { url };
  }

  // ── Receivables / AR Aging ─────────────────────────────────────────────────

  async getReceivables(tenantId: string) {
    const now = new Date();
    const ago30 = new Date(now.getTime() - 30 * 86_400_000);
    const ago60 = new Date(now.getTime() - 60 * 86_400_000);
    const ago90 = new Date(now.getTime() - 90 * 86_400_000);

    const openInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] } },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        payments: { where: { status: PaymentStatus.COMPLETED }, select: { amount: true } },
      },
    });

    const buckets = {
      current: { count: 0, total: 0 },
      days_1_30: { count: 0, total: 0 },
      days_31_60: { count: 0, total: 0 },
      days_61_90: { count: 0, total: 0 },
      days_90_plus: { count: 0, total: 0 },
    };
    const overdueList: Array<{
      patient: string;
      invoiceNumber: string;
      daysOverdue: number;
      balance: number;
    }> = [];

    for (const inv of openInvoices) {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const balance = Number(inv.total) - paid;
      if (balance <= 0) continue;

      const due = inv.dueDate;
      if (!due || due >= now) {
        buckets.current.count++;
        buckets.current.total += balance;
      } else {
        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
        overdueList.push({
          patient: `${inv.patient.firstName} ${inv.patient.lastName}`,
          invoiceNumber: inv.invoiceNumber,
          daysOverdue,
          balance,
        });
        if (due >= ago30) {
          buckets.days_1_30.count++;
          buckets.days_1_30.total += balance;
        } else if (due >= ago60) {
          buckets.days_31_60.count++;
          buckets.days_31_60.total += balance;
        } else if (due >= ago90) {
          buckets.days_61_90.count++;
          buckets.days_61_90.total += balance;
        } else {
          buckets.days_90_plus.count++;
          buckets.days_90_plus.total += balance;
        }
      }
    }

    overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return { buckets, topOverdue: overdueList.slice(0, 10) };
  }

  async getCollectionSummary(tenantId: string, dateFrom: Date, dateTo: Date) {
    const [invoicesAgg, paymentsData] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: { total: true },
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: dateFrom, lte: dateTo },
          amount: { gt: 0 },
        },
        select: { amount: true, method: true, paidAt: true },
      }),
    ]);

    const totalInvoiced = Number(invoicesAgg._sum.total ?? 0);
    const totalCollected = paymentsData.reduce((s, p) => s + Number(p.amount), 0);
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    const byMethod: Record<string, number> = {};
    for (const p of paymentsData) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
    }

    const dailyMap = new Map<string, number>();
    for (const p of paymentsData) {
      const day = p.paidAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(p.amount));
    }
    const dailyCollection = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      total_outstanding: totalInvoiced - totalCollected,
      collection_rate: Math.round(collectionRate * 100) / 100,
      by_method: byMethod,
      daily_collection: dailyCollection,
    };
  }

  // ── Insurance Claims ───────────────────────────────────────────────────────

  async createInsuranceClaim(dto: CreateInsuranceClaimDto, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException("Invoice not found");

    return this.prisma.insuranceClaim.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId,
        insurerName: dto.insurerName,
        memberId: dto.memberId,
        claimNumber: dto.claimNumber,
        amount: dto.claimAmount,
        notes: dto.notes,
        status: ClaimStatus.DRAFT,
      },
    });
  }

  async updateClaimStatus(claimId: string, dto: UpdateClaimStatusDto, tenantId: string, userId: string) {
    const claim = await this.prisma.insuranceClaim.findFirst({ where: { id: claimId, tenantId } });
    if (!claim) throw new NotFoundException("Claim not found");

    const now = new Date();
    const updateData: Prisma.InsuranceClaimUpdateInput = {
      status: dto.status,
      ...(dto.notes && { notes: dto.notes }),
      ...(dto.status === ClaimStatus.APPROVED && {
        approvedAmount: dto.approvedAmount ?? claim.amount,
      }),
      ...(dto.status === ClaimStatus.REJECTED && {
        rejectionReason: dto.rejectionReason,
      }),
      ...(dto.status === ClaimStatus.SETTLED && { settledAt: now }),
      ...(dto.status === ClaimStatus.SUBMITTED && { submittedAt: now }),
    };

    const updated = await this.prisma.insuranceClaim.update({ where: { id: claimId }, data: updateData });

    if (dto.status === ClaimStatus.APPROVED && dto.approvedAmount) {
      await this.recordPayment(
        {
          invoiceId: claim.invoiceId,
          amount: dto.approvedAmount,
          method: PaymentMethod.INSURANCE,
          reference: claim.claimNumber ?? undefined,
        },
        tenantId,
        userId
      );
    }

    return updated;
  }

  async findClaims(
    tenantId: string,
    query: { status?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string }
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.InsuranceClaimWhereInput = {
      tenantId,
      ...(query.status && { status: query.status as ClaimStatus }),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
    };
    const [claims, total] = await Promise.all([
      this.prisma.insuranceClaim.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              patient: { select: { firstName: true, lastName: true, mrn: true } },
              order: { select: { orderNumber: true } },
            },
          },
        },
      }),
      this.prisma.insuranceClaim.count({ where }),
    ]);
    return { data: claims, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getPaymentsByInvoice(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.prisma.payment.findMany({ where: { invoiceId, tenantId }, orderBy: { paidAt: "desc" } });
  }

  // ── Denial Management ──────────────────────────────────────────────────────

  async recordDenial(claimId: string, dto: { denialCode: string; denialReason: string }, tenantId: string) {
    return this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: { denialCode: dto.denialCode, denialReason: dto.denialReason, status: "REJECTED" as never },
    });
  }

  async appealClaim(claimId: string, dto: { appealNotes: string }, tenantId: string) {
    return this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: { appealNotes: dto.appealNotes, appealedAt: new Date(), status: "APPEALED" as never },
    });
  }

  async resubmitClaim(claimId: string, tenantId: string) {
    return this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: { resubmittedAt: new Date(), status: "SUBMITTED" as never },
    });
  }

  async getDenialDashboard(tenantId: string) {
    const denied = await this.prisma.insuranceClaim.findMany({
      where: { tenantId, status: "REJECTED" as never },
      select: { denialCode: true, denialReason: true, amount: true, appealedAt: true, resubmittedAt: true, createdAt: true },
    });

    const byCode = new Map<string, number>();
    let appealed = 0;
    let resubmitted = 0;
    for (const c of denied) {
      const code = c.denialCode ?? "UNKNOWN";
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
      if (c.appealedAt) appealed++;
      if (c.resubmittedAt) resubmitted++;
    }

    const codeBreakdown = Array.from(byCode.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const appealSuccessRate = appealed > 0 ? Math.round((resubmitted / appealed) * 100) : 0;

    return { totalDenied: denied.length, appealed, resubmitted, appealSuccessRate, codeBreakdown };
  }

  // ── Payment Plans ──────────────────────────────────────────────────────────

  async createPaymentPlan(
    dto: { patientId: string; invoiceId: string; totalAmount: number; installmentCount: number; frequency: string; notes?: string },
    tenantId: string,
    userId: string
  ) {
    const freqDays: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30, CUSTOM: 30 };
    const days = freqDays[dto.frequency] ?? 30;
    const installmentAmount = dto.totalAmount / dto.installmentCount;
    const today = new Date();

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.patientPaymentPlan.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          invoiceId: dto.invoiceId,
          totalAmount: dto.totalAmount,
          frequency: dto.frequency as never,
          installmentCount: dto.installmentCount,
          nextDueDate: new Date(today.getTime() + days * 86400000),
          notes: dto.notes,
          createdById: userId,
        },
      });

      const installments = Array.from({ length: dto.installmentCount }, (_, i) => ({
        planId: plan.id,
        dueDate: new Date(today.getTime() + (i + 1) * days * 86400000),
        amount: installmentAmount,
        status: "DRAFT" as never,
      }));

      await tx.paymentPlanInstallment.createMany({ data: installments });

      return tx.patientPaymentPlan.findUnique({ where: { id: plan.id }, include: { installments: true } });
    });
  }

  async findPaymentPlans(
    tenantId: string,
    query: { patientId?: string; status?: string; page?: number; limit?: number }
  ) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.patientId) where["patientId"] = query.patientId;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.patientPaymentPlan.findMany({
        where,
        include: {
          patient: { select: { firstName: true, lastName: true, mrn: true } },
          invoice: { select: { invoiceNumber: true, total: true } },
          installments: { orderBy: { dueDate: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.patientPaymentPlan.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async recordInstallmentPayment(
    planId: string,
    installmentId: string,
    paymentData: { amount: number; method: string; reference?: string },
    tenantId: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const installment = await tx.paymentPlanInstallment.findUnique({ where: { id: installmentId } });
      if (!installment) throw new Error("Installment not found");

      await tx.paymentPlanInstallment.update({
        where: { id: installmentId },
        data: { paidAt: new Date(), status: "PAID" as never },
      });

      const plan = await tx.patientPaymentPlan.findUnique({ where: { id: planId }, include: { installments: true } });
      if (!plan) throw new Error("Plan not found");

      const newPaidAmount = Number(plan.paidAmount) + paymentData.amount;
      const isCompleted = newPaidAmount >= Number(plan.totalAmount);

      // Find next unpaid installment for nextDueDate
      const nextUnpaid = plan.installments.find((i) => i.status === "DRAFT" && i.id !== installmentId);

      await tx.patientPaymentPlan.update({
        where: { id: planId },
        data: {
          paidAmount: newPaidAmount,
          status: isCompleted ? ("COMPLETED" as never) : ("ACTIVE" as never),
          nextDueDate: nextUnpaid?.dueDate ?? plan.nextDueDate,
        },
      });

      return { paid: true, isCompleted, remainingAmount: Number(plan.totalAmount) - newPaidAmount };
    });
  }

  async uploadPaymentProof(file: Express.Multer.File, tenantId: string) {
    const key = `payment-proofs/${tenantId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    try {
      await this.minio.upload(key, file.buffer, file.mimetype);
      const url = await this.minio.getPresignedUrl(key, 86400 * 7);
      return { url, key, name: file.originalname, size: file.size };
    } catch {
      // Fallback: return base64 inline
      const base64 = file.buffer.toString("base64");
      return {
        url: `data:${file.mimetype};base64,${base64}`,
        key: `inline-${tenantId}-${Date.now()}`,
        name: file.originalname,
        size: file.size,
      };
    }
  }
}

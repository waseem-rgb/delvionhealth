import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { JournalService } from "./journal.service";

@Injectable()
export class ReceivablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  // createInvoice: Create finance invoice + auto-post journal
  // Invoice types: PATIENT, INSURANCE, CORPORATE
  // Journal: DEBIT AR (1200=patient, 1201=insurance, 1202=corporate), CREDIT Revenue (4001)
  // Auto-generate invoiceNumber: INV-YYYY-NNNNN
  async createInvoice(dto: {
    orderId?: string;
    patientId?: string;
    organizationId?: string;
    invoiceType?: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    notes?: string;
    dueDate?: string;
    items?: Array<{ testName: string; price: number; discount?: number; finalPrice: number }>;
  }, tenantId: string, userId: string) {
    const type = dto.invoiceType ?? "PATIENT";
    const discount = dto.discount ?? 0;
    const tax = dto.tax ?? 0;
    const total = dto.subtotal - discount + tax;

    // Generate invoice number
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, "0")}`;

    // Determine AR ledger based on type
    const arCodeMap: Record<string, string> = { PATIENT: "1200", INSURANCE: "1201", CORPORATE: "1202" };
    const arCode = arCodeMap[type] ?? "1200";
    const arAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: arCode } });
    const revenueAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: "4001" } });

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        orderId: dto.orderId ?? "",
        patientId: dto.patientId ?? "",
        subtotal: dto.subtotal,
        discount,
        tax,
        total,
        balance: total,
        status: "SENT",
        invoiceType: type,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30*24*60*60*1000),
        notes: dto.notes,
        createdById: userId,
        items: dto.items ? {
          create: dto.items.map(item => ({
            testName: item.testName,
            price: item.price,
            discount: item.discount ?? 0,
            finalPrice: item.finalPrice,
          })),
        } : undefined,
      },
      include: { items: true },
    });

    // Auto-post journal entry
    if (arAccount && revenueAccount) {
      try {
        await this.journal.createJournal({
          tenantId,
          date: new Date().toISOString(),
          narration: `Invoice ${invoiceNumber} - ${type}`,
          refType: "INVOICE",
          refId: invoice.id,
          postedBy: userId,
          lines: [
            { ledgerAccountId: arAccount.id, type: "DEBIT", amount: total },
            { ledgerAccountId: revenueAccount.id, type: "CREDIT", amount: total },
          ],
        });
      } catch (e) {
        // Journal posting is best-effort; don't fail invoice creation
      }
    }

    return invoice;
  }

  // recordPayment: Record payment against invoice, auto-post journal
  // Journal: DEBIT Bank/Cash, CREDIT AR
  // Update invoice.amountPaid, invoice.balance, status
  async recordPayment(dto: {
    invoiceId: string;
    amount: number;
    method: string;
    reference?: string;
    bankAccountId?: string;
    notes?: string;
  }, tenantId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method as any,
        reference: dto.reference,
        bankAccountId: dto.bankAccountId,
        recordedById: userId,
        notes: dto.notes,
        status: "COMPLETED",
      },
    });

    // Update invoice paid/balance
    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    const newBalance = Number(invoice.total) - newAmountPaid;
    const newStatus = newBalance <= 0 ? "PAID" : "PARTIALLY_PAID";

    await this.prisma.invoice.update({
      where: { id: dto.invoiceId },
      data: {
        amountPaid: newAmountPaid,
        balance: Math.max(0, newBalance),
        status: newStatus as any,
        paidAt: newBalance <= 0 ? new Date() : undefined,
      },
    });

    // Auto-post journal: DEBIT Bank/Cash, CREDIT AR
    const type = (invoice as any).invoiceType ?? "PATIENT";
    const arCodeMap: Record<string, string> = { PATIENT: "1200", INSURANCE: "1201", CORPORATE: "1202" };
    const cashOrBank = dto.method === "CASH" ? "1001" : "1100";
    const arAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: arCodeMap[type] ?? "1200" } });
    const bankAccount = await this.prisma.gLAccount.findFirst({ where: { tenantId, code: cashOrBank } });

    if (arAccount && bankAccount) {
      try {
        await this.journal.createJournal({
          tenantId,
          date: new Date().toISOString(),
          narration: `Payment received for ${invoice.invoiceNumber}`,
          refType: "PAYMENT",
          refId: payment.id,
          postedBy: userId,
          lines: [
            { ledgerAccountId: bankAccount.id, type: "DEBIT", amount: dto.amount },
            { ledgerAccountId: arAccount.id, type: "CREDIT", amount: dto.amount },
          ],
        });
      } catch (e) {}
    }

    return payment;
  }

  // getAgingReport: Return aging buckets
  async getAgingReport(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] as any },
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
    });

    const now = new Date();
    const buckets = { current: [] as any[], days_1_30: [] as any[], days_31_60: [] as any[], days_61_90: [] as any[], over_90: [] as any[] };

    for (const inv of invoices) {
      const due = inv.dueDate ? new Date(inv.dueDate) : now;
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000*60*60*24)));
      const entry = {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        patientName: inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : "N/A",
        amount: Number(inv.balance),
        total: Number(inv.total),
        daysOverdue,
        dueDate: inv.dueDate,
        status: inv.status,
      };

      if (daysOverdue <= 0) buckets.current.push(entry);
      else if (daysOverdue <= 30) buckets.days_1_30.push(entry);
      else if (daysOverdue <= 60) buckets.days_31_60.push(entry);
      else if (daysOverdue <= 90) buckets.days_61_90.push(entry);
      else buckets.over_90.push(entry);
    }

    return {
      buckets,
      summary: {
        current: buckets.current.reduce((s, e) => s + e.amount, 0),
        days_1_30: buckets.days_1_30.reduce((s, e) => s + e.amount, 0),
        days_31_60: buckets.days_31_60.reduce((s, e) => s + e.amount, 0),
        days_61_90: buckets.days_61_90.reduce((s, e) => s + e.amount, 0),
        over_90: buckets.over_90.reduce((s, e) => s + e.amount, 0),
        totalOutstanding: invoices.reduce((s, inv) => s + Number(inv.balance), 0),
      },
    };
  }

  // getInvoices with filters
  async getInvoices(tenantId: string, filters: { status?: string; type?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where: any = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.invoiceType = filters.type;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { patient: { select: { firstName: true, lastName: true, mrn: true } }, items: true, payments: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // getInvoiceById
  async getInvoiceById(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { patient: true, items: true, payments: true, insuranceClaims: true },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  // Insurance claims
  async getInsuranceClaims(tenantId: string) {
    return this.prisma.insuranceClaim.findMany({
      where: { tenantId },
      include: { invoice: { select: { invoiceNumber: true, total: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateInsuranceClaim(id: string, tenantId: string, dto: { status?: string; approvedAmount?: number; rejectionReason?: string }) {
    const claim = await this.prisma.insuranceClaim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException("Claim not found");
    return this.prisma.insuranceClaim.update({
      where: { id },
      data: {
        status: dto.status as any,
        approvedAmount: dto.approvedAmount,
        rejectionReason: dto.rejectionReason,
        settledAt: dto.status === "SETTLED" ? new Date() : undefined,
      },
    });
  }
}

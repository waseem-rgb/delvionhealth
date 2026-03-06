import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { LeadStatus, NoteType } from "@delvion/types";
import type { Prisma } from "@prisma/client";
import type { CreateDoctorDto } from "./dto/create-doctor.dto";
import type { UpdateDoctorDto } from "./dto/update-doctor.dto";
import type { LogVisitDto } from "./dto/log-visit.dto";
import type { DoctorQueryDto } from "./dto/doctor-query.dto";
import type { CreateLeadDto } from "./dto/create-lead.dto";
import type { UpdateLeadStatusDto } from "./dto/update-lead-status.dto";
import type { AddLeadNoteDto } from "./dto/add-lead-note.dto";

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService
  ) {}

  // ── Doctor CRUD ────────────────────────────────────────────────────────────

  async createDoctor(dto: CreateDoctorDto, tenantId: string) {
    return this.prisma.doctor.create({
      data: {
        tenantId,
        name: dto.name,
        specialty: dto.specialty,
        phone: dto.phone,
        email: dto.email,
        clinicName: dto.clinicName,
        address: dto.address,
        clinicAddress: dto.clinicAddress,
        city: dto.city,
        registrationNumber: dto.registrationNumber,
      },
    });
  }

  async findAllDoctors(tenantId: string, query: DoctorQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DoctorWhereInput = {
      tenantId,
      ...(query.isActive !== undefined && { isActive: query.isActive === "true" }),
      ...(query.specialty && { specialty: { contains: query.specialty, mode: "insensitive" } }),
      ...(query.city && { city: { contains: query.city, mode: "insensitive" } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { clinicName: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [doctors, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { engagementScore: "desc" },
        include: {
          _count: { select: { visits: true } },
        },
      }),
      this.prisma.doctor.count({ where }),
    ]);

    // Attach AI tier scoring
    const aiScores = await this.aiService.scoreDoctors(
      doctors.map((d) => {
        const daysSinceVisit = d.lastVisitDate
          ? Math.floor((Date.now() - new Date(d.lastVisitDate).getTime()) / 86_400_000)
          : undefined;
        return {
          referral_count_30d: Math.round(d.referralCount / 12),
          referral_count_90d: Math.round(d.referralCount / 4),
          total_revenue: Number(d.revenueGenerated),
          days_since_last_visit: daysSinceVisit,
          has_email: !!d.email,
          specialty_tier: 1,
        };
      })
    );

    const scoredDoctors = doctors.map((d, i) => ({
      ...d,
      aiTier: aiScores[i]?.tier ?? "SILVER",
      aiScore: aiScores[i]?.score ?? d.engagementScore,
      aiVisitPriority: aiScores[i]?.visit_priority ?? "MONITOR",
    }));

    return { data: scoredDoctors, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneDoctor(id: string, tenantId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id, tenantId },
      include: {
        visits: {
          orderBy: { visitedAt: "desc" },
          take: 20,
          include: { visitedBy: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { visits: true } },
      },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    return doctor;
  }

  async updateDoctor(id: string, dto: UpdateDoctorDto, tenantId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    return this.prisma.doctor.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.specialty !== undefined && { specialty: dto.specialty }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.clinicName !== undefined && { clinicName: dto.clinicName }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.clinicAddress !== undefined && { clinicAddress: dto.clinicAddress }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── Doctor Visits & Engagement ─────────────────────────────────────────────

  async logVisit(doctorId: string, dto: LogVisitDto, tenantId: string, userId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const visit = await this.prisma.doctorVisit.create({
      data: {
        tenantId,
        doctorId,
        visitedById: userId,
        visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : new Date(),
        purpose: dto.purpose,
        outcome: dto.outcome,
        notes: dto.notes,
        nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
        gpsLat: dto.gpsLat,
        gpsLng: dto.gpsLng,
      },
    });

    await this.recalculateEngagementScore(doctorId, tenantId);
    return visit;
  }

  async getVisits(doctorId: string, tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [visits, total] = await Promise.all([
      this.prisma.doctorVisit.findMany({
        where: { doctorId, tenantId },
        skip,
        take: limit,
        orderBy: { visitedAt: "desc" },
        include: { visitedBy: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.doctorVisit.count({ where: { doctorId, tenantId } }),
    ]);
    return { data: visits, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private async recalculateEngagementScore(doctorId: string, tenantId: string): Promise<void> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { referralCount: true, revenueGenerated: true },
    });
    if (!doctor) return;

    const lastVisit = await this.prisma.doctorVisit.findFirst({
      where: { doctorId, tenantId },
      orderBy: { visitedAt: "desc" },
      select: { visitedAt: true },
    });

    const lastVisitDate = lastVisit?.visitedAt ?? null;
    let visitRecencyScore = 0;
    if (lastVisitDate) {
      const daysSinceVisit = Math.floor(
        (Date.now() - new Date(lastVisitDate).getTime()) / 86_400_000
      );
      visitRecencyScore = Math.max(0, 100 - daysSinceVisit * 2);
    }

    const referralScore = Math.min(100, (doctor.referralCount / 50) * 100);
    const revenueScore = Math.min(100, (Number(doctor.revenueGenerated) / 500_000) * 100);

    const engagementScore = Math.round(
      referralScore * 0.4 + revenueScore * 0.4 + visitRecencyScore * 0.2
    );

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { engagementScore, lastVisitDate },
    });
  }

  async getDoctorStats(tenantId: string) {
    const [total, active, topDoctors] = await Promise.all([
      this.prisma.doctor.count({ where: { tenantId } }),
      this.prisma.doctor.count({ where: { tenantId, isActive: true } }),
      this.prisma.doctor.findMany({
        where: { tenantId, isActive: true },
        orderBy: { engagementScore: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          specialty: true,
          city: true,
          engagementScore: true,
          referralCount: true,
          revenueGenerated: true,
          lastVisitDate: true,
        },
      }),
    ]);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const visitsThisMonth = await this.prisma.doctorVisit.count({
      where: { tenantId, visitedAt: { gte: thisMonth } },
    });

    return { total, active, visitsThisMonth, topDoctors };
  }

  // ── Leads CRUD ────────────────────────────────────────────────────────────

  async createLead(dto: CreateLeadDto, tenantId: string, userId: string) {
    return this.prisma.lead.create({
      data: {
        tenantId,
        name: dto.name,
        source: dto.source,
        phone: dto.phone,
        email: dto.email,
        organizationName: dto.organizationName,
        city: dto.city,
        notes: dto.notes,
        expectedValue: dto.expectedValue,
        assignedToId: dto.assignedToId ?? userId,
        status: LeadStatus.NEW,
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findAllLeads(
    tenantId: string,
    query: {
      status?: string;
      source?: string;
      assignedToId?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Prisma.LeadWhereInput = {
      tenantId,
      ...(query.status && { status: query.status as LeadStatus }),
      ...(query.source && { source: { equals: query.source as Prisma.EnumLeadSourceFilter["equals"] } }),
      ...(query.assignedToId && { assignedToId: query.assignedToId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { organizationName: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: { select: { firstName: true, lastName: true } },
          _count: { select: { leadNotes: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    // Attach AI lead scores
    const aiScores = await this.aiService.scoreLeads(
      leads.map((l) => ({
        source: l.source ?? "OTHER",
        note_count: l._count.leadNotes,
        created_at: l.createdAt.toISOString(),
        last_activity_at: l.updatedAt?.toISOString(),
        expected_value: l.expectedValue ? Number(l.expectedValue) : undefined,
        has_email: !!l.email,
        has_organization: !!l.organizationName,
        status: l.status,
      }))
    );

    const scoredLeads = leads.map((lead, i) => ({
      ...lead,
      aiScore: aiScores[i]?.score ?? 50,
      aiGrade: aiScores[i]?.grade ?? "WARM",
      aiRecommendation: aiScores[i]?.recommendation ?? "",
    }));

    return { data: scoredLeads, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneLead(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        leadNotes: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    return lead;
  }

  async updateLeadStatus(id: string, dto: UpdateLeadStatusDto, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException("Lead not found");

    const now = new Date();
    return this.prisma.lead.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.assignedToId && { assignedToId: dto.assignedToId }),
        ...(dto.status === LeadStatus.WON && {
          wonAt: now,
          ...(dto.actualValue !== undefined && { actualValue: dto.actualValue }),
        }),
        ...(dto.status === LeadStatus.LOST && {
          lostAt: now,
          lostReason: dto.lostReason,
        }),
      },
      include: { assignedTo: { select: { firstName: true, lastName: true } } },
    });
  }

  async addLeadNote(leadId: string, dto: AddLeadNoteDto, tenantId: string, userId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundException("Lead not found");

    return this.prisma.leadNote.create({
      data: {
        leadId,
        content: dto.content,
        type: dto.type ?? NoteType.NOTE,
        createdById: userId,
      },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
  }

  // ── Leads Board (grouped by status) ───────────────────────────────────────

  async getLeadsBoard(tenantId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, status: { notIn: [LeadStatus.WON, LeadStatus.LOST] } },
      orderBy: { createdAt: "asc" },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        _count: { select: { leadNotes: true } },
      },
    });

    const board: Record<string, typeof leads> = {
      [LeadStatus.NEW]: [],
      [LeadStatus.QUALIFIED]: [],
      [LeadStatus.PROPOSAL]: [],
      [LeadStatus.NEGOTIATION]: [],
    };

    for (const lead of leads) {
      const col = board[lead.status];
      if (col) {
        col.push(lead);
      }
    }

    const pipelineValue = leads.reduce((s, l) => s + Number(l.expectedValue ?? 0), 0);
    return { board, pipelineValue };
  }

  async getLeadStats(tenantId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.lead.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { _all: true },
        _sum: { expectedValue: true },
      }),
    ]);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [wonThisMonth, lostThisMonth] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId, status: LeadStatus.WON, wonAt: { gte: thisMonth } } }),
      this.prisma.lead.count({ where: { tenantId, status: LeadStatus.LOST, lostAt: { gte: thisMonth } } }),
    ]);

    const wonRevenue = await this.prisma.lead.aggregate({
      where: { tenantId, status: LeadStatus.WON },
      _sum: { actualValue: true },
    });

    return {
      total,
      byStatus: byStatus.map((b) => ({
        status: b.status,
        count: b._count._all,
        pipelineValue: Number(b._sum.expectedValue ?? 0),
      })),
      wonThisMonth,
      lostThisMonth,
      totalWonRevenue: Number(wonRevenue._sum.actualValue ?? 0),
    };
  }

  async findAll(tenantId: string): Promise<unknown[]> {
    void tenantId;
    return [];
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  async createCampaign(
    dto: {
      name: string;
      type: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      budget?: number;
      targetSegment?: string;
    },
    tenantId: string,
    userId: string
  ) {
    return this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        status: dto.status ?? "DRAFT",
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        budget: dto.budget ?? null,
        targetSegment: dto.targetSegment,
        createdById: userId,
      },
    });
  }

  async findAllCampaigns(
    tenantId: string,
    query: { page?: number; limit?: number; status?: string; type?: string }
  ) {
    const { page = 1, limit = 20, status, type } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (status) where["status"] = status;
    if (type) where["type"] = type;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateCampaign(id: string, dto: Record<string, unknown>, tenantId: string) {
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async getCampaignStats(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const openRate =
      campaign.sentCount > 0 ? (campaign.openCount / campaign.sentCount) * 100 : 0;
    const conversionRate =
      campaign.sentCount > 0 ? (campaign.conversionCount / campaign.sentCount) * 100 : 0;
    const roi =
      Number(campaign.budget ?? 0) > 0
        ? (Number(campaign.spent) / Number(campaign.budget!)) * 100
        : 0;
    return { ...campaign, openRate, conversionRate, roi };
  }

  // ── Commissions ────────────────────────────────────────────────────────────

  async createCommission(
    dto: {
      doctorId: string;
      invoiceId: string;
      orderId?: string;
      amount: number;
      rule: string;
      rate: number;
      notes?: string;
    },
    tenantId: string
  ) {
    return this.prisma.doctorCommission.create({
      data: {
        tenantId,
        doctorId: dto.doctorId,
        invoiceId: dto.invoiceId,
        orderId: dto.orderId,
        amount: dto.amount,
        rule: dto.rule as never,
        rate: dto.rate,
        notes: dto.notes,
      },
      include: { doctor: { select: { name: true } } },
    });
  }

  async findCommissions(
    tenantId: string,
    query: { doctorId?: string; status?: string; page?: number; limit?: number }
  ) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };
    if (query.doctorId) where["doctorId"] = query.doctorId;
    if (query.status) where["status"] = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.doctorCommission.findMany({
        where,
        include: {
          doctor: { select: { name: true, specialty: true } },
          invoice: { select: { invoiceNumber: true, total: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.doctorCommission.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async approveCommission(id: string, tenantId: string, userId: string) {
    void tenantId;
    void userId;
    return this.prisma.doctorCommission.update({
      where: { id },
      data: { status: "APPROVED" as never },
    });
  }

  async markCommissionPaid(id: string, tenantId: string, userId: string) {
    void tenantId;
    void userId;
    return this.prisma.doctorCommission.update({
      where: { id },
      data: { status: "PAID" as never, paidAt: new Date() },
    });
  }

  async getCommissionSummary(tenantId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (from || to) {
      where["createdAt"] = {};
      if (from) (where["createdAt"] as Record<string, unknown>)["gte"] = new Date(from);
      if (to) (where["createdAt"] as Record<string, unknown>)["lte"] = new Date(to);
    }
    const [pending, approved, paid] = await this.prisma.$transaction([
      this.prisma.doctorCommission.aggregate({
        where: { ...where, status: "PENDING" as never },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.doctorCommission.aggregate({
        where: { ...where, status: "APPROVED" as never },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.doctorCommission.aggregate({
        where: { ...where, status: "PAID" as never },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      pending: { count: pending._count, amount: Number(pending._sum.amount ?? 0) },
      approved: { count: approved._count, amount: Number(approved._sum.amount ?? 0) },
      paid: { count: paid._count, amount: Number(paid._sum.amount ?? 0) },
    };
  }

  // ── Revenue Targets ────────────────────────────────────────────────────────

  async createTarget(
    dto: {
      type: string;
      targetValue: number;
      periodStart: string;
      periodEnd: string;
      branchId?: string;
    },
    tenantId: string
  ) {
    return this.prisma.revenueTarget.create({
      data: {
        tenantId,
        type: dto.type as never,
        targetValue: dto.targetValue,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        branchId: dto.branchId,
      },
    });
  }

  async findTargets(tenantId: string) {
    return this.prisma.revenueTarget.findMany({
      where: { tenantId },
      orderBy: { periodStart: "desc" },
    });
  }

  async getTargetDashboard(tenantId: string) {
    const targets = await this.prisma.revenueTarget.findMany({
      where: { tenantId, periodEnd: { gte: new Date() } },
    });
    return targets.map((t) => ({
      ...t,
      progressPercent:
        Number(t.targetValue) > 0
          ? (Number(t.achievedValue) / Number(t.targetValue)) * 100
          : 0,
    }));
  }

  // ── Territory Heatmap ──────────────────────────────────────────────────────

  async getTerritoryData(tenantId: string) {
    const cityCoords: Record<string, { lat: number; lng: number }> = {
      Bengaluru: { lat: 12.9716, lng: 77.5946 },
      Mumbai: { lat: 19.076, lng: 72.8777 },
      Delhi: { lat: 28.7041, lng: 77.1025 },
      Hyderabad: { lat: 17.385, lng: 78.4867 },
      Chennai: { lat: 13.0827, lng: 80.2707 },
      Kolkata: { lat: 22.5726, lng: 88.3639 },
      Pune: { lat: 18.5204, lng: 73.8567 },
      Ahmedabad: { lat: 23.0225, lng: 72.5714 },
      Jaipur: { lat: 26.9124, lng: 75.7873 },
      Surat: { lat: 21.1702, lng: 72.8311 },
      Lucknow: { lat: 26.8467, lng: 80.9462 },
      Kanpur: { lat: 26.4499, lng: 80.3319 },
      Nagpur: { lat: 21.1458, lng: 79.0882 },
      Visakhapatnam: { lat: 17.6868, lng: 83.2185 },
      Bhopal: { lat: 23.2599, lng: 77.4126 },
    };

    const doctors = await this.prisma.doctor.findMany({
      where: { tenantId, isActive: true },
      select: {
        city: true,
        referralCount: true,
        revenueGenerated: true,
        engagementScore: true,
      },
    });

    const cityMap = new Map<
      string,
      { referralCount: number; revenue: number; engagementSum: number; doctorCount: number }
    >();

    for (const doc of doctors) {
      const city = doc.city ?? "Unknown";
      const existing = cityMap.get(city) ?? {
        referralCount: 0,
        revenue: 0,
        engagementSum: 0,
        doctorCount: 0,
      };
      existing.referralCount += doc.referralCount;
      existing.revenue += Number(doc.revenueGenerated);
      existing.engagementSum += doc.engagementScore;
      existing.doctorCount++;
      cityMap.set(city, existing);
    }

    return Array.from(cityMap.entries()).map(([city, data]) => ({
      city,
      lat: cityCoords[city]?.lat ?? 20.5937,
      lng: cityCoords[city]?.lng ?? 78.9629,
      referralCount: data.referralCount,
      revenue: data.revenue,
      doctorCount: data.doctorCount,
      avgEngagement:
        data.doctorCount > 0 ? Math.round(data.engagementSum / data.doctorCount) : 0,
    }));
  }
}

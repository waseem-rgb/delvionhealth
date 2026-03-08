import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DoctorsMarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    filters: {
      search?: string;
      specialization?: string;
      area?: string;
      tier?: string;
      dueFollowUp?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { clinicName: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.specialization) where.specialization = filters.specialization;
    if (filters.area) where.area = filters.area;
    if (filters.tier) where.tier = filters.tier;
    if (filters.dueFollowUp) {
      where.nextFollowUpDate = { lte: new Date() };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.referringDoctor.findMany({
        where,
        orderBy: { totalRevenue: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.referringDoctor.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(tenantId: string, id: string) {
    const doc = await this.prisma.referringDoctor.findFirst({
      where: { id, tenantId },
      include: {
        contacts: { orderBy: { contactedAt: "desc" }, take: 20 },
      },
    });
    if (!doc) throw new NotFoundException("Doctor not found");
    return doc;
  }

  async create(tenantId: string, dto: {
    name: string;
    specialization?: string;
    qualification?: string;
    clinicName?: string;
    clinicAddress?: string;
    area?: string;
    city?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    notes?: string;
    nextFollowUpDate?: string;
  }, userId: string) {
    return this.prisma.referringDoctor.create({
      data: {
        tenantId,
        ...dto,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
        addedById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    await this.prisma.referringDoctor.updateMany({
      where: { id, tenantId },
      data: {
        ...dto,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate as string) : undefined,
      },
    });
    return this.getById(tenantId, id);
  }

  async logContact(tenantId: string, doctorId: string, dto: {
    type: string;
    notes?: string;
    outcome?: string;
    nextActionDate?: string;
    nextAction?: string;
  }, userId: string) {
    const doc = await this.prisma.referringDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doc) throw new NotFoundException("Doctor not found");

    const contact = await this.prisma.doctorContact.create({
      data: {
        tenantId,
        doctorId,
        type: dto.type,
        notes: dto.notes,
        outcome: dto.outcome,
        nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : undefined,
        nextAction: dto.nextAction,
        contactedById: userId,
      },
    });

    // Update doctor's last contact date and next follow-up
    await this.prisma.referringDoctor.update({
      where: { id: doctorId },
      data: {
        lastContactDate: new Date(),
        nextFollowUpDate: dto.nextActionDate ? new Date(dto.nextActionDate) : undefined,
      },
    });

    return contact;
  }

  async getDoctorOrders(tenantId: string, doctorId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const doc = await this.prisma.referringDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doc) throw new NotFoundException("Doctor not found");

    // Find patients referred by this doctor, then their orders
    const patients = await this.prisma.patient.findMany({
      where: { tenantId, referringDoctorId: doctorId },
      select: { id: true },
    });
    const patientIds = patients.map((p) => p.id);

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { tenantId, patientId: { in: patientIds } },
        include: { patient: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { tenantId, patientId: { in: patientIds } } }),
    ]);

    return { data: orders, meta: { total, page, limit } };
  }

  async getDueFollowUp(tenantId: string) {
    return this.prisma.referringDoctor.findMany({
      where: {
        tenantId,
        isActive: true,
        nextFollowUpDate: { lte: new Date() },
      },
      orderBy: { nextFollowUpDate: "asc" },
    });
  }

  async getStats(tenantId: string) {
    const [total, vip, active, inactive, newThisMonth] = await this.prisma.$transaction([
      this.prisma.referringDoctor.count({ where: { tenantId, isActive: true } }),
      this.prisma.referringDoctor.count({ where: { tenantId, tier: "VIP" } }),
      this.prisma.referringDoctor.count({ where: { tenantId, tier: "ACTIVE" } }),
      this.prisma.referringDoctor.count({ where: { tenantId, tier: "INACTIVE" } }),
      this.prisma.referringDoctor.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    const topDoctors = await this.prisma.referringDoctor.findMany({
      where: { tenantId, isActive: true },
      orderBy: { totalRevenue: "desc" },
      take: 10,
      select: { id: true, name: true, specialization: true, totalReferrals: true, totalRevenue: true, tier: true },
    });

    return { total, vip, active, inactive, newThisMonth, topDoctors };
  }
}

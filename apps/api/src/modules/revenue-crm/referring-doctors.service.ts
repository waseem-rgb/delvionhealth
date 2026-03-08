import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ReferringDoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      tier?: string;
      area?: string;
      repId?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { clinicName: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.tier) where.tier = query.tier;
    if (query.area) where.area = query.area;
    if (query.repId) where.assignedRepId = query.repId;

    const [data, total] = await Promise.all([
      this.prisma.referringDoctor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.referringDoctor.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const doctor = await this.prisma.referringDoctor.findFirst({
      where: { id, tenantId },
      include: {
        contacts: {
          orderBy: { contactedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException("Referring doctor not found");
    }

    return doctor;
  }

  async create(tenantId: string, dto: Record<string, unknown>, userId: string) {
    return this.prisma.referringDoctor.create({
      data: {
        tenantId,
        name: dto.name as string,
        specialization: dto.specialization as string | undefined,
        qualification: dto.qualification as string | undefined,
        clinicName: dto.clinicName as string | undefined,
        clinicAddress: dto.clinicAddress as string | undefined,
        area: dto.area as string | undefined,
        city: dto.city as string | undefined,
        pincode: dto.pincode as string | undefined,
        phone: dto.phone as string | undefined,
        whatsapp: dto.whatsapp as string | undefined,
        email: dto.email as string | undefined,
        tier: (dto.tier as string) || "NEW",
        revShareEnabled: dto.revShareEnabled as boolean | undefined,
        revSharePct: dto.revSharePct as number | undefined,
        assignedRepId: dto.assignedRepId as string | undefined,
        notes: dto.notes as string | undefined,
        nextFollowUpDate: dto.nextFollowUpDate
          ? new Date(dto.nextFollowUpDate as string)
          : undefined,
        addedById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const doctor = await this.prisma.referringDoctor.findFirst({
      where: { id, tenantId },
    });

    if (!doctor) {
      throw new NotFoundException("Referring doctor not found");
    }

    const data: Record<string, unknown> = { ...dto };

    if (data.nextFollowUpDate) {
      data.nextFollowUpDate = new Date(data.nextFollowUpDate as string);
    }

    return this.prisma.referringDoctor.update({
      where: { id },
      data,
    });
  }

  async getOrders(
    tenantId: string,
    doctorId: string,
    query: { page?: number; limit?: number },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      patient: {
        referringDoctorId: doctorId,
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRevShare(tenantId: string, doctorId: string) {
    const entries = await this.prisma.revShareLedger.findMany({
      where: {
        tenantId,
        entityType: "DOCTOR",
        entityId: doctorId,
      },
      orderBy: { createdAt: "desc" },
    });

    return entries;
  }

  async logContact(
    tenantId: string,
    doctorId: string,
    dto: Record<string, unknown>,
    userId: string,
  ) {
    const doctor = await this.prisma.referringDoctor.findFirst({
      where: { id: doctorId, tenantId },
    });

    if (!doctor) {
      throw new NotFoundException("Referring doctor not found");
    }

    const contact = await this.prisma.doctorContact.create({
      data: {
        tenantId,
        doctorId,
        type: dto.type as string,
        notes: dto.notes as string | undefined,
        outcome: dto.outcome as string | undefined,
        nextActionDate: dto.nextActionDate
          ? new Date(dto.nextActionDate as string)
          : undefined,
        nextAction: dto.nextAction as string | undefined,
        contactedById: userId,
      },
    });

    // Update last contact date and next follow-up on the doctor record
    const updateData: Record<string, unknown> = {
      lastContactDate: new Date(),
    };

    if (dto.nextFollowUpDate) {
      updateData.nextFollowUpDate = new Date(dto.nextFollowUpDate as string);
    }

    await this.prisma.referringDoctor.update({
      where: { id: doctorId },
      data: updateData,
    });

    return contact;
  }

  async getDueFollowups(tenantId: string) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const doctors = await this.prisma.referringDoctor.findMany({
      where: {
        tenantId,
        isActive: true,
        nextFollowUpDate: {
          lte: today,
        },
      },
      orderBy: { nextFollowUpDate: "asc" },
    });

    return doctors;
  }
}

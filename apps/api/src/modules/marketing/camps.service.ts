import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CampsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters: { status?: string; month?: string }) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.month) {
      const [year, m] = filters.month.split("-").map(Number);
      where.campDate = {
        gte: new Date(year!, m! - 1, 1),
        lte: new Date(year!, m!, 0, 23, 59, 59),
      };
    }

    return this.prisma.healthCamp.findMany({
      where,
      orderBy: { campDate: "desc" },
    });
  }

  async getById(tenantId: string, id: string) {
    const camp = await this.prisma.healthCamp.findFirst({ where: { id, tenantId } });
    if (!camp) throw new NotFoundException("Camp not found");
    return camp;
  }

  async create(tenantId: string, dto: {
    name: string;
    organiserName: string;
    organiserType?: string;
    address?: string;
    city?: string;
    campDate: string;
    startTime?: string;
    endTime?: string;
    expectedPax?: number;
    testsOffered?: string;
    pricePackage?: string;
    assignedStaff?: string;
    equipmentList?: string;
    notes?: string;
  }, userId: string) {
    return this.prisma.healthCamp.create({
      data: {
        tenantId,
        name: dto.name,
        organiserName: dto.organiserName,
        organiserType: dto.organiserType,
        address: dto.address,
        city: dto.city,
        campDate: new Date(dto.campDate),
        startTime: dto.startTime,
        endTime: dto.endTime,
        expectedPax: dto.expectedPax ?? 0,
        testsOffered: dto.testsOffered,
        pricePackage: dto.pricePackage,
        assignedStaff: dto.assignedStaff,
        equipmentList: dto.equipmentList,
        notes: dto.notes,
        createdById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const camp = await this.prisma.healthCamp.findFirst({ where: { id, tenantId } });
    if (!camp) throw new NotFoundException("Camp not found");

    return this.prisma.healthCamp.update({
      where: { id },
      data: {
        ...dto,
        campDate: dto.campDate ? new Date(dto.campDate as string) : undefined,
      },
    });
  }

  async complete(tenantId: string, id: string, actualPax: number) {
    const camp = await this.prisma.healthCamp.findFirst({ where: { id, tenantId } });
    if (!camp) throw new NotFoundException("Camp not found");

    const pricePerPerson = camp.pricePackage ? parseFloat(camp.pricePackage) : 0;
    const totalRevenue = actualPax * pricePerPerson;

    return this.prisma.healthCamp.update({
      where: { id },
      data: {
        status: "COMPLETED",
        actualPax,
        totalRevenue,
      },
    });
  }

  async getStats(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [thisMonth, totalPax, revenue] = await this.prisma.$transaction([
      this.prisma.healthCamp.count({
        where: { tenantId, campDate: { gte: monthStart, lte: monthEnd } },
      }),
      this.prisma.healthCamp.aggregate({
        where: { tenantId, campDate: { gte: monthStart, lte: monthEnd } },
        _sum: { expectedPax: true, actualPax: true },
      }),
      this.prisma.healthCamp.aggregate({
        where: { tenantId, status: "COMPLETED", campDate: { gte: monthStart, lte: monthEnd } },
        _sum: { totalRevenue: true },
      }),
    ]);

    return {
      campsThisMonth: thisMonth,
      expectedPax: totalPax._sum.expectedPax ?? 0,
      actualPax: totalPax._sum.actualPax ?? 0,
      revenue: Number(revenue._sum.totalRevenue ?? 0),
    };
  }
}

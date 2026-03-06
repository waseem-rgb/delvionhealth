import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class StandingOrdersService {
  private readonly logger = new Logger(StandingOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { patientId: string; testCatalogIds: string[]; frequency: string; nextRunAt?: string }, tenantId: string, userId: string) {
    return this.prisma.standingOrder.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        testCatalogIds: dto.testCatalogIds,
        frequency: dto.frequency as never,
        nextRunAt: dto.nextRunAt ? new Date(dto.nextRunAt) : new Date(),
        createdById: userId,
      },
      include: { patient: { select: { firstName: true, lastName: true, mrn: true } } },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.standingOrder.findMany({
      where: { tenantId },
      include: { patient: { select: { firstName: true, lastName: true, mrn: true } } },
      orderBy: { nextRunAt: "asc" },
    });
  }

  async update(id: string, dto: { frequency?: string; testCatalogIds?: string[]; nextRunAt?: string }, tenantId: string) {
    const data: Record<string, unknown> = {};
    if (dto.frequency) data["frequency"] = dto.frequency;
    if (dto.testCatalogIds) data["testCatalogIds"] = dto.testCatalogIds;
    if (dto.nextRunAt) data["nextRunAt"] = new Date(dto.nextRunAt);
    return this.prisma.standingOrder.update({ where: { id }, data });
  }

  async deactivate(id: string, tenantId: string) {
    return this.prisma.standingOrder.update({ where: { id }, data: { isActive: false } });
  }

  private nextRunDate(frequency: string, from: Date): Date {
    const next = new Date(from);
    if (frequency === "DAILY") next.setDate(next.getDate() + 1);
    else if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
    else if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
    return next;
  }

  @Cron("0 8 * * *")
  async processAllDueOrders() {
    this.logger.log("Processing due standing orders...");
    const due = await this.prisma.standingOrder.findMany({
      where: { isActive: true, nextRunAt: { lte: new Date() } },
      include: { patient: { include: { orders: { take: 1, orderBy: { createdAt: "desc" } } } } },
    });

    for (const so of due) {
      try {
        // Get testCatalog details for pricing
        const tests = await this.prisma.testCatalog.findMany({
          where: { id: { in: so.testCatalogIds }, tenantId: so.tenantId },
        });

        const totalAmount = tests.reduce((s, t) => s + Number(t.price), 0);

        // Use patient's branch or first branch
        const patient = await this.prisma.patient.findUnique({ where: { id: so.patientId } });
        if (!patient) continue;

        // Get order number
        const date = new Date();
        const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
        const count = await this.prisma.order.count({ where: { tenantId: so.tenantId } });
        const orderNumber = `DH-ORD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

        await this.prisma.order.create({
          data: {
            tenantId: so.tenantId,
            branchId: patient.branchId,
            patientId: so.patientId,
            orderNumber,
            status: "PENDING" as never,
            priority: "ROUTINE",
            totalAmount,
            netAmount: totalAmount,
            createdById: so.createdById,
            items: {
              create: tests.map((t) => ({
                testCatalogId: t.id,
                price: t.price,
                quantity: 1,
              })),
            },
          },
        });

        // Update nextRunAt
        await this.prisma.standingOrder.update({
          where: { id: so.id },
          data: { nextRunAt: this.nextRunDate(so.frequency, new Date()) },
        });

        this.logger.log(`Created standing order for patient ${so.patientId}`);
      } catch (e) {
        this.logger.error(`Failed to process standing order ${so.id}:`, e);
      }
    }
  }
}

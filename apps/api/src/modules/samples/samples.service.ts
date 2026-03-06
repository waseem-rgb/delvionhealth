import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../notifications/push.service";
import { AiService } from "../ai/ai.service";
import type {
  AccessionSampleDto,
  UpdateSampleStatusDto,
  MoveSampleDto,
  RejectSampleDto,
} from "./dto/accession-sample.dto";
import type { QuerySampleDto } from "./dto/query-sample.dto";
import { SampleStatus, OrderStatus } from "@delvion/types";

const STATUS_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  [SampleStatus.PENDING_COLLECTION]: [SampleStatus.COLLECTED, SampleStatus.REJECTED],
  [SampleStatus.COLLECTED]:          [SampleStatus.IN_TRANSIT, SampleStatus.RECEIVED, SampleStatus.REJECTED],
  [SampleStatus.IN_TRANSIT]:         [SampleStatus.RECEIVED, SampleStatus.REJECTED],
  [SampleStatus.RECEIVED]:           [SampleStatus.PROCESSING],
  [SampleStatus.PROCESSING]:         [SampleStatus.STORED],
  [SampleStatus.STORED]:             [],
  [SampleStatus.REJECTED]:           [],
  [SampleStatus.DISPOSED]:           [],
};

@Injectable()
export class SamplesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly pushService: PushService,
    private readonly aiService: AiService
  ) {}

  private async generateBarcodeId(tenantId: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.sample.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00.000Z`),
          },
        },
      });
      const seq = String(count + 1).padStart(4, "0");
      return `DH-S-${dateStr}-${seq}`;
    });
  }

  async accession(tenantId: string, userId: string, dto: AccessionSampleDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId },
    });

    if (!order) throw new NotFoundException("Order not found");

    if (
      order.status !== OrderStatus.CONFIRMED &&
      order.status !== OrderStatus.PENDING
    ) {
      throw new BadRequestException(
        `Order in ${order.status} status cannot have samples accessioned`
      );
    }

    // Use staff-provided barcode (scanned/typed from physical tube)
    const barcodeId = dto.barcodeId.trim();
    if (!barcodeId) {
      throw new BadRequestException("Barcode ID is required — scan or type the tube barcode");
    }

    // Check barcode uniqueness
    const existing = await this.prisma.sample.findFirst({
      where: { barcodeId, tenantId },
    });
    if (existing) {
      throw new BadRequestException(
        `Barcode "${barcodeId}" is already mapped to another sample`
      );
    }

    const [sample] = await this.prisma.$transaction([
      this.prisma.sample.create({
        data: {
          tenantId,
          orderId: dto.orderId,
          barcodeId,
          type: dto.type,
          status: SampleStatus.PENDING_COLLECTION,
          location: dto.location,
          branchId: dto.branchId,
          notes: dto.notes,
        },
      }),
      this.prisma.order.update({
        where: { id: dto.orderId },
        data: { status: OrderStatus.CONFIRMED },
      }),
    ]);

    await this.prisma.sampleMovement.create({
      data: {
        sampleId: sample.id,
        toLocation: dto.location ?? "Reception",
        movedById: userId,
        notes: dto.notes ?? "Sample registered",
      },
    });

    this.realtime.emitSampleUpdate(tenantId, {
      sampleId: sample.id,
      barcodeId: sample.barcodeId,
      status: sample.status,
    });

    return sample;
  }

  async findAll(tenantId: string, query: QuerySampleDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.status) where["status"] = query.status;
    if (query.branchId) where["branchId"] = query.branchId;
    if (query.orderId) where["orderId"] = query.orderId;
    if (query.dateFrom || query.dateTo) {
      where["createdAt"] = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      };
    }
    if (query.search) {
      where["OR"] = [
        { barcodeId: { contains: query.search, mode: "insensitive" } },
        {
          order: {
            patient: {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { mrn: { contains: query.search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const [samples, total] = await Promise.all([
      this.prisma.sample.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { createdAt: "desc" },
        ],
        include: {
          order: {
            select: {
              orderNumber: true,
              priority: true,
              _count: { select: { items: true } },
              patient: { select: { firstName: true, lastName: true, mrn: true } },
            },
          },
          branch: { select: { name: true } },
          collectedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.sample.count({ where }),
    ]);

    return {
      data: samples,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const sample = await this.prisma.sample.findFirst({
      where: { id, tenantId },
      include: {
        order: {
          include: {
            patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
            items: {
              include: { testCatalog: { select: { name: true, code: true } } },
            },
          },
        },
        branch: { select: { name: true } },
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy:  { select: { id: true, firstName: true, lastName: true } },
        movements: {
          orderBy: { movedAt: "asc" },
          include: { movedBy: { select: { firstName: true, lastName: true } } },
        },
        rejections: {
          include: { rejectedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!sample) throw new NotFoundException(`Sample ${id} not found`);
    return sample;
  }

  async findByBarcode(tenantId: string, barcodeId: string) {
    const sample = await this.prisma.sample.findFirst({
      where: { barcodeId, tenantId },
      include: {
        order: {
          include: {
            patient: { select: { mrn: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!sample) throw new NotFoundException(`Sample with barcode ${barcodeId} not found`);
    return sample;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateSampleStatusDto
  ) {
    const sample = await this.findOne(tenantId, id);
    const newStatus = dto.status as SampleStatus;
    const allowed = STATUS_TRANSITIONS[sample.status as SampleStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${sample.status} to ${newStatus}`
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (dto.location) updateData["location"] = dto.location;
    if (newStatus === SampleStatus.RECEIVED) {
      updateData["receivedAt"] = new Date();
      updateData["receivedById"] = userId;
    }
    if (newStatus === SampleStatus.COLLECTED) {
      updateData["collectedAt"] = new Date();
      updateData["collectedById"] = userId;
    }

    await this.prisma.$transaction([
      this.prisma.sample.update({ where: { id }, data: updateData }),
      this.prisma.sampleMovement.create({
        data: {
          sampleId: id,
          fromLocation: sample.location ?? undefined,
          toLocation: dto.location ?? sample.location ?? "Lab",
          movedById: userId,
          notes: dto.notes ?? `Status updated to ${newStatus}`,
        },
      }),
    ]);

    // If all samples for this order are RECEIVED, update order status
    if (newStatus === SampleStatus.RECEIVED) {
      const allSamples = await this.prisma.sample.findMany({
        where: { orderId: sample.orderId, tenantId },
        select: { status: true },
      });
      const allReceived = allSamples.every(
        (s) => s.status === SampleStatus.RECEIVED || s.status === SampleStatus.REJECTED
      );
      if (allReceived) {
        await this.prisma.order.update({
          where: { id: sample.orderId },
          data: { status: OrderStatus.SAMPLE_COLLECTED },
        });
        this.realtime.emitOrderUpdate(tenantId, {
          orderId: sample.orderId,
          orderNumber: sample.order.orderNumber,
          status: OrderStatus.SAMPLE_COLLECTED,
        });
      }
    }

    this.realtime.emitSampleUpdate(tenantId, {
      sampleId: id,
      barcodeId: sample.barcodeId,
      status: newStatus,
    });

    // SMS and push notification on sample collected
    if (newStatus === SampleStatus.COLLECTED && sample.order?.patient?.id) {
      this.prisma.patient.findUnique({
        where: { id: sample.order.patient.id },
        select: { phone: true, firstName: true, userId: true },
      }).then(p => {
        if (p?.phone) {
          this.notifications.sendSMS(
            p.phone,
            `DELViON: Sample ${sample.barcodeId} collected. Tracking your test(s) — results will be ready soon.`,
          ).catch(() => {});
        }
        if (p?.userId) {
          this.prisma.order.findUnique({
            where: { id: sample.orderId },
            select: { orderNumber: true },
          }).then((order) => {
            if (order?.orderNumber) {
              this.pushService.notifySampleCollected(p.userId!, order.orderNumber).catch(() => {});
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return this.findOne(tenantId, id);
  }

  async move(tenantId: string, id: string, userId: string, dto: MoveSampleDto) {
    const sample = await this.findOne(tenantId, id);

    await this.prisma.$transaction([
      this.prisma.sample.update({
        where: { id },
        data: { location: dto.toLocation },
      }),
      this.prisma.sampleMovement.create({
        data: {
          sampleId: id,
          fromLocation: dto.fromLocation ?? sample.location ?? undefined,
          toLocation: dto.toLocation,
          movedById: userId,
          notes: dto.notes,
        },
      }),
    ]);

    this.realtime.emitSampleUpdate(tenantId, {
      sampleId: id,
      barcodeId: sample.barcodeId,
      status: sample.status,
    });

    return this.findOne(tenantId, id);
  }

  async reject(tenantId: string, id: string, userId: string, dto: RejectSampleDto) {
    const sample = await this.findOne(tenantId, id);

    await this.prisma.$transaction([
      this.prisma.sample.update({
        where: { id },
        data: { status: SampleStatus.REJECTED },
      }),
      this.prisma.specimenRejection.create({
        data: {
          sampleId: id,
          reason: dto.reason,
          rejectedById: userId,
          notes: dto.notes,
        },
      }),
    ]);

    // Notify the order creator
    if (sample.order?.createdById) {
      await this.notifications.send(tenantId, sample.order.createdById, {
        title: "Sample Rejected",
        body: `Sample ${sample.barcodeId} was rejected: ${dto.reason}`,
        type: "SAMPLE_REJECTED",
        entityId: id,
        entityType: "Sample",
      });
    }

    this.realtime.emitSampleUpdate(tenantId, {
      sampleId: id,
      barcodeId: sample.barcodeId,
      status: SampleStatus.REJECTED,
    });

    return this.findOne(tenantId, id);
  }

  async getCounts(tenantId: string, branchId?: string) {
    const base = { tenantId, ...(branchId && { branchId }) };
    const [
      pendingCollection, collected, inTransit,
      received, processing, stored, rejected,
    ] = await Promise.all([
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.PENDING_COLLECTION } }),
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.COLLECTED } }),
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.IN_TRANSIT } }),
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.RECEIVED } }),
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.PROCESSING } }),
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.STORED } }),
      this.prisma.sample.count({ where: { ...base, status: SampleStatus.REJECTED } }),
    ]);

    return { pendingCollection, collected, inTransit, received, processing, stored, rejected };
  }

  async getQueue(tenantId: string, branchId?: string) {
    const samples = await this.prisma.sample.findMany({
      where: {
        tenantId,
        ...(branchId && { branchId }),
        status: {
          in: [
            SampleStatus.PENDING_COLLECTION,
            SampleStatus.COLLECTED,
            SampleStatus.IN_TRANSIT,
            SampleStatus.RECEIVED,
            SampleStatus.PROCESSING,
          ],
        },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            priority: true,
            createdAt: true,
            _count: { select: { items: true } },
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Sort: STAT first, URGENT second, ROUTINE last
    const priorityOrder: Record<string, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };
    const sorted = samples.sort(
      (a, b) =>
        (priorityOrder[a.order?.priority ?? "ROUTINE"] ?? 2) -
        (priorityOrder[b.order?.priority ?? "ROUTINE"] ?? 2)
    );

    // Attach AI TAT predictions in parallel (best-effort)
    const totalPending = sorted.length;
    const tatResults = await Promise.allSettled(
      sorted.map((s) =>
        this.aiService.predictTAT(
          Array(Math.max(1, s.order?._count?.items ?? 1)).fill(4) as number[],
          s.order?.priority ?? "ROUTINE",
          s.collectedAt ?? undefined,
          totalPending
        )
      )
    );

    type TatResult = Awaited<ReturnType<typeof this.aiService.predictTAT>>;
    return sorted.map((s, i) => {
      const tat = tatResults[i];
      const fulfilled = (tat !== undefined && tat.status === "fulfilled")
        ? (tat as PromiseFulfilledResult<TatResult>).value
        : null;
      return {
        ...s,
        tatPrediction: fulfilled
          ? {
              predictedHours: fulfilled.predicted_hours,
              expectedAt: fulfilled.expected_at,
              expectedAtDisplay: fulfilled.expected_at_display,
              message: fulfilled.message,
              confidence: fulfilled.confidence,
            }
          : null,
      };
    });
  }

  async getChainOfCustody(sampleId: string, tenantId: string) {
    const sample = await this.prisma.sample.findFirst({
      where: { id: sampleId, tenantId },
      select: { id: true },
    });
    if (!sample) throw new NotFoundException(`Sample ${sampleId} not found`);

    return this.prisma.sampleMovement.findMany({
      where: { sampleId },
      orderBy: { movedAt: "asc" },
      include: {
        movedBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  async getSamplesByOrder(orderId: string, tenantId: string) {
    return this.prisma.sample.findMany({
      where: { orderId, tenantId },
      include: {
        collectedBy: { select: { firstName: true, lastName: true } },
        receivedBy:  { select: { firstName: true, lastName: true } },
        movements: {
          orderBy: { movedAt: "asc" },
          include: { movedBy: { select: { firstName: true, lastName: true } } },
        },
        rejections: {
          include: { rejectedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }
}

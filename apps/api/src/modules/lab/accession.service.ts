import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/services/audit.service";
import { OrderStatus } from "@delvion/types";

interface AccessionFilters {
  date?: string;
  collectionType?: string;
  isStatOnly?: boolean;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const TUBE_CONFIG: Record<string, { label: string; color: string; sampleTypes: string[] }> = {
  EDTA:           { label: "EDTA Blood",          color: "purple", sampleTypes: ["BLOOD", "EDTA", "WHOLE_BLOOD", "PLASMA"] },
  SERUM:          { label: "Plain Red/Serum",      color: "red",    sampleTypes: ["SERUM", "PLAIN_RED", "SST"] },
  CITRATE:        { label: "Blue Citrate",         color: "blue",   sampleTypes: ["CITRATE"] },
  FLUORIDE:       { label: "Gray Fluoride",        color: "gray",   sampleTypes: ["FLUORIDE"] },
  HEPARIN:        { label: "Green Heparin",        color: "green",  sampleTypes: ["HEPARIN"] },
  NASOPHARYNGEAL: { label: "Nasopharyngeal Swab",  color: "orange", sampleTypes: ["NASOPHARYNGEAL", "SWAB", "NPS", "NASAL"] },
  URINE:          { label: "Urine Container",      color: "yellow", sampleTypes: ["URINE"] },
  STOOL:          { label: "Stool Container",      color: "brown",  sampleTypes: ["STOOL", "FAECES"] },
  CSF:            { label: "CSF Tube",             color: "blue",   sampleTypes: ["CSF", "CEREBROSPINAL"] },
  SPUTUM:         { label: "Sputum Container",     color: "gray",   sampleTypes: ["SPUTUM"] },
};

@Injectable()
export class AccessionService {
  private readonly logger = new Logger(AccessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get list of orders pending accession.
   * Returns orders with status PENDING_COLLECTION or SAMPLE_COLLECTED.
   */
  async getAccessionList(tenantId: string, filters: AccessionFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusFilter = filters.status
      ? filters.status.split(",").map((s) => s.trim() as OrderStatus)
      : [OrderStatus.PENDING_COLLECTION, OrderStatus.SAMPLE_COLLECTED];

    const where: Record<string, unknown> = {
      tenantId,
      status: { in: statusFilter },
    };

    if (filters.collectionType) {
      where.collectionType = filters.collectionType;
    }

    if (filters.date) {
      const dayStart = new Date(filters.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(filters.date);
      dayEnd.setHours(23, 59, 59, 999);
      where.createdAt = { gte: dayStart, lte: dayEnd };
    }

    if (filters.isStatOnly) {
      where.priority = "STAT";
    }

    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: "insensitive" } },
        {
          patient: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
              phone: true,
              gender: true,
              dob: true,
            },
          },
          items: {
            include: {
              testCatalog: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  sampleType: true,
                  department: true,
                  turnaroundHours: true,
                },
              },
            },
          },
          samples: {
            select: {
              id: true,
              barcodeId: true,
              type: true,
              status: true,
              collectedAt: true,
              vacutainerType: true,
              volumeRequired: true,
              volumeCollected: true,
              isStatSample: true,
            },
          },
          branch: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { firstName: true, lastName: true },
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

  /**
   * Receive/accession a sample — validates and transitions order to RECEIVED.
   */
  async accessionSample(orderId: string, userId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const validStatuses: string[] = [
      OrderStatus.PENDING_COLLECTION,
      OrderStatus.SAMPLE_COLLECTED,
    ];
    if (!validStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be accessioned from status ${order.status}. Must be PENDING_COLLECTION or SAMPLE_COLLECTED.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.RECEIVED,
        accessionedAt: new Date(),
        accessionedById: userId,
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: userId,
      action: "ACCESSION_RECEIVE",
      module: "lab",
      entity: "Order",
      entityId: orderId,
      targetRef: order.orderNumber,
      changes: { status: { from: order.status, to: OrderStatus.RECEIVED } },
    });

    return updated;
  }

  /**
   * Reject a sample with reason and optional note.
   */
  async rejectSample(
    orderId: string,
    reason: string,
    note: string,
    userId: string,
    tenantId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SAMPLE_REJECTED,
        rejectionReason: reason as never,
        rejectionNote: note,
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: userId,
      action: "ACCESSION_REJECT",
      module: "lab",
      entity: "Order",
      entityId: orderId,
      targetRef: order.orderNumber,
      changes: {
        status: { from: order.status, to: OrderStatus.SAMPLE_REJECTED },
        rejectionReason: reason,
        rejectionNote: note,
      },
    });

    return updated;
  }

  /**
   * Bulk receive multiple orders.
   */
  async bulkAccession(
    orderIds: string[],
    userId: string,
    tenantId: string,
  ): Promise<{
    success: number;
    failed: { id: string; error: string }[];
  }> {
    let successCount = 0;
    const failed: { id: string; error: string }[] = [];

    for (const id of orderIds) {
      try {
        await this.accessionSample(id, userId, tenantId);
        successCount++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        failed.push({ id, error: message });
      }
    }

    return { success: successCount, failed };
  }

  /**
   * Get counts by status for stats bar (for today by default).
   */
  async getAccessionStats(tenantId: string, date?: string) {
    const dayStart = date ? new Date(date) : new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const baseWhere = {
      tenantId,
      createdAt: { gte: dayStart, lte: dayEnd },
    };

    const [pending, received, rejected] = await Promise.all([
      this.prisma.order.count({
        where: {
          ...baseWhere,
          status: {
            in: [
              OrderStatus.PENDING_COLLECTION,
              OrderStatus.SAMPLE_COLLECTED,
            ],
          },
        },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, status: OrderStatus.RECEIVED },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, status: OrderStatus.SAMPLE_REJECTED },
      }),
    ]);

    // TAT breached: orders that are still not RECEIVED and created more than their max TAT ago
    const tatBreachedOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: {
          in: [
            OrderStatus.PENDING_COLLECTION,
            OrderStatus.SAMPLE_COLLECTED,
          ],
        },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        items: {
          include: {
            testCatalog: { select: { turnaroundHours: true } },
          },
        },
      },
    });

    const now = Date.now();
    let tatBreached = 0;
    for (const order of tatBreachedOrders) {
      const maxTat = Math.max(
        ...order.items.map((i) => i.testCatalog.turnaroundHours ?? 24),
        24,
      );
      const elapsedHours =
        (now - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
      if (elapsedHours > maxTat) {
        tatBreached++;
      }
    }

    return { pending, received, rejected, tatBreached };
  }

  /**
   * Get tubes required for an order — groups tests by tube type.
   */
  async getAccessionTubesForOrder(orderId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: {
          select: {
            id: true, firstName: true, lastName: true,
            mrn: true, gender: true, dob: true,
          },
        },
        items: {
          include: {
            testCatalog: {
              select: { id: true, name: true, code: true, sampleType: true },
            },
          },
        },
        samples: {
          select: { id: true, barcodeId: true, type: true, tube: true, status: true },
        },
      },
    });

    if (!order) throw new NotFoundException("Order not found");

    // Group tests by tube type
    const tubeMap: Record<string, {
      tubeKey: string;
      label: string;
      color: string;
      tests: { id: string; name: string; code: string }[];
      existingBarcode?: string;
      existingSampleId?: string;
    }> = {};

    for (const item of order.items) {
      const st = (item.testCatalog.sampleType ?? "").toUpperCase().trim();
      let matched = false;
      for (const [key, cfg] of Object.entries(TUBE_CONFIG)) {
        if (cfg.sampleTypes.some((s) => st.includes(s) || s.includes(st))) {
          if (!tubeMap[key]) {
            tubeMap[key] = { tubeKey: key, label: cfg.label, color: cfg.color, tests: [] };
          }
          tubeMap[key].tests.push({
            id: item.testCatalog.id,
            name: item.testCatalog.name,
            code: item.testCatalog.code ?? "",
          });
          matched = true;
          break;
        }
      }
      if (!matched) {
        const key = st || "OTHER";
        if (!tubeMap[key]) {
          tubeMap[key] = { tubeKey: key, label: st || "Other", color: "gray", tests: [] };
        }
        tubeMap[key].tests.push({
          id: item.testCatalog.id,
          name: item.testCatalog.name,
          code: item.testCatalog.code ?? "",
        });
      }
    }

    // Fill in existing barcodes if already partially accessioned
    for (const s of order.samples) {
      const key = s.tube ?? s.type ?? "";
      if (tubeMap[key]) {
        tubeMap[key].existingBarcode = s.barcodeId;
        tubeMap[key].existingSampleId = s.id;
      }
    }

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        patient: order.patient,
        createdAt: order.createdAt,
      },
      tubes: Object.values(tubeMap),
      totalTubes: Object.keys(tubeMap).length,
    };
  }

  /**
   * Submit tube-by-tube accession — creates sample records and transitions order.
   */
  async submitAccession(
    orderId: string,
    tubes: { tubeKey: string; barcode: string; testIds: string[] }[],
    tenantId: string,
    staffId: string,
  ) {
    // Validate barcodes
    const barcodes = tubes.map((t) => t.barcode.trim()).filter(Boolean);
    if (barcodes.length !== tubes.length) {
      throw new BadRequestException("All tube barcodes are required before submitting");
    }
    const uniqueBarcodes = new Set(barcodes);
    if (uniqueBarcodes.size !== barcodes.length) {
      throw new BadRequestException("Duplicate barcodes detected — each tube must have a unique barcode");
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: { include: { testCatalog: true } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    return this.prisma.$transaction(async (tx) => {
      const createdSamples = [];

      for (const tube of tubes) {
        const barcode = tube.barcode.trim();
        if (!barcode) continue;

        // Check if barcode already exists
        const existing = await tx.sample.findUnique({ where: { barcodeId: barcode } });

        if (existing) {
          const updated = await tx.sample.update({
            where: { id: existing.id },
            data: {
              orderId,
              tube: tube.tubeKey,
              type: tube.tubeKey,
              status: "COLLECTED",
              collectedAt: new Date(),
              collectedById: staffId,
              accessionedAt: new Date(),
              accessionedById: staffId,
              testIds: tube.testIds,
            },
          });
          createdSamples.push(updated);
        } else {
          const sample = await tx.sample.create({
            data: {
              tenantId,
              orderId,
              branchId: order.branchId,
              barcodeId: barcode,
              tube: tube.tubeKey,
              type: tube.tubeKey,
              status: "COLLECTED",
              collectedAt: new Date(),
              collectedById: staffId,
              accessionedAt: new Date(),
              accessionedById: staffId,
              testIds: tube.testIds,
            },
          });
          createdSamples.push(sample);
        }
      }

      // Update order status → RECEIVED (accessioned)
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.RECEIVED,
          accessionedAt: new Date(),
          accessionedById: staffId,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: staffId,
        action: "ACCESSION_TUBES_SUBMITTED",
        module: "lab",
        entity: "Order",
        entityId: orderId,
        targetRef: order.orderNumber,
        changes: {
          tubes: tubes.length,
          barcodes: tubes.map((t) => t.barcode),
          status: { from: order.status, to: OrderStatus.RECEIVED },
        },
      });

      return {
        success: true,
        samples: createdSamples.length,
        message: `${createdSamples.length} tubes accessioned and collected. Order → RECEIVED`,
      };
    });
  }
}

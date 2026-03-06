import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/services/audit.service";

@Injectable()
export class OutsourcingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ───────────────────────────────────────────
  // Create outsource request
  // ───────────────────────────────────────────

  async createOutsource(
    tenantId: string,
    orderId: string,
    reflabId: string,
    testIds: string[],
    actorId: string,
  ) {
    // Validate order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: true, samples: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    // Validate reference lab
    const reflab = await this.prisma.referencelab.findFirst({
      where: { id: reflabId, tenantId, isActive: true },
    });
    if (!reflab) throw new NotFoundException("Reference lab not found or inactive");

    // Validate tests belong to order and are in reflab
    const orderTestIds = new Set(order.items.map((i) => i.testCatalogId));
    const invalidTests = testIds.filter((id) => !orderTestIds.has(id));
    if (invalidTests.length > 0) {
      throw new BadRequestException(
        `Tests not part of this order: ${invalidTests.join(", ")}`,
      );
    }

    // Validate tests exist in reflab
    const reflabTests = await this.prisma.reflabTest.findMany({
      where: {
        reflabId,
        testCatalogId: { in: testIds },
      },
    });

    const reflabTestMap = new Map(
      reflabTests.map((t) => [t.testCatalogId, t]),
    );
    const unmapped = testIds.filter((id) => !reflabTestMap.has(id));
    if (unmapped.length > 0) {
      throw new BadRequestException(
        `Tests not mapped to reference lab: ${unmapped.join(", ")}`,
      );
    }

    // Calculate total cost
    const totalCost = reflabTests.reduce((sum, t) => sum + t.cost, 0);

    // Calculate expected date based on max TAT
    const maxTat = Math.max(...reflabTests.map((t) => t.tat));
    const expectedAt = new Date();
    expectedAt.setHours(expectedAt.getHours() + maxTat);

    return this.prisma.$transaction(async (tx) => {
      // Create outsourced sample
      const outsourcedSample = await tx.outsourcedSample.create({
        data: {
          tenantId,
          orderId,
          reflabId,
          totalCost,
          expectedAt,
          tests: {
            create: testIds.map((testCatalogId) => ({
              testCatalogId,
            })),
          },
        },
        include: {
          tests: {
            include: {
              testCatalog: { select: { id: true, name: true, code: true } },
            },
          },
          reflab: { select: { id: true, name: true, code: true } },
        },
      });

      // Update sample status to OUTSOURCED if there's a sample
      if (order.samples.length > 0) {
        await tx.sample.updateMany({
          where: {
            orderId,
            status: { not: "REJECTED" },
          },
          data: { status: "OUTSOURCED" },
        });
      }

      // Audit log
      await this.auditService.log({
        tenantId,
        actorId,
        action: "CREATE_OUTSOURCE",
        module: "outsourcing",
        entity: "OutsourcedSample",
        entityId: outsourcedSample.id,
        targetType: "Order",
        targetRef: order.orderNumber,
        changes: {
          reflabId,
          reflabName: reflab.name,
          testCount: testIds.length,
          totalCost,
        },
      });

      return outsourcedSample;
    });
  }

  // ───────────────────────────────────────────
  // Dispatch to reference lab
  // ───────────────────────────────────────────

  async dispatchToReflab(
    outsourcedSampleId: string,
    dispatchRef: string,
    tenantId: string,
  ) {
    const sample = await this.prisma.outsourcedSample.findFirst({
      where: { id: outsourcedSampleId, tenantId },
    });
    if (!sample) throw new NotFoundException("Outsourced sample not found");

    if (sample.status !== "PENDING_DISPATCH") {
      throw new BadRequestException(
        `Cannot dispatch sample in ${sample.status} status`,
      );
    }

    return this.prisma.outsourcedSample.update({
      where: { id: outsourcedSampleId },
      data: {
        status: "DISPATCHED",
        dispatchRef,
        dispatchedAt: new Date(),
      },
      include: {
        tests: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true } },
          },
        },
        reflab: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });
  }

  // ───────────────────────────────────────────
  // Mark received by reference lab
  // ───────────────────────────────────────────

  async markReceivedByReflab(
    outsourcedSampleId: string,
    tenantId: string,
  ) {
    const sample = await this.prisma.outsourcedSample.findFirst({
      where: { id: outsourcedSampleId, tenantId },
    });
    if (!sample) throw new NotFoundException("Outsourced sample not found");

    if (sample.status !== "DISPATCHED") {
      throw new BadRequestException(
        `Cannot mark as received — sample is in ${sample.status} status`,
      );
    }

    return this.prisma.outsourcedSample.update({
      where: { id: outsourcedSampleId },
      data: {
        status: "RECEIVED_BY_REFLAB",
        receivedAt: new Date(),
      },
      include: {
        tests: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true } },
          },
        },
        reflab: { select: { id: true, name: true, code: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });
  }

  // ───────────────────────────────────────────
  // Receive results from reference lab
  // ───────────────────────────────────────────

  async receiveResults(
    outsourcedSampleId: string,
    results: Array<{
      testCatalogId: string;
      value: string;
      unit?: string;
    }>,
    tenantId: string,
    actorId: string,
  ) {
    const sample = await this.prisma.outsourcedSample.findFirst({
      where: { id: outsourcedSampleId, tenantId },
      include: { tests: true },
    });
    if (!sample) throw new NotFoundException("Outsourced sample not found");

    if (
      sample.status !== "DISPATCHED" &&
      sample.status !== "RECEIVED_BY_REFLAB" &&
      sample.status !== "RESULTS_PENDING"
    ) {
      throw new BadRequestException(
        `Cannot receive results — sample is in ${sample.status} status`,
      );
    }

    // Validate that all result testCatalogIds are outsourced
    const outsourcedTestIds = new Set(
      sample.tests.map((t) => t.testCatalogId),
    );
    const invalidResults = results.filter(
      (r) => !outsourcedTestIds.has(r.testCatalogId),
    );
    if (invalidResults.length > 0) {
      throw new BadRequestException(
        `Tests not part of this outsource: ${invalidResults.map((r) => r.testCatalogId).join(", ")}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update each outsourced test
      for (const result of results) {
        await tx.outsourcedTest.updateMany({
          where: {
            outsourcedSampleId,
            testCatalogId: result.testCatalogId,
          },
          data: {
            resultEntered: true,
            resultEnteredAt: new Date(),
          },
        });
      }

      // Check if all tests now have results
      const updatedTests = await tx.outsourcedTest.findMany({
        where: { outsourcedSampleId },
      });
      const allEntered = updatedTests.every((t) => t.resultEntered);

      // Update sample status
      const updated = await tx.outsourcedSample.update({
        where: { id: outsourcedSampleId },
        data: {
          status: allEntered ? "RESULTS_RECEIVED" : "RESULTS_PENDING",
          ...(allEntered ? { resultReceivedAt: new Date() } : {}),
          resultNotes: `Results entered for ${results.length} test(s)`,
        },
        include: {
          tests: {
            include: {
              testCatalog: { select: { id: true, name: true, code: true } },
            },
          },
          reflab: { select: { id: true, name: true, code: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      // Audit log
      await this.auditService.log({
        tenantId,
        actorId,
        action: "RECEIVE_OUTSOURCE_RESULTS",
        module: "outsourcing",
        entity: "OutsourcedSample",
        entityId: outsourcedSampleId,
        changes: {
          resultsCount: results.length,
          allEntered,
        },
      });

      return updated;
    });
  }

  // ───────────────────────────────────────────
  // List outsourced samples
  // ───────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: {
      status?: string;
      reflabId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.reflabId) {
      where.reflabId = query.reflabId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.outsourcedSample.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reflab: { select: { id: true, name: true, code: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
            },
          },
          tests: {
            include: {
              testCatalog: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      this.prisma.outsourcedSample.count({ where }),
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

  // ───────────────────────────────────────────
  // Pending dispatch
  // ───────────────────────────────────────────

  async getPendingDispatch(tenantId: string) {
    return this.prisma.outsourcedSample.findMany({
      where: { tenantId, status: "PENDING_DISPATCH" },
      orderBy: { createdAt: "asc" },
      include: {
        reflab: { select: { id: true, name: true, code: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          },
        },
        tests: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  // ───────────────────────────────────────────
  // Awaiting results
  // ───────────────────────────────────────────

  async getAwaitingResults(tenantId: string) {
    return this.prisma.outsourcedSample.findMany({
      where: {
        tenantId,
        status: { in: ["DISPATCHED", "RECEIVED_BY_REFLAB", "RESULTS_PENDING"] },
      },
      orderBy: { expectedAt: "asc" },
      include: {
        reflab: { select: { id: true, name: true, code: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          },
        },
        tests: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }
}

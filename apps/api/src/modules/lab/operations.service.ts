import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderStatus } from "@delvion/types";

interface OperationsFilters {
  department?: string;
  status?: string;
  isStatOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get operations queue — orders that are RECEIVED, PENDING_PROCESSING, or IN_PROCESSING.
   * Calculates TAT remaining for each order. Sorts by priority and TAT.
   */
  async getOperationsQueue(tenantId: string, filters: OperationsFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusFilter = filters.status
      ? [filters.status as OrderStatus]
      : [
          OrderStatus.RECEIVED,
          OrderStatus.PENDING_PROCESSING,
          OrderStatus.IN_PROCESSING,
        ];

    const where: Record<string, unknown> = {
      tenantId,
      status: { in: statusFilter },
    };

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
              { mrn: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (filters.department) {
      where.items = {
        some: {
          testCatalog: {
            department: { equals: filters.department, mode: "insensitive" },
          },
        },
      };
    }

    const [orders, total] = await Promise.all([
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
                  department: true,
                  turnaroundHours: true,
                  sampleType: true,
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
              isStatSample: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Calculate TAT remaining for each order
    const now = Date.now();
    const enriched = orders.map((order) => {
      const maxTatHours = Math.max(
        ...order.items.map((i) => i.testCatalog.turnaroundHours ?? 24),
        24,
      );
      const startedAt = order.accessionedAt ?? order.createdAt;
      const elapsedHours =
        (now - new Date(startedAt).getTime()) / (1000 * 60 * 60);
      const tatRemainingHours = Math.max(0, maxTatHours - elapsedHours);
      const isTatBreached = tatRemainingHours <= 0;

      return {
        ...order,
        maxTatHours,
        elapsedHours: Math.round(elapsedHours * 10) / 10,
        tatRemainingHours: Math.round(tatRemainingHours * 10) / 10,
        isTatBreached,
      };
    });

    // Sort: STAT/URGENT first, then by TAT remaining ascending
    const priorityOrder: Record<string, number> = {
      STAT: 0,
      URGENT: 1,
      ROUTINE: 2,
    };
    enriched.sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 2) -
          (priorityOrder[b.priority] ?? 2) ||
        a.tatRemainingHours - b.tatRemainingHours,
    );

    return {
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Start processing an order.
   */
  async startProcessing(orderId: string, userId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const validStatuses: string[] = [
      OrderStatus.RECEIVED,
      OrderStatus.PENDING_PROCESSING,
    ];
    if (!validStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot start processing from status ${order.status}. Must be RECEIVED or PENDING_PROCESSING.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.IN_PROCESSING,
        processingStartedAt: new Date(),
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
        items: {
          include: {
            testCatalog: { select: { id: true, name: true, department: true } },
          },
        },
      },
    });

    return updated;
  }

  /**
   * Get dashboard stats (today's numbers).
   */
  async getDashboardStats(tenantId: string) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const baseWhere = {
      tenantId,
      createdAt: { gte: dayStart, lte: dayEnd },
    };

    const [
      registered,
      accessioned,
      processing,
      approved,
      dispatched,
      statCount,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { ...baseWhere },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, status: OrderStatus.RECEIVED },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, status: OrderStatus.IN_PROCESSING },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, status: OrderStatus.APPROVED },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, status: OrderStatus.DISPATCHED },
      }),
      this.prisma.order.count({
        where: { ...baseWhere, priority: "STAT" },
      }),
    ]);

    // Calculate average TAT for completed orders today
    const completedOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        approvedAt: { gte: dayStart, lte: dayEnd },
        accessionedAt: { not: null },
      },
      select: { accessionedAt: true, approvedAt: true },
    });

    let avgTatHours = 0;
    if (completedOrders.length > 0) {
      const totalHours = completedOrders.reduce((sum, o) => {
        if (o.accessionedAt && o.approvedAt) {
          return (
            sum +
            (o.approvedAt.getTime() - o.accessionedAt.getTime()) /
              (1000 * 60 * 60)
          );
        }
        return sum;
      }, 0);
      avgTatHours = Math.round((totalHours / completedOrders.length) * 10) / 10;
    }

    // TAT breached count
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: {
          in: [
            OrderStatus.RECEIVED,
            OrderStatus.PENDING_PROCESSING,
            OrderStatus.IN_PROCESSING,
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
    for (const order of pendingOrders) {
      const maxTat = Math.max(
        ...order.items.map((i) => i.testCatalog.turnaroundHours ?? 24),
        24,
      );
      const startedAt = order.accessionedAt ?? order.createdAt;
      const elapsedHours =
        (now - new Date(startedAt).getTime()) / (1000 * 60 * 60);
      if (elapsedHours > maxTat) {
        tatBreached++;
      }
    }

    return {
      registered,
      accessioned,
      processing,
      approved,
      dispatched,
      avgTatHours,
      statCount,
      tatBreached,
    };
  }

  /**
   * Get department-wise workload — groups in-process orders by department.
   */
  async getDepartmentWorkload(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: {
          in: [
            OrderStatus.RECEIVED,
            OrderStatus.PENDING_PROCESSING,
            OrderStatus.IN_PROCESSING,
          ],
        },
      },
      include: {
        items: {
          include: {
            testCatalog: { select: { department: true } },
          },
        },
      },
    });

    const deptMap: Record<string, number> = {};
    for (const order of orders) {
      const departments = new Set(
        order.items.map((i) => i.testCatalog.department),
      );
      for (const dept of departments) {
        deptMap[dept] = (deptMap[dept] ?? 0) + 1;
      }
    }

    return Object.entries(deptMap)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get waiting list with status counts (LiveHealth-style operations page).
   */
  async getWaitingList(tenantId: string, filters: OperationsFilters & { statusFilter?: string }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    let statusValues: OrderStatus[];
    switch (filters.statusFilter) {
      case "incomplete":
        statusValues = [OrderStatus.RECEIVED, OrderStatus.PENDING_PROCESSING];
        break;
      case "partially_completed":
        statusValues = [OrderStatus.IN_PROCESSING];
        break;
      case "completed":
        statusValues = [OrderStatus.RESULTED, OrderStatus.PENDING_APPROVAL];
        break;
      case "signed":
        statusValues = [OrderStatus.APPROVED, OrderStatus.REPORTED];
        break;
      case "dispatched":
        statusValues = [OrderStatus.DISPATCHED, OrderStatus.DELIVERED];
        break;
      case "cancelled":
        statusValues = [OrderStatus.CANCELLED];
        break;
      default:
        statusValues = [
          OrderStatus.RECEIVED,
          OrderStatus.PENDING_PROCESSING,
          OrderStatus.IN_PROCESSING,
          OrderStatus.RESULTED,
          OrderStatus.PENDING_APPROVAL,
        ];
    }

    // Only show orders that contain at least one PATHOLOGY test
    // (imaging/non-path orders are handled by the Imaging Worklist)
    const pathologyFilter = {
      some: {
        testCatalog: {
          investigationType: "PATHOLOGY",
        },
      },
    };

    const where: Record<string, unknown> = {
      tenantId,
      status: { in: statusValues },
      items: pathologyFilter,
    };

    if (filters.department) {
      where.items = {
        some: {
          testCatalog: {
            investigationType: "PATHOLOGY",
            department: { equals: filters.department, mode: "insensitive" },
          },
        },
      };
    }

    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: "insensitive" } },
        {
          patient: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { mrn: { contains: filters.search, mode: "insensitive" } },
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
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        include: {
          patient: {
            select: {
              id: true, firstName: true, lastName: true, mrn: true,
              gender: true, dob: true, phone: true,
            },
          },
          items: {
            where: {
              testCatalog: {
                investigationType: "PATHOLOGY",
              },
            },
            include: {
              testCatalog: {
                select: {
                  id: true, name: true, code: true, department: true,
                  turnaroundHours: true, sampleType: true,
                },
              },
              testResults: { select: { id: true, interpretation: true } },
            },
          },
          samples: {
            select: { id: true, barcodeId: true, type: true, status: true },
          },
          invoices: {
            select: { id: true, invoiceNumber: true },
            take: 1,
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const now = Date.now();
    const enriched = data.map((order) => {
      const tests = (order.items ?? []).map((i) => i.testCatalog);
      const totalTests = order.items.length;
      const completedTests = order.items.filter(
        (i) => (i.testResults ?? []).length > 0,
      ).length;
      const maxTatHours = Math.max(
        ...order.items.map((i) => i.testCatalog.turnaroundHours ?? 24),
        24,
      );
      const startedAt = order.accessionedAt ?? order.createdAt;
      const elapsedHours =
        (now - new Date(startedAt).getTime()) / (1000 * 60 * 60);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        priority: order.priority,
        createdAt: order.createdAt,
        accessionedAt: order.accessionedAt,
        patient: order.patient,
        tests: tests.map((t) => t.name),
        testDetails: tests.map((t) => ({ id: (t as any).id, name: t.name })),
        totalTests,
        completedTests,
        incompleteTests: totalTests - completedTests,
        signedTests: 0,
        invoiceNumber: order.invoices[0]?.invoiceNumber ?? null,
        accessionNumbers: order.samples.map((s) => s.barcodeId),
        isTatBreached: elapsedHours > maxTatHours,
        maxTatHours,
        elapsedHours: Math.round(elapsedHours * 10) / 10,
        createdBy: order.createdBy,
      };
    });

    return { data: enriched, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Get status counts for sidebar (LiveHealth-style).
   */
  async getStatusCounts(tenantId: string) {
    const [incomplete, partiallyCompleted, completed, signed, dispatched, cancelled] =
      await Promise.all([
        this.prisma.order.count({
          where: { tenantId, status: { in: [OrderStatus.RECEIVED, OrderStatus.PENDING_PROCESSING] } },
        }),
        this.prisma.order.count({
          where: { tenantId, status: OrderStatus.IN_PROCESSING },
        }),
        this.prisma.order.count({
          where: { tenantId, status: { in: [OrderStatus.RESULTED, OrderStatus.PENDING_APPROVAL] } },
        }),
        this.prisma.order.count({
          where: { tenantId, status: { in: [OrderStatus.APPROVED, OrderStatus.REPORTED] } },
        }),
        this.prisma.order.count({
          where: { tenantId, status: { in: [OrderStatus.DISPATCHED, OrderStatus.DELIVERED] } },
        }),
        this.prisma.order.count({
          where: { tenantId, status: OrderStatus.CANCELLED },
        }),
      ]);

    // TAT breached
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: { in: [OrderStatus.RECEIVED, OrderStatus.PENDING_PROCESSING, OrderStatus.IN_PROCESSING] },
      },
      include: {
        items: { include: { testCatalog: { select: { turnaroundHours: true } } } },
      },
    });

    const now = Date.now();
    let tatExceeded = 0;
    let critical = 0;
    for (const order of pendingOrders) {
      const maxTat = Math.max(
        ...order.items.map((i) => i.testCatalog.turnaroundHours ?? 24),
        24,
      );
      const startedAt = order.accessionedAt ?? order.createdAt;
      if ((now - new Date(startedAt).getTime()) / (1000 * 60 * 60) > maxTat) tatExceeded++;
      if (order.priority === "STAT") critical++;
    }

    return {
      allTests: incomplete + partiallyCompleted + completed + signed,
      incomplete,
      partiallyCompleted,
      activeReruns: 0,
      completed,
      partiallySigned: 0,
      signed,
      emergency: 0,
      critical,
      tatExceeded,
      outsourced: 0,
      dispatched,
      cancelled,
    };
  }

  /**
   * Get hourly order volume for today (6AM–10PM).
   */
  async getHourlyVolume(tenantId: string) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { createdAt: true },
    });

    // Build hourly buckets from 6AM to 10PM
    const hourly: { hour: number; count: number }[] = [];
    for (let h = 6; h <= 22; h++) {
      const count = orders.filter((o) => {
        const hour = new Date(o.createdAt).getHours();
        return hour === h;
      }).length;
      hourly.push({ hour: h, count });
    }

    return hourly;
  }
}

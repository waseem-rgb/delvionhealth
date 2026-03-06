import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/services/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  OrderStatus,
  ResultInterpretation,
  ReportApprovalStatus,
} from "@delvion/types";

interface ApprovalFilters {
  priority?: string;
  hasCritical?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Get pending approvals — orders with status PENDING_APPROVAL.
   */
  async getPendingApprovals(tenantId: string, filters: ApprovalFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId,
      status: OrderStatus.PENDING_APPROVAL,
    };

    if (filters.priority) {
      where.priority = filters.priority;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "asc" }, { resultSubmittedAt: "asc" }],
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
                },
              },
              testResults: {
                include: {
                  enteredBy: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Enrich with hasCritical flag and compute wait time
    const now = Date.now();
    const enriched = orders.map((order) => {
      const allResults = order.items.flatMap((i) => i.testResults);
      const hasCritical = allResults.some(
        (r) => r.interpretation === ResultInterpretation.CRITICAL,
      );
      const waitTimeMinutes = order.resultSubmittedAt
        ? Math.round(
            (now - new Date(order.resultSubmittedAt).getTime()) / (1000 * 60),
          )
        : 0;

      return {
        ...order,
        hasCritical,
        waitTimeMinutes,
      };
    });

    // Sort: CRITICAL first, then STAT, then by wait time descending
    const priorityOrder: Record<string, number> = {
      STAT: 0,
      URGENT: 1,
      ROUTINE: 2,
    };

    if (filters.hasCritical) {
      // Only return orders with critical results
      const filtered = enriched.filter((o) => o.hasCritical);
      filtered.sort(
        (a, b) =>
          (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) ||
          b.waitTimeMinutes - a.waitTimeMinutes,
      );
      return {
        data: filtered,
        meta: {
          total: filtered.length,
          page,
          limit,
          totalPages: Math.ceil(filtered.length / limit),
        },
      };
    }

    enriched.sort(
      (a, b) =>
        (a.hasCritical === b.hasCritical ? 0 : a.hasCritical ? -1 : 1) ||
        (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) ||
        b.waitTimeMinutes - a.waitTimeMinutes,
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
   * Get approval stats.
   */
  async getApprovalStats(tenantId: string) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const [pending, approvedToday, rejectedToday] = await Promise.all([
      this.prisma.order.count({
        where: { tenantId, status: OrderStatus.PENDING_APPROVAL },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          status: OrderStatus.APPROVED,
          approvedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      // Orders rejected (sent back to IN_PROCESSING) today via audit log
      this.prisma.auditLog.count({
        where: {
          tenantId,
          action: "APPROVAL_REJECT",
          module: "lab",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
    ]);

    // Count orders with critical results
    const pendingOrders = await this.prisma.order.findMany({
      where: { tenantId, status: OrderStatus.PENDING_APPROVAL },
      include: {
        testResults: {
          select: { interpretation: true },
        },
      },
    });

    let criticalCount = 0;
    for (const order of pendingOrders) {
      if (
        order.testResults.some(
          (r) => r.interpretation === ResultInterpretation.CRITICAL,
        )
      ) {
        criticalCount++;
      }
    }

    return {
      pending,
      critical: criticalCount,
      approvedToday,
      rejectedToday,
    };
  }

  /**
   * Approve an order's results.
   */
  async approveOrder(
    orderId: string,
    userId: string,
    tenantId: string,
    signatureUrl?: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Order cannot be approved from status ${order.status}. Must be PENDING_APPROVAL.`,
      );
    }

    const now = new Date();

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.APPROVED,
        approvedAt: now,
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
      },
    });

    // Update related LabReport if exists
    await this.prisma.labReport.updateMany({
      where: { orderId, tenantId },
      data: {
        approvalStatus: ReportApprovalStatus.APPROVED,
        approvedById: userId,
        approvedAt: now,
        ...(signatureUrl ? { signatureUrl } : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: userId,
      action: "APPROVAL_APPROVE",
      module: "lab",
      entity: "Order",
      entityId: orderId,
      targetRef: order.orderNumber,
      changes: {
        status: { from: OrderStatus.PENDING_APPROVAL, to: OrderStatus.APPROVED },
      },
    });

    return updated;
  }

  /**
   * Reject order results (send back for re-entry).
   */
  async rejectOrder(
    orderId: string,
    reason: string,
    userId: string,
    tenantId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        testResults: {
          select: { enteredById: true },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Order cannot be rejected from status ${order.status}. Must be PENDING_APPROVAL.`,
      );
    }

    // Send back to IN_PROCESSING
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.IN_PROCESSING,
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, mrn: true },
        },
      },
    });

    // Notify the technician who submitted the results
    const technicianId = order.testResults[0]?.enteredById;
    if (technicianId) {
      await this.notifications.send(tenantId, technicianId, {
        title: "Results Rejected — Re-entry Required",
        body: `Order ${order.orderNumber} results were rejected. Reason: ${reason}`,
        type: "RESULT_REJECTED",
        entityId: orderId,
        entityType: "Order",
      });
    }

    // Update related LabReport if exists
    await this.prisma.labReport.updateMany({
      where: { orderId, tenantId },
      data: {
        approvalStatus: ReportApprovalStatus.REJECTED,
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: userId,
      action: "APPROVAL_REJECT",
      module: "lab",
      entity: "Order",
      entityId: orderId,
      targetRef: order.orderNumber,
      changes: {
        status: {
          from: OrderStatus.PENDING_APPROVAL,
          to: OrderStatus.IN_PROCESSING,
        },
        rejectionReason: reason,
      },
    });

    return updated;
  }

  /**
   * Bulk approve multiple orders.
   * Only approves non-critical orders; skips critical ones.
   */
  async bulkApprove(
    orderIds: string[],
    userId: string,
    tenantId: string,
  ): Promise<{
    approved: number;
    skipped: { id: string; reason: string }[];
  }> {
    let approvedCount = 0;
    const skipped: { id: string; reason: string }[] = [];

    for (const id of orderIds) {
      // Check if order has critical results
      const order = await this.prisma.order.findFirst({
        where: { id, tenantId, status: OrderStatus.PENDING_APPROVAL },
        include: {
          testResults: { select: { interpretation: true } },
        },
      });

      if (!order) {
        skipped.push({ id, reason: "Order not found or not in PENDING_APPROVAL status" });
        continue;
      }

      const hasCritical = order.testResults.some(
        (r) => r.interpretation === ResultInterpretation.CRITICAL,
      );

      if (hasCritical) {
        skipped.push({
          id,
          reason: "Order has CRITICAL results — requires individual review",
        });
        continue;
      }

      try {
        await this.approveOrder(id, userId, tenantId);
        approvedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        skipped.push({ id, reason: message });
      }
    }

    return { approved: approvedCount, skipped };
  }

  /**
   * Get full report preview data for an order.
   */
  async getReportPreview(orderId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            gender: true,
            dob: true,
            phone: true,
            email: true,
            address: true,
            referringDoctorId: true,
          },
        },
        items: {
          include: {
            testCatalog: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
                department: true,
                sampleType: true,
                methodology: true,
              },
            },
            testResults: {
              include: {
                enteredBy: { select: { firstName: true, lastName: true } },
                verifiedBy: { select: { firstName: true, lastName: true } },
                validatedBy: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        samples: {
          select: {
            id: true,
            barcodeId: true,
            type: true,
            collectedAt: true,
            receivedAt: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        labReports: {
          select: {
            id: true,
            reportNumber: true,
            status: true,
            approvalStatus: true,
            signatureUrl: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Fetch referring doctor info if available
    let referringDoctor = null;
    if (order.patient.referringDoctorId) {
      referringDoctor = await this.prisma.doctor.findUnique({
        where: { id: order.patient.referringDoctorId },
        select: {
          id: true,
          name: true,
          specialty: true,
          clinicName: true,
          registrationNumber: true,
        },
      });
    }

    // Calculate patient age
    const patientAge = Math.floor(
      (Date.now() - new Date(order.patient.dob).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25),
    );

    return {
      ...order,
      patientAge,
      referringDoctor,
    };
  }
}

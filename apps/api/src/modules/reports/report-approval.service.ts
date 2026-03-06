import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

@Injectable()
export class ReportApprovalService {
  private readonly logger = new Logger(ReportApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async approveReport(reportId: string, approverId: string, tenantId: string) {
    // Verify the approver has permission
    const approver = await this.prisma.user.findFirst({
      where: { id: approverId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        canApproveReports: true,
        signatureUrl: true,
      },
    });

    if (!approver) {
      throw new NotFoundException("Approver user not found");
    }

    if (!approver.canApproveReports) {
      throw new ForbiddenException(
        "You do not have permission to approve reports. Contact your administrator to enable report approval."
      );
    }

    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        order: {
          select: { orderNumber: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    if (report.approvalStatus === "APPROVED") {
      throw new BadRequestException("Report has already been approved");
    }

    if (report.approvalStatus === "AUTO_APPROVED") {
      throw new BadRequestException("Report has already been auto-approved");
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReport = await tx.labReport.update({
        where: { id: reportId },
        data: {
          approvalStatus: "APPROVED",
          approvedById: approverId,
          approvedAt: now,
          signatureUrl: approver.signatureUrl ?? null,
          // Clear any previous rejection data
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              patient: {
                select: { firstName: true, lastName: true, mrn: true },
              },
            },
          },
          approvedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: approverId,
          action: "APPROVE_REPORT",
          entity: "LabReport",
          entityId: reportId,
          module: "reports",
          oldValue: { approvalStatus: report.approvalStatus },
          newValue: {
            approvalStatus: "APPROVED",
            reportNumber: report.reportNumber,
          },
        },
      });

      return updatedReport;
    });

    this.logger.log(
      `Report ${report.reportNumber} approved by user ${approverId} for tenant ${tenantId}`
    );

    return updated;
  }

  async rejectReport(
    reportId: string,
    rejectorId: string,
    reason: string,
    tenantId: string
  ) {
    // Verify the rejector has permission
    const rejector = await this.prisma.user.findFirst({
      where: { id: rejectorId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        canApproveReports: true,
      },
    });

    if (!rejector) {
      throw new NotFoundException("User not found");
    }

    if (!rejector.canApproveReports) {
      throw new ForbiddenException(
        "You do not have permission to reject reports. Contact your administrator to enable report approval."
      );
    }

    if (!reason?.trim()) {
      throw new BadRequestException("Rejection reason is required");
    }

    const report = await this.prisma.labReport.findFirst({
      where: { id: reportId, tenantId },
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    if (report.approvalStatus === "REJECTED") {
      throw new BadRequestException("Report has already been rejected");
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReport = await tx.labReport.update({
        where: { id: reportId },
        data: {
          approvalStatus: "REJECTED",
          rejectedById: rejectorId,
          rejectedAt: now,
          rejectionReason: reason.trim(),
          // Clear any previous approval data
          approvedById: null,
          approvedAt: null,
          signatureUrl: null,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              patient: {
                select: { firstName: true, lastName: true, mrn: true },
              },
            },
          },
          rejectedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: rejectorId,
          action: "REJECT_REPORT",
          entity: "LabReport",
          entityId: reportId,
          module: "reports",
          oldValue: { approvalStatus: report.approvalStatus },
          newValue: {
            approvalStatus: "REJECTED",
            reportNumber: report.reportNumber,
            rejectionReason: reason.trim(),
          },
        },
      });

      return updatedReport;
    });

    this.logger.log(
      `Report ${report.reportNumber} rejected by user ${rejectorId} for tenant ${tenantId}`
    );

    return updated;
  }

  async getPendingApprovals(
    tenantId: string,
    query: {
      search?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.LabReportWhereInput = {
      tenantId,
      approvalStatus: "PENDING",
    };

    // Date filters
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as Prisma.DateTimeFilter).lte = toDate;
      }
    }

    // Search filter: search by report number or patient name/MRN
    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { reportNumber: { contains: searchTerm, mode: "insensitive" } },
        {
          order: {
            orderNumber: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          order: {
            patient: {
              OR: [
                { firstName: { contains: searchTerm, mode: "insensitive" } },
                { lastName: { contains: searchTerm, mode: "insensitive" } },
                { mrn: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const [reports, total] = await Promise.all([
      this.prisma.labReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          // Critical results first — we order by createdAt as a secondary sort;
          // the frontend can further sort by criticality if needed
          { createdAt: "asc" },
        ],
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              priority: true,
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
                    select: { id: true, name: true, code: true },
                  },
                  testResults: {
                    where: { tenantId },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                      id: true,
                      value: true,
                      interpretation: true,
                      referenceRange: true,
                      unit: true,
                    },
                  },
                },
              },
            },
          },
          signedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.labReport.count({ where }),
    ]);

    // Sort: reports with CRITICAL results first
    const sorted = reports.sort((a, b) => {
      const aCritical = a.order.items.some((item) =>
        item.testResults.some((r) => r.interpretation === "CRITICAL")
      );
      const bCritical = b.order.items.some((item) =>
        item.testResults.some((r) => r.interpretation === "CRITICAL")
      );

      if (aCritical && !bCritical) return -1;
      if (!aCritical && bCritical) return 1;

      // Then by STAT/URGENT priority
      const priorityOrder: Record<string, number> = {
        STAT: 0,
        URGENT: 1,
        ROUTINE: 2,
      };
      const aPriority = priorityOrder[a.order.priority] ?? 2;
      const bPriority = priorityOrder[b.order.priority] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then by createdAt ascending (oldest first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return {
      data: sorted,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async bulkApprove(
    reportIds: string[],
    approverId: string,
    tenantId: string
  ) {
    if (!reportIds?.length) {
      throw new BadRequestException("At least one report ID is required");
    }

    if (reportIds.length > 50) {
      throw new BadRequestException("Cannot bulk approve more than 50 reports at once");
    }

    const results = await Promise.allSettled(
      reportIds.map((id) => this.approveReport(id, approverId, tenantId))
    );

    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    results.forEach((result, index) => {
      const reportId = reportIds[index]!;
      if (result.status === "fulfilled") {
        succeeded.push(reportId);
      } else {
        failed.push({
          id: reportId,
          reason: result.reason?.message ?? "Unknown error",
        });
      }
    });

    this.logger.log(
      `Bulk approve: ${succeeded.length} succeeded, ${failed.length} failed for tenant ${tenantId}`
    );

    return {
      succeeded,
      failed,
      total: reportIds.length,
      successCount: succeeded.length,
      failCount: failed.length,
    };
  }

  async uploadSignature(userId: string, signatureUrl: string) {
    if (!signatureUrl?.trim()) {
      throw new BadRequestException("Signature URL is required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { signatureUrl: signatureUrl.trim() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        signatureUrl: true,
      },
    });

    this.logger.log(`Signature uploaded for user ${userId}`);

    return updated;
  }
}

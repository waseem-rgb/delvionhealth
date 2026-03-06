import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/services/audit.service";
import { Decimal } from "@prisma/client/runtime/library";
import { InvoiceStatus } from "@delvion/types";

@Injectable()
export class DiscountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ───────────────────────────────────────────
  // Apply discount to order
  // Checks tenant config for approval requirements
  // ───────────────────────────────────────────

  async applyDiscount(
    orderId: string,
    pct: number,
    reason: string | undefined,
    actorId: string,
    tenantId: string,
  ) {
    // Validate the order
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
        netAmount: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
      throw new BadRequestException(
        "Discount can only be applied to PENDING or CONFIRMED orders",
      );
    }

    // Check tenant discount settings
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        maxDiscountPct: true,
        requireDiscountApproval: true,
        discountApprovalThreshold: true,
      },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");

    // Enforce max discount percentage
    if (pct > tenant.maxDiscountPct) {
      throw new ForbiddenException(
        `Discount ${pct}% exceeds maximum allowed ${tenant.maxDiscountPct}%`,
      );
    }

    // Check if approval is required
    if (
      tenant.requireDiscountApproval &&
      pct > tenant.discountApprovalThreshold
    ) {
      // Check if there's already a pending approval for this order
      const existingApproval = await this.prisma.discountApproval.findUnique({
        where: { orderId },
      });
      if (existingApproval && existingApproval.status === "APPROVAL_PENDING") {
        throw new BadRequestException(
          "There is already a pending discount approval for this order",
        );
      }

      // Create approval request
      const approval = await this.prisma.discountApproval.create({
        data: {
          tenantId,
          orderId,
          requestedBy: actorId,
          requestedPct: pct,
          reason,
        },
        include: {
          order: { select: { id: true, orderNumber: true, totalAmount: true } },
        },
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: "REQUEST_DISCOUNT_APPROVAL",
        module: "billing",
        entity: "DiscountApproval",
        entityId: approval.id,
        targetType: "Order",
        targetRef: order.orderNumber,
        changes: { requestedPct: pct, reason },
      });

      return {
        requiresApproval: true,
        approvalId: approval.id,
        status: "APPROVAL_PENDING",
        message: `Discount of ${pct}% requires approval (threshold: ${tenant.discountApprovalThreshold}%)`,
      };
    }

    // Apply discount directly
    const discountAmount = order.totalAmount.mul(new Decimal(pct).div(100));
    const netAmount = Decimal.max(
      order.totalAmount.minus(discountAmount),
      new Decimal(0),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { discountAmount, netAmount },
      });

      // Update draft invoice if exists
      await tx.invoice.updateMany({
        where: { orderId, status: InvoiceStatus.DRAFT },
        data: { discount: discountAmount, total: netAmount },
      });
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: "APPLY_DISCOUNT",
      module: "billing",
      entity: "Order",
      entityId: orderId,
      targetRef: order.orderNumber,
      changes: {
        discountPct: pct,
        discountAmount: discountAmount.toFixed(2),
        newNetAmount: netAmount.toFixed(2),
        reason,
      },
    });

    return {
      requiresApproval: false,
      discountPct: pct,
      discountAmount: Number(discountAmount),
      netAmount: Number(netAmount),
    };
  }

  // ───────────────────────────────────────────
  // Approve a pending discount
  // ───────────────────────────────────────────

  async approveDiscount(
    approvalId: string,
    approverId: string,
    tenantId: string,
  ) {
    const approval = await this.prisma.discountApproval.findFirst({
      where: { id: approvalId, tenantId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });
    if (!approval) throw new NotFoundException("Discount approval not found");

    if (approval.status !== "APPROVAL_PENDING") {
      throw new BadRequestException(
        `Approval is in ${approval.status} state, cannot approve`,
      );
    }

    // Apply the discount
    const discountAmount = approval.order.totalAmount.mul(
      new Decimal(approval.requestedPct).div(100),
    );
    const netAmount = Decimal.max(
      approval.order.totalAmount.minus(discountAmount),
      new Decimal(0),
    );

    await this.prisma.$transaction(async (tx) => {
      // Update approval record
      await tx.discountApproval.update({
        where: { id: approvalId },
        data: {
          status: "APPROVAL_APPROVED",
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });

      // Apply discount to order
      await tx.order.update({
        where: { id: approval.orderId },
        data: { discountAmount, netAmount },
      });

      // Update draft invoice
      await tx.invoice.updateMany({
        where: { orderId: approval.orderId, status: InvoiceStatus.DRAFT },
        data: { discount: discountAmount, total: netAmount },
      });
    });

    await this.auditService.log({
      tenantId,
      actorId: approverId,
      action: "APPROVE_DISCOUNT",
      module: "billing",
      entity: "DiscountApproval",
      entityId: approvalId,
      targetType: "Order",
      targetRef: approval.order.orderNumber,
      changes: {
        requestedPct: approval.requestedPct,
        discountAmount: discountAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
      },
    });

    return {
      approvalId,
      status: "APPROVAL_APPROVED",
      discountPct: approval.requestedPct,
      discountAmount: Number(discountAmount),
      netAmount: Number(netAmount),
    };
  }

  // ───────────────────────────────────────────
  // Reject a pending discount
  // ───────────────────────────────────────────

  async rejectDiscount(
    approvalId: string,
    rejectionReason: string | undefined,
    approverId: string,
    tenantId: string,
  ) {
    const approval = await this.prisma.discountApproval.findFirst({
      where: { id: approvalId, tenantId },
      include: {
        order: { select: { id: true, orderNumber: true } },
      },
    });
    if (!approval) throw new NotFoundException("Discount approval not found");

    if (approval.status !== "APPROVAL_PENDING") {
      throw new BadRequestException(
        `Approval is in ${approval.status} state, cannot reject`,
      );
    }

    await this.prisma.discountApproval.update({
      where: { id: approvalId },
      data: {
        status: "APPROVAL_REJECTED",
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: approverId,
      action: "REJECT_DISCOUNT",
      module: "billing",
      entity: "DiscountApproval",
      entityId: approvalId,
      targetType: "Order",
      targetRef: approval.order.orderNumber,
      changes: {
        requestedPct: approval.requestedPct,
        rejectionReason,
      },
    });

    return {
      approvalId,
      status: "APPROVAL_REJECTED",
      rejectionReason,
    };
  }

  // ───────────────────────────────────────────
  // Get pending approvals
  // ───────────────────────────────────────────

  async getPendingApprovals(tenantId: string) {
    return this.prisma.discountApproval.findMany({
      where: {
        tenantId,
        status: "APPROVAL_PENDING",
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            patient: {
              select: { id: true, firstName: true, lastName: true, mrn: true },
            },
          },
        },
      },
    });
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface ValidateCouponContext {
  patientPhone: string;
  orderAmount: number;
  testIds: string[];
  patientGender?: string;
  patientAge?: number;
  isFirstVisit?: boolean;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: { page?: number; limit?: number; type?: string; isActive?: string }) {
    const take = query.limit || 50;
    const skip = ((query.page || 1) - 1) * take;
    const where: Record<string, unknown> = { tenantId };
    if (query.type) where.type = query.type;
    if (query.isActive === "true") where.isActive = true;
    if (query.isActive === "false") where.isActive = false;

    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      this.prisma.coupon.count({ where }),
    ]);
    return { data, total, page: query.page || 1, limit: take };
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.coupon.findFirst({ where: { id, tenantId }, include: { usages: { take: 50, orderBy: { usedAt: "desc" } } } });
  }

  async create(tenantId: string, dto: Record<string, unknown>, userId: string) {
    return this.prisma.coupon.create({
      data: {
        tenantId,
        code: (dto.code as string).toUpperCase().trim(),
        name: dto.name as string,
        type: dto.type as string,
        discountType: (dto.discountType as string) || "PERCENTAGE",
        discountValue: dto.discountValue as number,
        minOrderValue: dto.minOrderValue as number | undefined,
        maxDiscountAmt: dto.maxDiscountAmt as number | undefined,
        applicableTestIds: dto.applicableTestIds ? JSON.stringify(dto.applicableTestIds) : undefined,
        applicablePackageIds: dto.applicablePackageIds ? JSON.stringify(dto.applicablePackageIds) : undefined,
        targetGender: dto.targetGender as string | undefined,
        targetAgeMin: dto.targetAgeMin as number | undefined,
        targetAgeMax: dto.targetAgeMax as number | undefined,
        isFirstVisitOnly: (dto.isFirstVisitOnly as boolean) || false,
        maxUsageTotal: dto.maxUsageTotal as number | undefined,
        maxUsagePerPhone: (dto.maxUsagePerPhone as number) ?? 1,
        validFrom: new Date(dto.validFrom as string),
        validTo: new Date(dto.validTo as string),
        campaignId: dto.campaignId as string | undefined,
        organisationId: dto.organisationId as string | undefined,
        doctorId: dto.doctorId as string | undefined,
        createdById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.minOrderValue !== undefined) data.minOrderValue = dto.minOrderValue;
    if (dto.maxDiscountAmt !== undefined) data.maxDiscountAmt = dto.maxDiscountAmt;
    if (dto.targetGender !== undefined) data.targetGender = dto.targetGender;
    if (dto.maxUsageTotal !== undefined) data.maxUsageTotal = dto.maxUsageTotal;
    if (dto.maxUsagePerPhone !== undefined) data.maxUsagePerPhone = dto.maxUsagePerPhone;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom as string);
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo as string);
    if (dto.isFirstVisitOnly !== undefined) data.isFirstVisitOnly = dto.isFirstVisitOnly;

    return this.prisma.coupon.updateMany({ where: { id, tenantId }, data });
  }

  async toggleActive(tenantId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, tenantId } });
    if (!coupon) return null;
    return this.prisma.coupon.update({ where: { id }, data: { isActive: !coupon.isActive } });
  }

  async getUsage(tenantId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, tenantId } });
    if (!coupon) return null;
    const usages = await this.prisma.couponUsage.findMany({
      where: { tenantId, couponId: id },
      orderBy: { usedAt: "desc" },
      take: 100,
    });
    return {
      coupon,
      usages,
      stats: {
        totalUsed: coupon.usageCount,
        totalDiscountGiven: coupon.totalDiscountGiven,
        totalRevenueGenerated: coupon.totalRevenueGenerated,
      },
    };
  }

  async validateCoupon(tenantId: string, code: string, context: ValidateCouponContext) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { tenantId, code: code.toUpperCase().trim(), isActive: true },
    });

    if (!coupon) return { valid: false, error: "Coupon code not found" };

    const now = new Date();
    if (now < coupon.validFrom) return { valid: false, error: "Coupon not yet active" };
    if (now > coupon.validTo) return { valid: false, error: "Coupon has expired" };

    if (coupon.maxUsageTotal && coupon.usageCount >= coupon.maxUsageTotal)
      return { valid: false, error: "Coupon usage limit reached" };

    if (coupon.maxUsagePerPhone) {
      const usedByPhone = await this.prisma.couponUsage.count({
        where: { tenantId, couponId: coupon.id, patientPhone: context.patientPhone },
      });
      if (usedByPhone >= coupon.maxUsagePerPhone)
        return { valid: false, error: "You have already used this coupon" };
    }

    if (coupon.isFirstVisitOnly && !context.isFirstVisit)
      return { valid: false, error: "This coupon is for first-time patients only" };

    if (coupon.minOrderValue && context.orderAmount < Number(coupon.minOrderValue))
      return { valid: false, error: `Minimum order ₹${coupon.minOrderValue} required` };

    if (coupon.targetGender && coupon.targetGender !== context.patientGender)
      return { valid: false, error: "This coupon is not applicable for this patient" };

    if (coupon.targetAgeMin && context.patientAge && context.patientAge < coupon.targetAgeMin)
      return { valid: false, error: "Patient age does not meet coupon criteria" };
    if (coupon.targetAgeMax && context.patientAge && context.patientAge > coupon.targetAgeMax)
      return { valid: false, error: "Patient age does not meet coupon criteria" };

    // Check applicable tests
    if (coupon.applicableTestIds) {
      try {
        const allowedIds = JSON.parse(coupon.applicableTestIds) as string[];
        if (allowedIds.length > 0) {
          const hasMatch = context.testIds.some((t) => allowedIds.includes(t));
          if (!hasMatch) return { valid: false, error: "Coupon not applicable for selected tests" };
        }
      } catch {
        // ignore parse error
      }
    }

    // Calculate discount
    let discountAmt = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discountAmt = (context.orderAmount * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscountAmt) discountAmt = Math.min(discountAmt, Number(coupon.maxDiscountAmt));
    } else {
      discountAmt = Number(coupon.discountValue);
      discountAmt = Math.min(discountAmt, context.orderAmount);
    }

    discountAmt = Math.round(discountAmt * 100) / 100;

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
      },
      discountAmt,
      finalAmount: context.orderAmount - discountAmt,
    };
  }

  async applyCoupon(
    tenantId: string,
    couponId: string,
    orderId: string,
    patientId: string,
    patientPhone: string,
    discountAmt: number,
    orderTotal: number,
  ) {
    await this.prisma.couponUsage.create({
      data: { tenantId, couponId, orderId, patientId, patientPhone, discountAmt, orderTotal },
    });
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        usageCount: { increment: 1 },
        totalDiscountGiven: { increment: discountAmt },
        totalRevenueGenerated: { increment: orderTotal },
      },
    });
  }
}

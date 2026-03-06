import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  OrderStatus,
  ResultInterpretation,
  Role,
} from "@delvion/types";

interface ResultInput {
  orderItemId: string;
  value: string;
  unit?: string;
  parameterName?: string;
}

interface ReferenceRangeData {
  lowNormal: number | null;
  highNormal: number | null;
  lowCritical: number | null;
  highCritical: number | null;
}

@Injectable()
export class ResultEntryService {
  private readonly logger = new Logger(ResultEntryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Interpret a numeric value against reference ranges.
   */
  private interpretResult(
    numericValue: number,
    ref: ReferenceRangeData,
  ): ResultInterpretation {
    if (
      (ref.lowCritical !== null && numericValue < ref.lowCritical) ||
      (ref.highCritical !== null && numericValue > ref.highCritical)
    ) {
      return ResultInterpretation.CRITICAL;
    }
    if (
      (ref.lowNormal !== null && numericValue < ref.lowNormal) ||
      (ref.highNormal !== null && numericValue > ref.highNormal)
    ) {
      return ResultInterpretation.ABNORMAL;
    }
    return ResultInterpretation.NORMAL;
  }

  /**
   * Determine the flag string for a result.
   */
  private getFlag(
    numericValue: number,
    ref: ReferenceRangeData,
  ): "L" | "H" | "LL" | "HH" | null {
    if (ref.lowCritical !== null && numericValue < ref.lowCritical) return "LL";
    if (ref.highCritical !== null && numericValue > ref.highCritical) return "HH";
    if (ref.lowNormal !== null && numericValue < ref.lowNormal) return "L";
    if (ref.highNormal !== null && numericValue > ref.highNormal) return "H";
    return null;
  }

  /**
   * Find the best matching reference range for a test+gender+age.
   */
  private async findReferenceRange(
    testCatalogId: string,
    gender: string,
    ageYears: number,
    tenantId: string,
  ) {
    const candidates = await this.prisma.referenceRange.findMany({
      where: { tenantId, testCatalogId },
    });

    // Priority: gender+age > gender only > universal
    const match =
      candidates.find(
        (r) =>
          r.genderFilter === gender &&
          (r.ageMinYears === null || ageYears >= r.ageMinYears) &&
          (r.ageMaxYears === null || ageYears <= r.ageMaxYears),
      ) ??
      candidates.find(
        (r) =>
          r.genderFilter === null &&
          (r.ageMinYears === null || ageYears >= r.ageMinYears) &&
          (r.ageMaxYears === null || ageYears <= r.ageMaxYears),
      ) ??
      candidates[0] ??
      null;

    return match;
  }

  /**
   * Get full result entry context for an order.
   */
  async getResultEntry(orderId: string, tenantId: string) {
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
          },
        },
        items: {
          include: {
            testCatalog: {
              include: {
                referenceRanges: true,
              },
            },
            testResults: {
              orderBy: { createdAt: "desc" },
              include: {
                enteredBy: { select: { firstName: true, lastName: true } },
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
            vacutainerType: true,
            isStatSample: true,
          },
        },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Calculate patient age
    const patientAge = Math.floor(
      (Date.now() - new Date(order.patient.dob).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25),
    );
    const patientGender = order.patient.gender.toUpperCase();

    // For each test item, find the best matching reference range and previous results
    const enrichedItems = await Promise.all(
      order.items.map(async (item) => {
        const refRange = await this.findReferenceRange(
          item.testCatalogId,
          patientGender,
          patientAge,
          tenantId,
        );

        // Fetch last 3 previous results for this patient+test for comparison
        const previousResults = await this.prisma.testResult.findMany({
          where: {
            tenantId,
            orderItem: { testCatalogId: item.testCatalogId },
            order: { patientId: order.patient.id },
            orderId: { not: orderId },
            numericValue: { not: null },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            value: true,
            numericValue: true,
            unit: true,
            interpretation: true,
            createdAt: true,
            order: { select: { orderNumber: true } },
          },
        });

        return {
          ...item,
          matchedReferenceRange: refRange,
          previousResults,
        };
      }),
    );

    return {
      ...order,
      patientAge,
      items: enrichedItems,
    };
  }

  /**
   * Save draft results (does NOT change order status).
   */
  async saveResultDraft(
    orderId: string,
    results: ResultInput[],
    interpretation: string | null,
    userId: string,
    tenantId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: { select: { id: true, gender: true, dob: true } },
        samples: { select: { id: true }, take: 1 },
        items: {
          include: {
            testCatalog: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const patientAge = Math.floor(
      (Date.now() - new Date(order.patient.dob).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25),
    );
    const patientGender = order.patient.gender.toUpperCase();
    const sampleId = order.samples[0]?.id;

    if (!sampleId) {
      throw new BadRequestException("No sample found for this order");
    }

    const abnormal: string[] = [];
    const critical: string[] = [];
    let saved = 0;

    for (const result of results) {
      const item = order.items.find((i) => i.id === result.orderItemId);
      if (!item) continue;

      const refRange = await this.findReferenceRange(
        item.testCatalogId,
        patientGender,
        patientAge,
        tenantId,
      );

      const numericValue = parseFloat(result.value);
      const isNumeric = !isNaN(numericValue);

      let interp = ResultInterpretation.NORMAL;
      let flags: string | null = null;
      if (isNumeric && refRange) {
        interp = this.interpretResult(numericValue, {
          lowNormal: refRange.lowNormal,
          highNormal: refRange.highNormal,
          lowCritical: refRange.lowCritical,
          highCritical: refRange.highCritical,
        });
        flags = this.getFlag(numericValue, {
          lowNormal: refRange.lowNormal,
          highNormal: refRange.highNormal,
          lowCritical: refRange.lowCritical,
          highCritical: refRange.highCritical,
        });
      }

      // If explicit interpretation provided, use it
      const finalInterp = interpretation
        ? (interpretation as ResultInterpretation)
        : interp;

      const refRangeStr = refRange
        ? `${refRange.lowNormal ?? ""} - ${refRange.highNormal ?? ""} ${refRange.unit ?? ""}`.trim()
        : undefined;

      // Check delta against previous results
      let deltaFlagged = false;
      let deltaPercent: number | undefined;
      let previousValue: number | undefined;
      if (isNumeric) {
        const prev = await this.prisma.testResult.findFirst({
          where: {
            tenantId,
            orderItem: { testCatalogId: item.testCatalogId },
            order: { patientId: order.patient.id },
            orderId: { not: orderId },
            numericValue: { not: null },
          },
          orderBy: { createdAt: "desc" },
          select: { numericValue: true },
        });

        if (prev?.numericValue) {
          deltaPercent =
            Math.abs((numericValue - prev.numericValue) / prev.numericValue) *
            100;
          deltaFlagged = deltaPercent > 25;
          previousValue = prev.numericValue;
        }
      }

      // Upsert: if a draft result already exists for this orderItem, update it
      const existingResult = await this.prisma.testResult.findFirst({
        where: {
          tenantId,
          orderId,
          orderItemId: result.orderItemId,
          isDraft: true,
        },
      });

      if (existingResult) {
        await this.prisma.testResult.update({
          where: { id: existingResult.id },
          data: {
            value: result.value,
            numericValue: isNumeric ? numericValue : null,
            unit: result.unit ?? refRange?.unit ?? undefined,
            referenceRange: refRangeStr,
            interpretation: finalInterp,
            flags,
            isDraft: true,
            deltaFlagged,
            deltaPercent: deltaPercent ?? undefined,
            previousValue: previousValue ?? undefined,
            enteredById: userId,
          },
        });
      } else {
        await this.prisma.testResult.create({
          data: {
            tenantId,
            orderId,
            orderItemId: result.orderItemId,
            sampleId,
            value: result.value,
            numericValue: isNumeric ? numericValue : null,
            unit: result.unit ?? refRange?.unit ?? undefined,
            referenceRange: refRangeStr,
            interpretation: finalInterp,
            flags,
            isDraft: true,
            deltaFlagged,
            deltaPercent: deltaPercent ?? undefined,
            previousValue: previousValue ?? undefined,
            enteredById: userId,
          },
        });
      }

      saved++;

      if (finalInterp === ResultInterpretation.CRITICAL) {
        critical.push(item.testCatalog.name);
      } else if (finalInterp === ResultInterpretation.ABNORMAL) {
        abnormal.push(item.testCatalog.name);
      }
    }

    return { saved, abnormal, critical };
  }

  /**
   * Submit results for approval — finalises results and transitions order.
   */
  async submitResults(
    orderId: string,
    results: ResultInput[],
    interpretation: string | null,
    userId: string,
    tenantId: string,
  ) {
    // Save results first (same logic as draft but isDraft=false)
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            dob: true,
          },
        },
        samples: { select: { id: true }, take: 1 },
        items: {
          include: {
            testCatalog: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const patientAge = Math.floor(
      (Date.now() - new Date(order.patient.dob).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25),
    );
    const patientGender = order.patient.gender.toUpperCase();
    const sampleId = order.samples[0]?.id;

    if (!sampleId) {
      throw new BadRequestException("No sample found for this order");
    }

    const abnormal: string[] = [];
    const critical: string[] = [];

    for (const result of results) {
      const item = order.items.find((i) => i.id === result.orderItemId);
      if (!item) continue;

      const refRange = await this.findReferenceRange(
        item.testCatalogId,
        patientGender,
        patientAge,
        tenantId,
      );

      const numericValue = parseFloat(result.value);
      const isNumeric = !isNaN(numericValue);

      let interp = ResultInterpretation.NORMAL;
      let flags: string | null = null;
      if (isNumeric && refRange) {
        interp = this.interpretResult(numericValue, {
          lowNormal: refRange.lowNormal,
          highNormal: refRange.highNormal,
          lowCritical: refRange.lowCritical,
          highCritical: refRange.highCritical,
        });
        flags = this.getFlag(numericValue, {
          lowNormal: refRange.lowNormal,
          highNormal: refRange.highNormal,
          lowCritical: refRange.lowCritical,
          highCritical: refRange.highCritical,
        });
      }

      const finalInterp = interpretation
        ? (interpretation as ResultInterpretation)
        : interp;

      const refRangeStr = refRange
        ? `${refRange.lowNormal ?? ""} - ${refRange.highNormal ?? ""} ${refRange.unit ?? ""}`.trim()
        : undefined;

      // Delta check
      let deltaFlagged = false;
      let deltaPercent: number | undefined;
      let previousValue: number | undefined;
      if (isNumeric) {
        const prev = await this.prisma.testResult.findFirst({
          where: {
            tenantId,
            orderItem: { testCatalogId: item.testCatalogId },
            order: { patientId: order.patient.id },
            orderId: { not: orderId },
            numericValue: { not: null },
          },
          orderBy: { createdAt: "desc" },
          select: { numericValue: true },
        });

        if (prev?.numericValue) {
          deltaPercent =
            Math.abs((numericValue - prev.numericValue) / prev.numericValue) *
            100;
          deltaFlagged = deltaPercent > 25;
          previousValue = prev.numericValue;
        }
      }

      // Upsert: update existing draft or create new
      const existingResult = await this.prisma.testResult.findFirst({
        where: {
          tenantId,
          orderId,
          orderItemId: result.orderItemId,
        },
      });

      if (existingResult) {
        await this.prisma.testResult.update({
          where: { id: existingResult.id },
          data: {
            value: result.value,
            numericValue: isNumeric ? numericValue : null,
            unit: result.unit ?? refRange?.unit ?? undefined,
            referenceRange: refRangeStr,
            interpretation: finalInterp,
            flags,
            isDraft: false,
            deltaFlagged,
            deltaPercent: deltaPercent ?? undefined,
            previousValue: previousValue ?? undefined,
            enteredById: userId,
          },
        });
      } else {
        await this.prisma.testResult.create({
          data: {
            tenantId,
            orderId,
            orderItemId: result.orderItemId,
            sampleId,
            value: result.value,
            numericValue: isNumeric ? numericValue : null,
            unit: result.unit ?? refRange?.unit ?? undefined,
            referenceRange: refRangeStr,
            interpretation: finalInterp,
            flags,
            isDraft: false,
            deltaFlagged,
            deltaPercent: deltaPercent ?? undefined,
            previousValue: previousValue ?? undefined,
            enteredById: userId,
          },
        });
      }

      if (finalInterp === ResultInterpretation.CRITICAL) {
        critical.push(item.testCatalog.name);
      } else if (finalInterp === ResultInterpretation.ABNORMAL) {
        abnormal.push(item.testCatalog.name);
      }
    }

    // Update order status to PENDING_APPROVAL
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PENDING_APPROVAL,
        resultSubmittedAt: new Date(),
      },
    });

    // If critical values found, notify pathologists
    if (critical.length > 0) {
      await this.notifications.sendToRole(tenantId, Role.PATHOLOGIST, {
        title: "Critical Results Require Approval",
        body: `Order ${order.orderNumber} — Patient ${order.patient.firstName} ${order.patient.lastName} has CRITICAL results for: ${critical.join(", ")}`,
        type: "CRITICAL_RESULT",
        entityId: orderId,
        entityType: "Order",
      });
    }

    return { submitted: true, critical, abnormal };
  }

  /**
   * Validate a single result value against reference ranges.
   */
  async validateResult(
    testCatalogId: string,
    value: string,
    patientAge: number,
    patientGender: string,
    tenantId: string,
  ) {
    const refRange = await this.findReferenceRange(
      testCatalogId,
      patientGender.toUpperCase(),
      patientAge,
      tenantId,
    );

    if (!refRange) {
      return {
        isAbnormal: false,
        isCritical: false,
        flag: null,
        referenceRange: "N/A",
      };
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      return {
        isAbnormal: false,
        isCritical: false,
        flag: null,
        referenceRange: `${refRange.lowNormal ?? ""} - ${refRange.highNormal ?? ""} ${refRange.unit ?? ""}`.trim(),
      };
    }

    const interp = this.interpretResult(numericValue, {
      lowNormal: refRange.lowNormal,
      highNormal: refRange.highNormal,
      lowCritical: refRange.lowCritical,
      highCritical: refRange.highCritical,
    });

    const flag = this.getFlag(numericValue, {
      lowNormal: refRange.lowNormal,
      highNormal: refRange.highNormal,
      lowCritical: refRange.lowCritical,
      highCritical: refRange.highCritical,
    });

    return {
      isAbnormal: interp === ResultInterpretation.ABNORMAL || interp === ResultInterpretation.CRITICAL,
      isCritical: interp === ResultInterpretation.CRITICAL,
      flag,
      referenceRange: `${refRange.lowNormal ?? ""} - ${refRange.highNormal ?? ""} ${refRange.unit ?? ""}`.trim(),
    };
  }

  /**
   * Sign a single test result (by pathologist/doctor).
   */
  async signResult(resultId: string, tenantId: string, signedById: string) {
    const result = await this.prisma.testResult.findFirst({
      where: { id: resultId, tenantId },
      select: { id: true, isDraft: true, orderId: true },
    });
    if (!result) throw new NotFoundException("Result not found");
    if (result.isDraft) throw new BadRequestException("Cannot sign a draft result — submit first");

    return this.prisma.testResult.update({
      where: { id: resultId },
      data: {
        signedById,
        signedAt: new Date(),
        validatedById: signedById,
        validatedAt: new Date(),
      },
    });
  }

  /**
   * Compute flag from a numeric value + reference range string.
   * Expected format: "0.35 - 4.94" or "< 5.0"
   */
  computeFlag(value: number, refRange: string): string {
    try {
      const rangeMatch = refRange.match(/(\d+\.?\d*)\s*[-\u2013]\s*(\d+\.?\d*)/);
      if (rangeMatch?.[1] && rangeMatch[2]) {
        const low = parseFloat(rangeMatch[1]);
        const high = parseFloat(rangeMatch[2]);
        if (value < low) return value < low * 0.7 ? "CRITICAL_LOW" : "LOW";
        if (value > high) return value > high * 1.3 ? "CRITICAL_HIGH" : "HIGH";
        return "NORMAL";
      }
      return "NORMAL";
    } catch {
      return "NORMAL";
    }
  }
}

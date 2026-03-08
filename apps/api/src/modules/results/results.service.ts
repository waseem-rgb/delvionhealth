import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateResultDto } from "./dto/create-result.dto";
import type { BulkCreateResultsDto } from "./dto/bulk-create-results.dto";
import type { VerifyResultDto } from "./dto/verify-result.dto";
import type { ValidateResultDto } from "./dto/validate-result.dto";
import { ResultInterpretation, OrderStatus, Role } from "@delvion/types";

interface ReferenceRangeData {
  lowNormal: number | null;
  highNormal: number | null;
  lowCritical: number | null;
  highCritical: number | null;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService
  ) {}

  private interpretResult(
    numericValue: number,
    ref: ReferenceRangeData
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

  private async checkDelta(
    patientId: string,
    testCatalogId: string,
    newValue: number,
    tenantId: string,
    currentResultId?: string
  ): Promise<{ deltaFlagged: boolean; deltaPercent: number | null; previousValue: number | null }> {
    const previous = await this.prisma.testResult.findFirst({
      where: {
        tenantId,
        ...(currentResultId && { NOT: { id: currentResultId } }),
        numericValue: { not: null },
        orderItem: { testCatalogId },
        order: { patientId },
      },
      orderBy: { createdAt: "desc" },
      select: { numericValue: true },
    });

    if (!previous?.numericValue) {
      return { deltaFlagged: false, deltaPercent: null, previousValue: null };
    }

    const prev = previous.numericValue;
    const deltaPercent = Math.abs((newValue - prev) / prev) * 100;
    return {
      deltaFlagged: deltaPercent > 25,
      deltaPercent,
      previousValue: prev,
    };
  }

  private async findReferenceRange(
    testCatalogId: string,
    gender: string,
    ageYears: number,
    tenantId: string
  ) {
    // Try gender + age specific first
    const candidates = await this.prisma.referenceRange.findMany({
      where: { tenantId, testCatalogId },
    });

    // Priority: gender+age > gender > universal
    const match =
      candidates.find(
        (r) =>
          (r.genderFilter === gender || r.genderFilter === null) &&
          (r.ageMinYears === null || ageYears >= r.ageMinYears) &&
          (r.ageMaxYears === null || ageYears <= r.ageMaxYears) &&
          r.genderFilter === gender
      ) ??
      candidates.find(
        (r) =>
          r.genderFilter === null &&
          (r.ageMinYears === null || ageYears >= r.ageMinYears) &&
          (r.ageMaxYears === null || ageYears <= r.ageMaxYears)
      ) ??
      candidates[0] ??
      null;

    return match;
  }

  async create(dto: CreateResultDto, tenantId: string, userId: string) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: dto.orderItemId },
      include: {
        order: {
          include: { patient: true },
        },
        testCatalog: { select: { id: true, name: true } },
      },
    });

    if (!orderItem || orderItem.order.tenantId !== tenantId) {
      throw new NotFoundException("Order item not found");
    }

    const patient = orderItem.order.patient;
    const ageYears = Math.floor(
      (Date.now() - new Date(patient.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );

    // Resolve reference range
    const refRange = await this.findReferenceRange(
      orderItem.testCatalogId,
      patient.gender.toUpperCase(),
      ageYears,
      tenantId
    );

    // Parse numeric value
    const numericValue = dto.numericValue ?? parseFloat(dto.value);
    const isNumeric = !isNaN(numericValue);

    // Compute interpretation
    let interpretation: ResultInterpretation = ResultInterpretation.NORMAL;
    if (isNumeric && refRange) {
      interpretation = this.interpretResult(numericValue, {
        lowNormal: refRange.lowNormal,
        highNormal: refRange.highNormal,
        lowCritical: refRange.lowCritical,
        highCritical: refRange.highCritical,
      });
    }

    // Delta check
    const delta = isNumeric
      ? await this.checkDelta(
          patient.id,
          orderItem.testCatalogId,
          numericValue,
          tenantId
        )
      : { deltaFlagged: false, deltaPercent: null, previousValue: null };

    // Build reference range string for legacy field
    const refRangeStr = refRange
      ? `${refRange.lowNormal ?? ""} - ${refRange.highNormal ?? ""} ${refRange.unit ?? ""}`.trim()
      : undefined;

    const result = await this.prisma.testResult.create({
      data: {
        tenantId,
        orderId: orderItem.orderId,
        orderItemId: dto.orderItemId,
        sampleId: dto.sampleId,
        value: dto.value,
        numericValue: isNumeric ? numericValue : undefined,
        unit: dto.unit ?? refRange?.unit ?? undefined,
        referenceRange: refRangeStr,
        interpretation,
        isDraft: dto.isDraft ?? true,
        deltaFlagged: delta.deltaFlagged,
        deltaPercent: delta.deltaPercent ?? undefined,
        previousValue: delta.previousValue ?? undefined,
        enteredById: userId,
      },
      include: {
        orderItem: { include: { testCatalog: { select: { name: true, code: true } } } },
        sample: { select: { barcodeId: true } },
        enteredBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Alert on CRITICAL interpretation
    if (interpretation === ResultInterpretation.CRITICAL) {
      this.realtime.emitCriticalAlert(tenantId, {
        message: `CRITICAL result for ${orderItem.testCatalog.name}: ${dto.value} ${dto.unit ?? ""}`,
        orderId: orderItem.orderId,
        patientName: `${patient.firstName} ${patient.lastName}`,
      });
      await this.notifications.sendToRole(tenantId, Role.LAB_MANAGER, {
        title: "CRITICAL Result Alert",
        body: `${orderItem.testCatalog.name}: ${dto.value} — Patient ${patient.firstName} ${patient.lastName}`,
        type: "CRITICAL_RESULT",
        entityId: result.id,
        entityType: "TestResult",
      });
    }

    return result;
  }

  async bulkCreate(dto: BulkCreateResultsDto, tenantId: string, userId: string) {
    return Promise.all(dto.results.map((r) => this.create(r, tenantId, userId)));
  }

  async verify(dto: VerifyResultDto, tenantId: string, userId: string) {
    const now = new Date();

    await this.prisma.testResult.updateMany({
      where: { id: { in: dto.ids }, tenantId },
      data: {
        verifiedById: userId,
        verifiedAt: now,
        isDraft: false,
        autoVerified: false,
      },
    });

    // Check each affected order — if all items verified, update order status
    const affectedResults = await this.prisma.testResult.findMany({
      where: { id: { in: dto.ids }, tenantId },
      select: { orderId: true },
    });

    const orderIds = [...new Set(affectedResults.map((r) => r.orderId))];
    for (const orderId of orderIds) {
      await this.checkAndUpdateOrderResult(orderId, tenantId);
    }

    return { verified: dto.ids.length };
  }

  async validate(dto: ValidateResultDto, tenantId: string, userId: string) {
    const now = new Date();

    await this.prisma.testResult.updateMany({
      where: { id: { in: dto.ids }, tenantId },
      data: {
        validatedById: userId,
        validatedAt: now,
        signedById: userId,
        signedAt: now,
        pathologistNotes: dto.pathologistNotes,
        isDraft: false,
      },
    });

    // Transition affected orders to PENDING_APPROVAL if all results validated
    const affectedResults = await this.prisma.testResult.findMany({
      where: { id: { in: dto.ids }, tenantId },
      select: { orderId: true },
    });
    const orderIds = [...new Set(affectedResults.map((r) => r.orderId))];

    for (const orderId of orderIds) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          items: {
            include: {
              testResults: { select: { validatedById: true } },
            },
          },
        },
      });
      if (!order) continue;

      const allValidated = order.items.every((item) =>
        item.testResults.length > 0 &&
        item.testResults.every((r) => r.validatedById !== null),
      );

      if (allValidated) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PENDING_APPROVAL,
            resultSubmittedAt: now,
          },
        });

        this.realtime.emitOrderUpdate(tenantId, {
          orderId,
          orderNumber: order.orderNumber,
          status: OrderStatus.PENDING_APPROVAL,
        });
      }
    }

    // SMS for any CRITICAL results being validated
    this.prisma.testResult.findMany({
      where: { id: { in: dto.ids }, tenantId, interpretation: ResultInterpretation.CRITICAL },
      select: {
        value: true,
        orderItem: { include: { testCatalog: { select: { name: true } } } },
        order: { include: { patient: { select: { phone: true } } } },
      },
    }).then(criticals => {
      for (const r of criticals) {
        const phone = r.order.patient?.phone;
        if (phone) {
          const testName = r.orderItem.testCatalog.name;
          this.notifications.sendSMS(
            phone,
            `URGENT - DELViON: Critical result for ${testName}. Please contact your doctor immediately. Value: ${r.value}.`,
          ).catch(() => {});
        }
      }
    }).catch(() => {});

    return { validated: dto.ids.length };
  }

  private async checkAndUpdateOrderResult(orderId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          include: {
            testResults: { select: { verifiedById: true, autoVerified: true } },
          },
        },
      },
    });

    if (!order) return;

    // All items must have at least one verified result
    const allVerified = order.items.every((item) =>
      item.testResults.some((r) => r.verifiedById !== null || r.autoVerified)
    );

    if (allVerified && order.status === OrderStatus.IN_PROCESSING) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.RESULTED },
      });

      this.realtime.emitOrderUpdate(tenantId, {
        orderId,
        orderNumber: order.orderNumber,
        status: OrderStatus.RESULTED,
      });
    }
  }

  async getPendingResults(tenantId: string, branchId?: string) {
    const where: Record<string, unknown> = {
      tenantId,
      OR: [{ isDraft: true }, { verifiedById: null, autoVerified: false }],
      ...(branchId && { order: { branchId } }),
    };

    const results = await this.prisma.testResult.findMany({
      where,
      orderBy: [{ interpretation: "asc" }, { createdAt: "asc" }],
      include: {
        orderItem: {
          include: {
            testCatalog: { select: { name: true, code: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            priority: true,
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
        sample: { select: { barcodeId: true } },
        enteredBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Sort: CRITICAL first, then by priority
    const interpOrder: Record<string, number> = { CRITICAL: 0, ABNORMAL: 1, NORMAL: 2, INCONCLUSIVE: 3 };
    const priorityOrder: Record<string, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };
    return results.sort(
      (a, b) =>
        (interpOrder[a.interpretation] ?? 2) - (interpOrder[b.interpretation] ?? 2) ||
        (priorityOrder[a.order?.priority ?? "ROUTINE"] ?? 2) -
          (priorityOrder[b.order?.priority ?? "ROUTINE"] ?? 2)
    );
  }

  async getResultsByOrder(orderId: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          include: {
            testCatalog: {
              select: {
                id: true,
                name: true,
                code: true,
                loincCode: true,
                reportParameters: {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true,
                    name: true,
                    fieldType: true,
                    unit: true,
                    sortOrder: true,
                    options: true,
                    referenceRanges: {
                      select: {
                        lowNormal: true,
                        highNormal: true,
                        lowCritical: true,
                        highCritical: true,
                        unit: true,
                        genderFilter: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        samples: { select: { id: true, barcodeId: true }, take: 1 },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    // Fetch existing results
    const existingResults = await this.prisma.testResult.findMany({
      where: { orderId, tenantId },
      include: {
        orderItem: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true, loincCode: true } },
          },
        },
        sample: { select: { barcodeId: true, type: true } },
        enteredBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // For each order item with reportParameters, ensure we have one TestResult per parameter
    const sampleId = order.samples[0]?.id;
    if (!sampleId) return existingResults;

    const resultsByItemId = new Map<string, typeof existingResults>();
    for (const r of existingResults) {
      const arr = resultsByItemId.get(r.orderItemId) ?? [];
      arr.push(r);
      resultsByItemId.set(r.orderItemId, arr);
    }

    let needsRefetch = false;

    for (const item of order.items) {
      const params = item.testCatalog.reportParameters;
      if (params.length === 0) continue;

      const itemResults = resultsByItemId.get(item.id) ?? [];
      if (itemResults.length >= params.length) continue;

      // Create missing TestResult records for parameters not yet entered
      const existingFlags = new Set(itemResults.map((r) => r.flags ?? r.value));
      for (const param of params) {
        // Check if a result for this parameter already exists (by matching flags field)
        const alreadyExists = itemResults.some((r) => r.flags === param.name);
        if (alreadyExists) continue;
        // Also skip if we already have enough results
        if (itemResults.length >= params.length) break;

        // Build reference range string from the parameter's first reference range
        const rr = param.referenceRanges[0];
        const refRangeStr = rr
          ? `${rr.lowNormal ?? ""} - ${rr.highNormal ?? ""} ${rr.unit ?? param.unit ?? ""}`.trim()
          : undefined;

        await this.prisma.testResult.create({
          data: {
            tenantId,
            orderId,
            orderItemId: item.id,
            sampleId,
            value: "",
            unit: param.unit ?? rr?.unit ?? undefined,
            referenceRange: refRangeStr || undefined,
            interpretation: "NORMAL" as never,
            isDraft: true,
            flags: param.name,
            enteredById: null,
          },
        });
        needsRefetch = true;
      }
    }

    if (!needsRefetch) return existingResults;

    // Refetch to include newly created results
    return this.prisma.testResult.findMany({
      where: { orderId, tenantId },
      include: {
        orderItem: {
          include: {
            testCatalog: { select: { id: true, name: true, code: true, loincCode: true } },
          },
        },
        sample: { select: { barcodeId: true, type: true } },
        enteredBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ orderItemId: "asc" }, { createdAt: "asc" }],
    });
  }

  async getPatientResultHistory(
    patientId: string,
    testCatalogId: string,
    tenantId: string,
    limit = 10
  ) {
    return this.prisma.testResult.findMany({
      where: {
        tenantId,
        orderItem: { testCatalogId },
        order: { patientId },
        numericValue: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
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
  }

  async saveDraftValues(
    updates: Array<{ id: string; value: string; numericValue: number | null }>,
    tenantId: string,
    userId: string,
  ) {
    let saved = 0;
    for (const u of updates) {
      const existing = await this.prisma.testResult.findFirst({
        where: { id: u.id, tenantId },
        select: { id: true, verifiedById: true, autoVerified: true },
      });
      if (!existing) continue;
      // Don't overwrite verified results
      if (existing.verifiedById || existing.autoVerified) continue;

      await this.prisma.testResult.update({
        where: { id: u.id },
        data: {
          value: u.value,
          numericValue: u.numericValue,
          isDraft: true,
          enteredById: userId,
        },
      });
      saved++;
    }
    return { saved };
  }

  async findOne(tenantId: string, id: string) {
    const result = await this.prisma.testResult.findFirst({
      where: { id, tenantId },
      include: {
        orderItem: {
          include: { testCatalog: true },
        },
        sample: { select: { barcodeId: true, type: true } },
        enteredBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!result) throw new NotFoundException(`Result ${id} not found`);
    return result;
  }
}

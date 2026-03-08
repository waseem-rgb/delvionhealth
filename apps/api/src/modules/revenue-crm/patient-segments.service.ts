import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PatientSegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all patient segments for a tenant.
   */
  async findAll(tenantId: string) {
    return this.prisma.patientSegment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Single segment by id.
   */
  async findOne(tenantId: string, id: string) {
    const segment = await this.prisma.patientSegment.findFirst({
      where: { id, tenantId },
    });

    if (!segment) {
      throw new NotFoundException(`Patient segment ${id} not found`);
    }

    return segment;
  }

  /**
   * Create a new patient segment.
   */
  async create(
    tenantId: string,
    dto: Record<string, unknown>,
    userId: string,
  ) {
    const data = { ...dto };

    // Stringify filterRules if passed as object
    if (data.filterRules && typeof data.filterRules === "object") {
      data.filterRules = JSON.stringify(data.filterRules);
    }

    return this.prisma.patientSegment.create({
      data: {
        tenantId,
        createdById: userId,
        ...data,
      } as never,
    });
  }

  /**
   * Get patients for a segment (placeholder — actual query engine can be added later).
   */
  async getPatients(
    tenantId: string,
    segmentId: string,
    query: { page?: number; limit?: number },
  ) {
    const segment = await this.prisma.patientSegment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new NotFoundException(`Patient segment ${segmentId} not found`);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    return {
      segment,
      data: [] as unknown[],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }

  /**
   * Refresh estimated counts for all segments (placeholder).
   */
  async refreshCounts(tenantId: string) {
    await this.prisma.patientSegment.updateMany({
      where: { tenantId },
      data: {
        estimatedCount: 0,
        lastCountedAt: new Date(),
      } as never,
    });

    return { message: "Segment counts refreshed." };
  }
}

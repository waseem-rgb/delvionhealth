import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatePatientDto } from "./dto/create-patient.dto";
import type { UpdatePatientDto } from "./dto/update-patient.dto";
import type { QueryPatientDto } from "./dto/query-patient.dto";
import type { PaginationMeta } from "@delvion/types";
import { OrderStatus } from "@delvion/types";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function calcAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// ─────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  age: number;
  dob: Date;
  gender: string;
  phone: string;
  email: string | null;
  address: string | null;
  createdAt: Date;
  orderCount: number;
  branch: { id: string; name: string } | null;
}

export interface PatientStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSpend: number;
  lastVisitDate: Date | null;
  mostRequestedTest: string | null;
}

export interface TimelineEvent {
  date: Date;
  type: "order_created" | "order_status" | "sample" | "result" | "report";
  description: string;
  entityId: string;
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────
  // MRN generation  →  DH-YYYY-XXXXXX
  // Uses a transaction to prevent duplicates
  // ───────────────────────────────────────────

  async previewMrn(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DH-${year}-`;
    const count = await this.prisma.patient.count({
      where: { tenantId, mrn: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(6, "0")}`;
  }

  private async generateMrn(
    tenantId: string,
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0]
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DH-${year}-`;
    const count = await tx.patient.count({
      where: { tenantId, mrn: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(6, "0")}`;
  }

  // ───────────────────────────────────────────
  // Create
  // ───────────────────────────────────────────

  async create(tenantId: string, dto: CreatePatientDto) {
    // Resolve branch — use provided branchId or fall back to first tenant branch
    let branchId = dto.branchId ?? "";
    if (branchId) {
      const branch = await this.prisma.tenantBranch.findFirst({
        where: { id: branchId, tenantId },
      });
      if (!branch) throw new NotFoundException("Branch not found in tenant");
    }
    if (!branchId) {
      const defaultBranch = await this.prisma.tenantBranch.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
      });
      if (!defaultBranch) throw new NotFoundException("No branch found for tenant");
      branchId = defaultBranch.id;
    }

    // Duplicate phone check — return existing patient instead of blocking
    const phoneExists = await this.prisma.patient.findFirst({
      where: { tenantId, phone: dto.phone, isActive: true },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
    });
    if (phoneExists) {
      // Return existing patient with _isReturning flag instead of throwing
      return {
        ...phoneExists,
        fullName: `${phoneExists.firstName} ${phoneExists.lastName || ""}`.trim(),
        age: phoneExists.dob
          ? Math.floor(
              (Date.now() - new Date(phoneExists.dob).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null,
        orderCount: phoneExists._count?.orders ?? 0,
        _isReturning: true,
        _message: `Returning patient: ${phoneExists.firstName} ${phoneExists.lastName || ""} (MRN: ${phoneExists.mrn})`,
      };
    }

    // Duplicate email check — warn but don't block
    if (dto.email) {
      const emailExists = await this.prisma.patient.findFirst({
        where: { tenantId, email: dto.email, isActive: true },
      });
      if (emailExists) {
        // Don't throw — just log; email duplicates are less critical than phone
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const mrn = await this.generateMrn(tenantId, tx);
      return tx.patient.create({
        data: {
          tenantId,
          mrn,
          firstName: dto.firstName,
          lastName: dto.lastName || "",
          dob: dto.dob ? new Date(dto.dob) : new Date(),
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          designation: dto.designation,
          patientType: dto.patientType,
          notes: dto.notes,
          insuranceId: dto.insuranceId,
          referringDoctorId: dto.referringDoctorId,
          branchId,
        },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });
    });
  }

  // ───────────────────────────────────────────
  // List
  // ───────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: QueryPatientDto
  ): Promise<{ data: PatientListItem[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Handle special status filters
    if (query.status === "duplicates") {
      return this.findDuplicates(tenantId, query, page, limit, skip);
    }

    const isInactive = query.status === "inactive";

    const where = {
      tenantId,
      ...(isInactive
        ? {
            OR: [
              { isActive: false },
              {
                isActive: true,
                orders: { none: { createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } },
              },
            ],
          }
        : { isActive: query.isActive ?? true }),
      ...(query.gender && { gender: query.gender as string }),
      ...(query.branchId && { branchId: query.branchId }),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { phone: { contains: query.search } },
              { mrn: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          mrn: true,
          firstName: true,
          lastName: true,
          dob: true,
          gender: true,
          phone: true,
          email: true,
          address: true,
          createdAt: true,
          branch: { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const data: PatientListItem[] = patients.map((p) => ({
      id: p.id,
      mrn: p.mrn,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: `${p.firstName} ${p.lastName}`,
      initials: `${p.firstName[0]}${p.lastName[0]}`.toUpperCase(),
      age: calcAge(p.dob),
      dob: p.dob,
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      address: p.address,
      createdAt: p.createdAt,
      orderCount: p._count.orders,
      branch: p.branch,
    }));

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
  // Duplicates (patients sharing name+phone)
  // ───────────────────────────────────────────

  private async findDuplicates(
    tenantId: string,
    query: QueryPatientDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ data: PatientListItem[]; meta: PaginationMeta }> {
    // Find duplicate groups by (firstName, lastName, phone)
    const dupGroups: { firstName: string; lastName: string; phone: string }[] =
      await this.prisma.$queryRaw`
        SELECT "firstName", "lastName", phone
        FROM patients
        WHERE "tenantId" = ${tenantId} AND "isActive" = true
        GROUP BY "firstName", "lastName", phone
        HAVING COUNT(*) > 1
      `;

    if (dupGroups.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const orConditions = dupGroups.map((g) => ({
      firstName: { equals: g.firstName, mode: "insensitive" as const },
      lastName: { equals: g.lastName, mode: "insensitive" as const },
      phone: g.phone,
    }));

    const where = {
      tenantId,
      isActive: true,
      OR: orConditions,
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { firstName: { contains: query.search, mode: "insensitive" as const } },
                  { lastName: { contains: query.search, mode: "insensitive" as const } },
                  { phone: { contains: query.search } },
                  { mrn: { contains: query.search, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    };

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { createdAt: "desc" }],
        select: {
          id: true, mrn: true, firstName: true, lastName: true,
          dob: true, gender: true, phone: true, email: true,
          address: true, createdAt: true,
          branch: { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const data: PatientListItem[] = patients.map((p) => ({
      id: p.id,
      mrn: p.mrn,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: `${p.firstName} ${p.lastName}`,
      initials: `${p.firstName[0]}${p.lastName[0]}`.toUpperCase(),
      age: calcAge(p.dob),
      dob: p.dob,
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      address: p.address,
      createdAt: p.createdAt,
      orderCount: p._count.orders,
      branch: p.branch,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ───────────────────────────────────────────
  // Search (lightweight, for CommandPalette)
  // ───────────────────────────────────────────

  async search(tenantId: string, q: string) {
    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { mrn: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        phone: true,
        dob: true,
        gender: true,
      },
    });

    return patients.map((p) => ({
      ...p,
      fullName: `${p.firstName} ${p.lastName}`,
      age: calcAge(p.dob),
    }));
  }

  // ───────────────────────────────────────────
  // Search by phone (Registration page)
  // ───────────────────────────────────────────

  async searchByPhone(tenantId: string, rawPhone: string) {
    // Clean phone: remove spaces, dashes, country code, keep last 10 digits
    const cleaned = rawPhone.replace(/[\s\-\+\(\)]/g, "").replace(/^91/, "").slice(-10);
    if (cleaned.length < 4) return [];

    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId,
        isActive: true,
        mergedIntoId: null,
        phone: { contains: cleaned },
      },
      take: 15,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        phone: true,
        dob: true,
        gender: true,
        email: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        designation: true,
        patientType: true,
        createdAt: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true, orderNumber: true },
        },
        _count: { select: { orders: true } },
      },
    });

    return patients.map((p) => ({
      id: p.id,
      mrn: p.mrn,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: `${p.firstName} ${p.lastName}`,
      phone: p.phone,
      age: calcAge(p.dob),
      gender: p.gender,
      dob: p.dob,
      email: p.email,
      address: p.address,
      city: p.city,
      state: p.state,
      pincode: p.pincode,
      designation: p.designation,
      patientType: p.patientType,
      lastVisit: p.orders[0]?.createdAt ?? null,
      totalVisits: p._count.orders,
    }));
  }

  // ───────────────────────────────────────────
  // Find one
  // ───────────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        orders: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            netAmount: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
        },
      },
    });

    if (!patient) throw new NotFoundException(`Patient ${id} not found`);

    return {
      ...patient,
      fullName: `${patient.firstName} ${patient.lastName}`,
      initials: `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase(),
      age: calcAge(patient.dob),
    };
  }

  // ───────────────────────────────────────────
  // Find by MRN
  // ───────────────────────────────────────────

  async findByMrn(tenantId: string, mrn: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { tenantId, mrn },
      include: { branch: { select: { id: true, name: true } } },
    });
    if (!patient) throw new NotFoundException(`Patient with MRN ${mrn} not found`);
    return {
      ...patient,
      fullName: `${patient.firstName} ${patient.lastName}`,
      age: calcAge(patient.dob),
    };
  }

  // ───────────────────────────────────────────
  // Patient timeline
  // ───────────────────────────────────────────

  async getTimeline(tenantId: string, id: string): Promise<TimelineEvent[]> {
    await this.findOne(tenantId, id);

    const orders = await this.prisma.order.findMany({
      where: { tenantId, patientId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        samples: {
          select: { id: true, barcodeId: true, status: true, collectedAt: true },
        },
      },
    });

    const events: TimelineEvent[] = [];

    for (const order of orders) {
      events.push({
        date: order.createdAt,
        type: "order_created",
        description: `Order ${order.orderNumber} created`,
        entityId: order.id,
      });

      if (order.status !== OrderStatus.PENDING) {
        events.push({
          date: order.updatedAt,
          type: "order_status",
          description: `Order ${order.orderNumber} → ${order.status.replace(/_/g, " ")}`,
          entityId: order.id,
        });
      }

      for (const sample of order.samples) {
        if (sample.collectedAt) {
          events.push({
            date: sample.collectedAt,
            type: "sample",
            description: `Sample ${sample.barcodeId} collected`,
            entityId: sample.id,
          });
        }
      }
    }

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // ───────────────────────────────────────────
  // Patient stats
  // ───────────────────────────────────────────

  async getStats(tenantId: string, id: string): Promise<PatientStats> {
    await this.findOne(tenantId, id);

    const [totalOrders, completedOrders, pendingOrders, spendAgg, lastOrder, topTest] =
      await Promise.all([
        this.prisma.order.count({ where: { tenantId, patientId: id } }),
        this.prisma.order.count({
          where: { tenantId, patientId: id, status: OrderStatus.REPORTED },
        }),
        this.prisma.order.count({
          where: {
            tenantId,
            patientId: id,
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.SAMPLE_COLLECTED,
                OrderStatus.IN_PROCESSING,
                OrderStatus.RESULTED,
              ],
            },
          },
        }),
        this.prisma.order.aggregate({
          where: { tenantId, patientId: id },
          _sum: { netAmount: true },
        }),
        this.prisma.order.findFirst({
          where: { tenantId, patientId: id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        this.prisma.orderItem.groupBy({
          by: ["testCatalogId"],
          where: { order: { tenantId, patientId: id } },
          _count: { testCatalogId: true },
          orderBy: { _count: { testCatalogId: "desc" } },
          take: 1,
        }),
      ]);

    let mostRequestedTest: string | null = null;
    const firstTest = topTest[0];
    if (firstTest) {
      const catalog = await this.prisma.testCatalog.findUnique({
        where: { id: firstTest.testCatalogId },
        select: { name: true },
      });
      mostRequestedTest = catalog?.name ?? null;
    }

    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      totalSpend: Number(spendAgg._sum.netAmount ?? 0),
      lastVisitDate: lastOrder?.createdAt ?? null,
      mostRequestedTest,
    };
  }

  // ───────────────────────────────────────────
  // Patient orders (paginated)
  // ───────────────────────────────────────────

  async getPatientOrders(
    tenantId: string,
    id: string,
    page = 1,
    limit = 20
  ) {
    await this.findOne(tenantId, id);

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, patientId: id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { items: true } },
          branch: { select: { name: true } },
        },
      }),
      this.prisma.order.count({ where: { tenantId, patientId: id } }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ───────────────────────────────────────────
  // Update
  // ───────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdatePatientDto) {
    const patient = await this.findOne(tenantId, id);

    // Phone uniqueness excluding self
    if (dto.phone && dto.phone !== patient.phone) {
      const conflict = await this.prisma.patient.findFirst({
        where: { tenantId, phone: dto.phone, isActive: true, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(
          `Phone ${dto.phone} already used by patient ${conflict.mrn}`
        );
      }
    }

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.dob !== undefined && { dob: new Date(dto.dob) }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        ...(dto.designation !== undefined && { designation: dto.designation }),
        ...(dto.patientType !== undefined && { patientType: dto.patientType }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.insuranceId !== undefined && { insuranceId: dto.insuranceId }),
        ...(dto.referringDoctorId !== undefined && {
          referringDoctorId: dto.referringDoctorId,
        }),
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  // ───────────────────────────────────────────
  // Soft-delete
  // ───────────────────────────────────────────

  async softDelete(tenantId: string, id: string): Promise<void> {
    await this.findOne(tenantId, id);

    const activeOrders = await this.prisma.order.count({
      where: {
        tenantId,
        patientId: id,
        status: {
          notIn: [OrderStatus.CANCELLED, OrderStatus.REPORTED],
        },
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestException(
        `Cannot delete patient with ${activeOrders} active order(s)`
      );
    }

    await this.prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

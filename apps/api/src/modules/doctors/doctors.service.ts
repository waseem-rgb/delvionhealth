import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MinioService } from "../reports/minio.service";
import * as bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  // ─── List ─────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: { search?: string; isActive?: boolean },
  ) {
    const where: Prisma.DoctorWhereInput = { tenantId };

    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    return this.prisma.doctor.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  // ─── Find One ─────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id, tenantId },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    return doctor;
  }

  // ─── Create ───────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    data: {
      salutation?: string;
      firstName: string;
      lastName?: string;
      displayName?: string;
      phone?: string;
      alternateEmail?: string;
      email?: string;
      dob?: string;
      registrationNumber?: string;
      specialty?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      departments?: string[];
      isDefault?: boolean;
      showOnAppointment?: boolean;
      showOnlyAssigned?: boolean;
      notifySMS?: boolean;
      notifyEmail?: boolean;
      passkey?: string;
      language?: string;
      availability?: unknown;
    },
  ) {
    const name = [data.salutation || "Dr.", data.firstName, data.lastName]
      .filter(Boolean)
      .join(" ");

    let hashedPasskey: string | undefined;
    if (data.passkey) {
      hashedPasskey = await bcrypt.hash(data.passkey, 10);
    }

    return this.prisma.doctor.create({
      data: {
        tenantId,
        name,
        salutation: data.salutation || "Dr.",
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        phone: data.phone,
        alternateEmail: data.alternateEmail,
        email: data.email,
        dob: data.dob ? new Date(data.dob) : undefined,
        registrationNumber: data.registrationNumber,
        specialty: data.specialty,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        departments: data.departments ?? [],
        isDefault: data.isDefault ?? false,
        showOnAppointment: data.showOnAppointment ?? true,
        showOnlyAssigned: data.showOnlyAssigned ?? false,
        notifySMS: data.notifySMS ?? false,
        notifyEmail: data.notifyEmail ?? false,
        passkey: hashedPasskey,
        language: data.language || "en",
        availability: data.availability as Prisma.InputJsonValue ?? undefined,
      },
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    // Rebuild name if firstName/lastName changed
    if (data.firstName || data.lastName) {
      const sal = (data.salutation as string) || doctor.salutation || "Dr.";
      const fn = (data.firstName as string) || doctor.firstName || "";
      const ln = (data.lastName as string) ?? doctor.lastName ?? "";
      data.name = [sal, fn, ln].filter(Boolean).join(" ");
    }

    // Hash passkey if being updated
    if (data.passkey && typeof data.passkey === "string") {
      data.passkey = await bcrypt.hash(data.passkey, 10);
    }

    // Convert dob string to Date
    if (data.dob && typeof data.dob === "string") {
      data.dob = new Date(data.dob);
    }

    return this.prisma.doctor.update({
      where: { id },
      data: data as Prisma.DoctorUpdateInput,
    });
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────

  async softDelete(id: string, tenantId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    return this.prisma.doctor.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Upload Signature ─────────────────────────────────────────────────

  async uploadSignature(
    doctorId: string,
    tenantId: string,
    file: { buffer: Buffer; mimetype: string },
  ) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const objectKey = `signatures/${tenantId}/${doctorId}.png`;
    await this.minio.upload(objectKey, file.buffer, file.mimetype);
    const signatureUrl = await this.minio.getPresignedUrl(objectKey, 86400 * 365);

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { signatureImageUrl: objectKey },
    });

    return { signatureImageUrl: signatureUrl };
  }

  // ─── Generate Passkey ─────────────────────────────────────────────────

  async generatePasskey(doctorId: string, tenantId: string) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const rawPasskey = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(rawPasskey, 10);

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { passkey: hashed },
    });

    return { passkey: rawPasskey };
  }

  // ─── Create Login ─────────────────────────────────────────────────────

  async createLogin(
    doctorId: string,
    tenantId: string,
    data: { loginUsername: string; loginPassword: string },
  ) {
    const doctor = await this.prisma.doctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doctor) throw new NotFoundException("Doctor not found");

    if (data.loginUsername) {
      const existing = await this.prisma.doctor.findFirst({
        where: { loginUsername: data.loginUsername, tenantId, NOT: { id: doctorId } },
      });
      if (existing) throw new ConflictException("Username already taken");
    }

    const hashed = await bcrypt.hash(data.loginPassword, 10);

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        loginUsername: data.loginUsername,
        loginPassword: hashed,
        loginEnabled: true,
      },
    });

    return { success: true };
  }

  // ─── For Signing (by department) ───────────────────────────────────────

  async findForSigning(tenantId: string, department?: string) {
    const where: Prisma.DoctorWhereInput = {
      tenantId,
      isActive: true,
    };

    if (department) {
      where.departments = { has: department };
    }

    return this.prisma.doctor.findMany({
      where,
      select: {
        id: true,
        name: true,
        salutation: true,
        firstName: true,
        lastName: true,
        displayName: true,
        specialty: true,
        departments: true,
        isDefault: true,
        signatureImageUrl: true,
        signatureHtml: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/services/audit.service";

@Injectable()
export class MergePatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ───────────────────────────────────────────
  // Find potential duplicates
  // Groups patients by phone number where count > 1
  // ───────────────────────────────────────────

  async findDuplicates(tenantId: string) {
    // Find phone numbers with multiple active patients
    const duplicatePhones = await this.prisma.patient.groupBy({
      by: ["phone"],
      where: { tenantId, isActive: true },
      having: {
        phone: { _count: { gt: 1 } },
      },
      _count: { id: true },
    });

    if (duplicatePhones.length === 0) {
      return { duplicates: [], totalGroups: 0 };
    }

    // Fetch patients for each duplicate phone
    const phones = duplicatePhones.map((d) => d.phone);
    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId,
        isActive: true,
        phone: { in: phones },
      },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        dob: true,
        gender: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: [{ phone: "asc" }, { createdAt: "asc" }],
    });

    // Group by phone
    const groups: Record<
      string,
      Array<{
        id: string;
        mrn: string;
        firstName: string;
        lastName: string;
        phone: string;
        email: string | null;
        dob: Date;
        gender: string;
        createdAt: Date;
        orderCount: number;
      }>
    > = {};

    for (const p of patients) {
      if (!groups[p.phone]) {
        groups[p.phone] = [];
      }
      const group = groups[p.phone]!;
      group.push({
        id: p.id,
        mrn: p.mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        email: p.email,
        dob: p.dob,
        gender: p.gender,
        createdAt: p.createdAt,
        orderCount: p._count.orders,
      });
    }

    const duplicates = Object.entries(groups).map(([phone, patients]) => ({
      phone,
      patients,
    }));

    return {
      duplicates,
      totalGroups: duplicates.length,
    };
  }

  // ───────────────────────────────────────────
  // Merge two patients
  // Transfers all data from mergeId -> keepId
  // ───────────────────────────────────────────

  async mergePatients(
    keepId: string,
    mergeId: string,
    tenantId: string,
    actorId: string,
  ) {
    if (keepId === mergeId) {
      throw new BadRequestException("Cannot merge a patient with itself");
    }

    // Validate both patients exist and are in the same tenant
    const [keepPatient, mergePatient] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: keepId, tenantId, isActive: true },
        select: { id: true, mrn: true, firstName: true, lastName: true },
      }),
      this.prisma.patient.findFirst({
        where: { id: mergeId, tenantId, isActive: true },
        select: { id: true, mrn: true, firstName: true, lastName: true },
      }),
    ]);

    if (!keepPatient) {
      throw new NotFoundException(`Keep patient ${keepId} not found`);
    }
    if (!mergePatient) {
      throw new NotFoundException(`Merge patient ${mergeId} not found`);
    }

    // Perform merge in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Transfer all orders
      const ordersUpdated = await tx.order.updateMany({
        where: { patientId: mergeId, tenantId },
        data: { patientId: keepId },
      });

      // 2. Transfer all appointments
      const appointmentsUpdated = await tx.appointment.updateMany({
        where: { patientId: mergeId, tenantId },
        data: { patientId: keepId },
      });

      // 3. Transfer all invoices
      const invoicesUpdated = await tx.invoice.updateMany({
        where: { patientId: mergeId, tenantId },
        data: { patientId: keepId },
      });

      // 4. Mark merge patient as inactive with merge metadata
      await tx.patient.update({
        where: { id: mergeId },
        data: {
          isActive: false,
          mergedIntoId: keepId,
          mergedAt: new Date(),
        },
      });

      return {
        ordersTransferred: ordersUpdated.count,
        appointmentsTransferred: appointmentsUpdated.count,
        invoicesTransferred: invoicesUpdated.count,
      };
    });

    // Audit log (outside transaction - AuditService handles its own DB call)
    await this.auditService.log({
      tenantId,
      actorId,
      action: "MERGE_PATIENTS",
      module: "patients",
      entity: "Patient",
      entityId: keepId,
      targetType: "Patient",
      targetRef: mergePatient.mrn,
      changes: {
        keepPatientId: keepId,
        keepPatientMrn: keepPatient.mrn,
        mergePatientId: mergeId,
        mergePatientMrn: mergePatient.mrn,
        ordersTransferred: result.ordersTransferred,
        appointmentsTransferred: result.appointmentsTransferred,
        invoicesTransferred: result.invoicesTransferred,
      },
    });

    return {
      success: true,
      keepPatient: {
        id: keepPatient.id,
        mrn: keepPatient.mrn,
        name: `${keepPatient.firstName} ${keepPatient.lastName}`,
      },
      mergedPatient: {
        id: mergePatient.id,
        mrn: mergePatient.mrn,
        name: `${mergePatient.firstName} ${mergePatient.lastName}`,
      },
      ...result,
    };
  }
}

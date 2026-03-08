import type { PrismaClient } from "@prisma/client";

const DEFAULT_INSTRUMENTS = [
  { name: 'Sysmex XN-330', brand: 'Sysmex', model: 'XN-330', department: 'Haematology' },
  { name: 'Sysmex XP-100', brand: 'Sysmex', model: 'XP-100', department: 'Haematology' },
  { name: 'Mindray BC-30', brand: 'Mindray', model: 'BC-30', department: 'Haematology' },
  { name: 'Horiba Yumizen H5', brand: 'Horiba', model: 'Yumizen H5', department: 'Haematology' },
  { name: 'Beckman AU480', brand: 'Beckman Coulter', model: 'AU480', department: 'Biochemistry' },
  { name: 'Roche Cobas C311', brand: 'Roche', model: 'Cobas C311', department: 'Biochemistry' },
  { name: 'Mindray BS-240', brand: 'Mindray', model: 'BS-240', department: 'Biochemistry' },
  { name: 'Erba XL-200', brand: 'Erba', model: 'XL-200', department: 'Biochemistry' },
  { name: 'Abbott Architect i1000', brand: 'Abbott', model: 'Architect i1000', department: 'Immunology' },
  { name: 'Roche Cobas E411', brand: 'Roche', model: 'Cobas E411', department: 'Immunology' },
  { name: 'Mindray CL-900i', brand: 'Mindray', model: 'CL-900i', department: 'Immunology' },
  { name: 'Sysmex UX-2000', brand: 'Sysmex', model: 'UX-2000', department: 'Urinalysis' },
  { name: 'Dirui H-500', brand: 'Dirui', model: 'H-500', department: 'Urinalysis' },
  { name: 'Stago STA-R Max', brand: 'Stago', model: 'STA-R Max', department: 'Coagulation' },
  { name: 'Manual / Microscopy', brand: 'Manual', model: 'NA', department: 'Microbiology' },
];

export async function seedInstruments(prisma: PrismaClient, tenantId: string) {
  const branch = await prisma.tenantBranch.findFirst({
    where: { tenantId },
  });

  if (!branch) {
    return { message: 'No branch found for tenant — cannot seed instruments', instrumentsCreated: 0 };
  }

  let instrumentsCreated = 0;

  for (const inst of DEFAULT_INSTRUMENTS) {
    const existing = await prisma.instrument.findFirst({
      where: { tenantId, name: inst.name },
    });

    if (!existing) {
      await prisma.instrument.create({
        data: {
          tenantId,
          branchId: branch.id,
          name: inst.name,
          brand: inst.brand,
          model: inst.model,
          department: inst.department,
        },
      });
      instrumentsCreated++;
    }
  }

  return { message: `Seeded ${instrumentsCreated} instruments`, instrumentsCreated };
}

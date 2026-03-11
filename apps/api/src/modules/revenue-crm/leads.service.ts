import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async getLeadLists(tenantId: string) {
    return this.prisma.marketingLeadList.findMany({
      where: { tenantId },
      include: { _count: { select: { leads: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getLeadListLeads(tenantId: string, listId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.marketingLead.findMany({ where: { tenantId, leadListId: listId }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.marketingLead.count({ where: { tenantId, leadListId: listId } }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async getAllLeads(tenantId: string, status?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { tenantId, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.marketingLead.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.marketingLead.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async uploadLeads(tenantId: string, userId: string, listName: string, leads: any[]) {
    // Validate: 10-digit Indian mobile numbers
    const validLeads: any[] = [];
    const invalid: any[] = [];
    const seenMobiles = new Set<string>();
    let duplicates = 0;

    for (const lead of leads) {
      const mobile = String(lead.mobile || '').replace(/\D/g, '');
      if (mobile.length !== 10) { invalid.push(lead); continue; }
      if (seenMobiles.has(mobile)) { duplicates++; continue; }
      seenMobiles.add(mobile);
      validLeads.push({ ...lead, mobile });
    }

    // Check existing patients (by mobile)
    const existingPatients = await this.prisma.patient.findMany({
      where: { tenantId, phone: { in: validLeads.map(l => l.mobile) } },
      select: { id: true, phone: true },
    });
    const patientMap = new Map(existingPatients.map(p => [p.phone, p.id]));

    // Create lead list
    const list = await this.prisma.marketingLeadList.create({
      data: {
        tenantId,
        name: listName,
        source: 'EXCEL_UPLOAD',
        totalCount: leads.length,
        validCount: validLeads.length,
        uploadedBy: userId,
      },
    });

    // Bulk create leads
    await this.prisma.marketingLead.createMany({
      data: validLeads.map(l => ({
        tenantId,
        leadListId: list.id,
        firstName: l.firstName || null,
        lastName: l.lastName || null,
        mobile: l.mobile,
        email: l.email || null,
        age: l.age ? parseInt(l.age) : null,
        gender: l.gender || null,
        city: l.city || null,
        pincode: l.pincode || null,
        patientId: patientMap.get(l.mobile) || null,
        status: 'NEW',
      })),
      skipDuplicates: true,
    });

    return {
      listId: list.id,
      totalUploaded: leads.length,
      validImported: validLeads.length,
      duplicatesSkipped: duplicates,
      invalidSkipped: invalid.length,
      matchedToPatients: existingPatients.length,
    };
  }

  async updateLead(tenantId: string, id: string, dto: Record<string, unknown>) {
    return this.prisma.marketingLead.update({ where: { id }, data: dto as any });
  }

  async getStats(tenantId: string) {
    const [total, newLeads, contacted, converted] = await Promise.all([
      this.prisma.marketingLead.count({ where: { tenantId } }),
      this.prisma.marketingLead.count({ where: { tenantId, status: 'NEW' } }),
      this.prisma.marketingLead.count({ where: { tenantId, status: 'CONTACTED' } }),
      this.prisma.marketingLead.count({ where: { tenantId, status: 'CONVERTED' } }),
    ]);
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, new: newLeads, contacted, converted, conversionRate };
  }
}

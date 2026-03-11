import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

export interface AnalysisStatus {
  status: 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalPatients: number;
  processed: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

@Injectable()
export class RepeatAnalyticsService {
  private readonly logger = new Logger(RepeatAnalyticsService.name);
  private jobStatus: Map<string, AnalysisStatus> = new Map();
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  getStatus(tenantId: string) {
    return this.jobStatus.get(tenantId) ?? { status: 'NOT_STARTED', totalPatients: 0, processed: 0, startedAt: null, completedAt: null };
  }

  async runAnalysis(tenantId: string) {
    const existing = this.jobStatus.get(tenantId);
    if (existing?.status === 'RUNNING') return { status: 'ALREADY_RUNNING' };

    const totalPatients = await this.prisma.patient.count({ where: { tenantId } });
    this.jobStatus.set(tenantId, { status: 'RUNNING', totalPatients, processed: 0, startedAt: new Date(), completedAt: null });

    setImmediate(() => this.runJob(tenantId).catch(e => {
      this.logger.error('Repeat analysis failed:', e);
      const s = this.jobStatus.get(tenantId)!;
      this.jobStatus.set(tenantId, { ...s, status: 'FAILED' });
    }));

    return { status: 'STARTED', totalPatients };
  }

  private async runJob(tenantId: string) {
    const BATCH_SIZE = 50;
    let skip = 0;

    // Clear old candidates for this tenant
    await this.prisma.repeatTestCandidate.deleteMany({ where: { tenantId } });

    while (true) {
      const patients = await this.prisma.patient.findMany({
        where: { tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dob: true,
          gender: true,
          orders: {
            select: {
              createdAt: true,
              items: {
                select: {
                  testCatalog: { select: { id: true, name: true, category: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
        skip,
        take: BATCH_SIZE,
      });

      if (patients.length === 0) break;

      try {
        await this.processBatch(tenantId, patients);
      } catch (e) {
        this.logger.error(`Batch error at skip=${skip}:`, e);
      }

      const s = this.jobStatus.get(tenantId)!;
      s.processed += patients.length;

      skip += BATCH_SIZE;
      await new Promise(r => setTimeout(r, 1000));
    }

    const s = this.jobStatus.get(tenantId)!;
    this.jobStatus.set(tenantId, { ...s, status: 'COMPLETED', completedAt: new Date() });
  }

  private async processBatch(tenantId: string, patients: any[]) {
    const patientSummaries = patients.map(p => ({
      patientId: p.id,
      age: p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
      gender: p.gender,
      testHistory: p.orders.flatMap((o: any) => o.items.map((i: any) => ({
        testName: i.testCatalog?.name,
        testId: i.testCatalog?.id,
        date: o.createdAt,
      }))).slice(0, 10),
    }));

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: `You are a clinical diagnostics expert. Analyze patient test history and identify repeat test candidates.
Apply these intervals: HbA1c(3-6mo), Thyroid(6-12mo), Lipid Profile(6-12mo), CBC(3-6mo), LFT(6-12mo), KFT(6-12mo), Vitamin D(6mo), Vitamin B12(6mo), PSA(12mo men 50+), Annual Package(12mo).
Return ONLY a JSON array. Only include patients who have tests due.`,
      messages: [{
        role: 'user',
        content: `Patients: ${JSON.stringify(patientSummaries)}\n\nReturn JSON array: [{"patientId":"string","recommendations":[{"testName":"string","testId":"string or null","lastTestDate":"ISO date","recommendedDate":"ISO date","priority":"HIGH|MEDIUM|LOW","daysOverdue":0,"reason":"patient-friendly string"}]}]`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return;

    const results: any[] = JSON.parse(match[0]);

    for (const result of results) {
      for (const rec of (result.recommendations || [])) {
        try {
          await this.prisma.repeatTestCandidate.create({
            data: {
              tenantId,
              patientId: result.patientId,
              testId: rec.testId || null,
              testName: rec.testName,
              lastTestDate: new Date(rec.lastTestDate),
              recommendedDate: new Date(rec.recommendedDate),
              daysOverdue: rec.daysOverdue || 0,
              priority: rec.priority || 'MEDIUM',
              aiReason: rec.reason,
            },
          });
        } catch (e) { /* skip individual failures */ }
      }
    }
  }

  async getCandidates(tenantId: string, priority?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { tenantId, ...(priority ? { priority } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.repeatTestCandidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { daysOverdue: 'desc' }],
        include: { tenant: { select: { name: true } } },
      }),
      this.prisma.repeatTestCandidate.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async getSummary(tenantId: string) {
    const [total, high, medium, low, contacted, converted] = await Promise.all([
      this.prisma.repeatTestCandidate.count({ where: { tenantId } }),
      this.prisma.repeatTestCandidate.count({ where: { tenantId, priority: 'HIGH' } }),
      this.prisma.repeatTestCandidate.count({ where: { tenantId, priority: 'MEDIUM' } }),
      this.prisma.repeatTestCandidate.count({ where: { tenantId, priority: 'LOW' } }),
      this.prisma.repeatTestCandidate.count({ where: { tenantId, contacted: true } }),
      this.prisma.repeatTestCandidate.count({ where: { tenantId, converted: true } }),
    ]);
    return { total, high, medium, low, contacted, converted };
  }

  async generateReminderMessage(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.repeatTestCandidate.findFirst({ where: { id: candidateId, tenantId } });
    if (!candidate) throw new Error('Candidate not found');

    const patient = await this.prisma.patient.findFirst({
      where: { id: candidate.patientId, tenantId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });
    if (!patient) throw new Error('Patient not found');

    const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
    const message = `Hi ${patient.firstName || 'there'}, this is DELViON Health. Your ${candidate.testName} test is due for a repeat. ${candidate.aiReason || 'Regular monitoring helps maintain optimal health.'}. Book now or call us at DELViON Health. - DELViON Health Team`;

    return { candidate, patient: { ...patient, name: fullName }, message, whatsapp: message, sms: message.substring(0, 160) };
  }

  async markContacted(tenantId: string, candidateId: string) {
    return this.prisma.repeatTestCandidate.update({
      where: { id: candidateId },
      data: { contacted: true },
    });
  }
}

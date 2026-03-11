import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

export interface GeneratorStatus {
  status: 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalTests: number;
  processed: number;
  failed: number;
  startedAt: Date | null;
  completedAt: Date | null;
  failedTests: { testCode: string; testName: string; error: string }[];
}

@Injectable()
export class ReportGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private anthropic: Anthropic;
  // Track which tenants have an active background job in this process
  private activeJobs: Set<string> = new Set();

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async onModuleInit() {
    // Auto-resume any incomplete jobs after server restart
    // A job is considered incomplete if templates exist but don't cover all tests
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      const [totalTests, generated] = await Promise.all([
        this.prisma.testCatalog.count({ where: { tenantId: tenant.id, isActive: true } }),
        this.prisma.testReportTemplate.count({ where: { tenantId: tenant.id, status: 'COMPLETED' } }),
      ]);
      if (totalTests > 0 && generated > 0 && generated < totalTests && !this.activeJobs.has(tenant.id)) {
        this.logger.log(`Auto-resuming report generation for tenant ${tenant.id}: ${generated}/${totalTests} done`);
        this.activeJobs.add(tenant.id);
        setImmediate(() => this.runJob(tenant.id).catch(e => {
          this.logger.error(`Auto-resume failed for tenant ${tenant.id}:`, e);
          this.activeJobs.delete(tenant.id);
        }));
      }
    }
  }

  async getStatus(tenantId: string): Promise<GeneratorStatus & { progressPercent: number }> {
    const [totalTests, processed, failed] = await Promise.all([
      this.prisma.testCatalog.count({ where: { tenantId, isActive: true } }),
      this.prisma.testReportTemplate.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.testReportTemplate.count({ where: { tenantId, status: 'FAILED' } }),
    ]);

    const isRunning = this.activeJobs.has(tenantId);
    const isComplete = processed + failed >= totalTests && totalTests > 0;
    const progressPercent = totalTests > 0 ? Math.round((processed / totalTests) * 100) : 0;

    let status: GeneratorStatus['status'] = 'NOT_STARTED';
    if (isRunning) status = 'RUNNING';
    else if (isComplete) status = 'COMPLETED';
    else if (processed > 0 || failed > 0) status = 'RUNNING'; // incomplete — treat as resumable

    return {
      status,
      totalTests,
      processed,
      failed,
      startedAt: null,
      completedAt: isComplete && !isRunning ? new Date() : null,
      failedTests: [],
      progressPercent,
    };
  }

  async startJob(tenantId: string): Promise<{ jobId: string; totalTests: number; estimatedMinutes: number }> {
    if (this.activeJobs.has(tenantId)) {
      const totalTests = await this.prisma.testCatalog.count({ where: { tenantId, isActive: true } });
      return { jobId: tenantId, totalTests, estimatedMinutes: 0 };
    }

    const totalTests = await this.prisma.testCatalog.count({ where: { tenantId, isActive: true } });

    this.activeJobs.add(tenantId);
    setImmediate(() => this.runJob(tenantId).catch(e => {
      this.logger.error(`Job failed for tenant ${tenantId}:`, e);
      this.activeJobs.delete(tenantId);
    }));

    const estimatedMinutes = Math.ceil(totalTests / 5) * 0.15;
    return { jobId: tenantId, totalTests, estimatedMinutes };
  }

  private async runJob(tenantId: string): Promise<void> {
    const BATCH_SIZE = 5;

    // Get all tests that don't yet have a template (idempotent resume)
    const allTests = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true, category: true, methodology: true },
      orderBy: { name: 'asc' },
    });

    const existing = await this.prisma.testReportTemplate.findMany({
      where: { tenantId },
      select: { testId: true },
    });
    const existingIds = new Set(existing.map(e => e.testId));
    const toProcess = allTests.filter(t => !existingIds.has(t.id));

    this.logger.log(`Report generation: ${toProcess.length} remaining out of ${allTests.length} total`);

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      try {
        await this.processBatch(tenantId, batch);
      } catch (e) {
        this.logger.error(`Batch error at index=${i}:`, e);
        // Mark these as failed so they don't block progress
        for (const t of batch) {
          await this.prisma.testReportTemplate.upsert({
            where: { tenantId_testId: { tenantId, testId: t.id } },
            create: { tenantId, testId: t.id, testName: t.name, testCode: t.code, referenceRanges: [], status: 'FAILED', isAiGenerated: false },
            update: { status: 'FAILED' },
          }).catch(() => {});
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.activeJobs.delete(tenantId);
    this.logger.log(`Report template generation complete for tenant ${tenantId}`);
  }

  private async processBatch(tenantId: string, tests: { id: string; code: string; name: string; category: string; methodology: string | null }[]): Promise<void> {
    const prompt = `Generate report templates for these lab tests. Focus on Indian population reference ranges.

Tests: ${JSON.stringify(tests.map(t => ({ testCode: t.code, testName: t.name, category: t.category })))}

Return ONLY a valid JSON array (no other text) with this structure for each test:
[{
  "testCode": "string",
  "testName": "string",
  "referenceRanges": [{"gender":"ALL","ageMin":0,"ageMax":999,"unit":"string","low":null,"high":null,"criticalLow":null,"criticalHigh":null,"displayText":"string"}],
  "methodology": "string",
  "specimenRequirement": "string",
  "patientPreparation": null or "string",
  "supplementaryNotes": "string",
  "clinicalSignificance": "string"
}]`;

    let result: unknown;
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: `You are a clinical pathology expert for an Indian diagnostic laboratory.
Generate bio-reference ranges and clinical notes for lab tests.
Return ONLY valid JSON arrays. Use Indian population norms where available.
For qualitative tests use displayText like "Negative" or "Non-Reactive".`,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = stripped.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found in response');
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Claude API error: ${e}`);
    }

    const items = Array.isArray(result) ? result : [];

    for (const item of items) {
      const test = tests.find(t => t.code === item.testCode || t.name === item.testName);
      if (!test) continue;

      await this.prisma.testReportTemplate.upsert({
        where: { tenantId_testId: { tenantId, testId: test.id } },
        create: {
          tenantId,
          testId: test.id,
          testName: test.name,
          testCode: test.code,
          referenceRanges: item.referenceRanges ?? [],
          methodology: item.methodology ?? null,
          specimenRequirement: item.specimenRequirement ?? null,
          patientPreparation: item.patientPreparation ?? null,
          supplementaryNotes: item.supplementaryNotes ?? null,
          clinicalSignificance: item.clinicalSignificance ?? null,
          isAiGenerated: true,
          aiGeneratedAt: new Date(),
          status: 'COMPLETED',
        },
        update: {
          referenceRanges: item.referenceRanges ?? [],
          methodology: item.methodology ?? null,
          specimenRequirement: item.specimenRequirement ?? null,
          patientPreparation: item.patientPreparation ?? null,
          supplementaryNotes: item.supplementaryNotes ?? null,
          clinicalSignificance: item.clinicalSignificance ?? null,
          isAiGenerated: true,
          aiGeneratedAt: new Date(),
          status: 'COMPLETED',
        },
      }).catch(e => this.logger.error(`Failed to save template for ${test.code}:`, e));
    }
  }

  async regenerateOne(tenantId: string, testId: string): Promise<void> {
    const test = await this.prisma.testCatalog.findFirst({
      where: { id: testId, tenantId },
      select: { id: true, code: true, name: true, category: true, methodology: true },
    });
    if (!test) throw new Error('Test not found');
    await this.processBatch(tenantId, [test]);
  }

  async getTemplate(tenantId: string, testId: string) {
    return this.prisma.testReportTemplate.findUnique({
      where: { tenantId_testId: { tenantId, testId } },
    });
  }

  async updateTemplate(tenantId: string, testId: string, dto: Record<string, unknown>) {
    return this.prisma.testReportTemplate.update({
      where: { tenantId_testId: { tenantId, testId } },
      data: { ...dto, isCustomized: true, lastEditedAt: new Date() },
    });
  }

  async listTemplates(tenantId: string, search?: string) {
    return this.prisma.testReportTemplate.findMany({
      where: {
        tenantId,
        ...(search ? {
          OR: [
            { testName: { contains: search, mode: 'insensitive' } },
            { testCode: { contains: search, mode: 'insensitive' } },
          ]
        } : {}),
      },
      orderBy: { testName: 'asc' },
      take: 200,
    });
  }
}

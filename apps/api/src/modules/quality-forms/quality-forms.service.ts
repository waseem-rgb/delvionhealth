import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import { QUALITY_FORMS_MASTER } from './quality-forms-master.constant';

@Injectable()
export class QualityFormsService implements OnModuleInit {
  private readonly logger = new Logger(QualityFormsService.name);
  private anthropic: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async onModuleInit() {
    const runningJobs = await this.prisma.formGenerationJob.findMany({
      where: { status: 'RUNNING' },
    });
    for (const job of runningJobs) {
      this.logger.log(`Auto-resuming Quality Forms job ${job.id} for tenant ${job.tenantId}`);
      setImmediate(() => this.runGenerationJob(job.tenantId, job.id).catch(async (e) => {
        this.logger.error('Quality Forms auto-resume failed:', e);
        await this.prisma.formGenerationJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
      }));
    }
  }

  // ─── GENERATION STATUS ────────────────────────────────────────────────────

  async getGenerationStatus(tenantId: string) {
    const job = await this.prisma.formGenerationJob.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const count = await this.prisma.qualityForm.count({
      where: { tenantId, isAiGenerated: true },
    });

    if (!job) {
      return {
        status: 'NOT_STARTED',
        totalPlanned: 0,
        totalGenerated: 0,
        totalFailed: 0,
        progressPercent: 0,
        currentForm: null,
        failedItems: [],
        formsCount: count,
      };
    }

    const progressPercent = job.totalPlanned > 0
      ? Math.round((job.totalGenerated / job.totalPlanned) * 100)
      : 0;

    return {
      ...job,
      progressPercent,
      failedItems: (job.failedItems as unknown[]) || [],
      formsCount: count,
    };
  }

  // ─── START GENERATION JOB ─────────────────────────────────────────────────

  async startGenerationJob(tenantId: string): Promise<{ jobId: string; totalPlanned: number; estimatedMinutes: number }> {
    const running = await this.prisma.formGenerationJob.findFirst({
      where: { tenantId, status: 'RUNNING' },
    });
    if (running) return { jobId: running.id, totalPlanned: running.totalPlanned, estimatedMinutes: 0 };

    const job = await this.prisma.formGenerationJob.create({
      data: {
        tenantId,
        status: 'RUNNING',
        totalPlanned: QUALITY_FORMS_MASTER.length,
        startedAt: new Date(),
      },
    });

    setImmediate(() =>
      this.runGenerationJob(tenantId, job.id).catch(async (e: Error) => {
        this.logger.error('Quality form generation failed:', e);
        await this.prisma.formGenerationJob.update({
          where: { id: job.id },
          data: { status: 'FAILED' },
        });
      }),
    );

    const estimatedMinutes = Math.ceil(QUALITY_FORMS_MASTER.length / 5) * 0.5 + 2;
    return { jobId: job.id, totalPlanned: QUALITY_FORMS_MASTER.length, estimatedMinutes };
  }

  // ─── RUN GENERATION JOB ───────────────────────────────────────────────────

  private async runGenerationJob(tenantId: string, jobId: string): Promise<void> {
    const BATCH_SIZE = 1;
    const failedItems: Array<{ formCode: string; error: string }> = [];

    for (let i = 0; i < QUALITY_FORMS_MASTER.length; i += BATCH_SIZE) {
      const batch = [...QUALITY_FORMS_MASTER].slice(i, i + BATCH_SIZE);

      // Check idempotency
      const existing = await this.prisma.qualityForm.findMany({
        where: { tenantId, formCode: { in: batch.map(f => f.code) } },
        select: { formCode: true },
      });
      const existingCodes = new Set(existing.map(f => f.formCode));
      const toGenerate = batch.filter(f => !existingCodes.has(f.code));

      await this.prisma.formGenerationJob.update({
        where: { id: jobId },
        data: { currentForm: batch[0].code },
      });

      if (toGenerate.length === 0) {
        await this.prisma.formGenerationJob.update({
          where: { id: jobId },
          data: { totalGenerated: { increment: batch.length } },
        });
        continue;
      }

      try {
        const generated = await this.generateBatch(toGenerate);
        await this.saveForms(tenantId, generated, toGenerate);

        await this.prisma.formGenerationJob.update({
          where: { id: jobId },
          data: {
            totalGenerated: { increment: batch.length },
            currentForm: batch[batch.length - 1].code,
          },
        });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        this.logger.error(`Batch failed for forms ${batch.map(f => f.code).join(',')}:`, errMsg);
        failedItems.push(...batch.map(f => ({ formCode: f.code, error: errMsg })));

        await this.prisma.formGenerationJob.update({
          where: { id: jobId },
          data: {
            totalFailed: { increment: batch.length },
            totalGenerated: { increment: batch.length },
            failedItems: failedItems,
          },
        });
        // Never stop — continue with next batch
      }

      // Rate limit: 3s between batches
      await new Promise(r => setTimeout(r, 3000));
    }

    await this.prisma.formGenerationJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date(), failedItems },
    });
  }

  // ─── GENERATE BATCH VIA AI ────────────────────────────────────────────────

  private async generateBatch(batch: Array<{ code: string; title: string; category: string; frequency: string; department: string; standards: readonly string[] }>): Promise<Array<{ formCode: string; formSchema: unknown }>> {
    const systemPrompt = `You are a quality manager creating online fillable form schemas for DELViON Health, an Indian diagnostic laboratory (NABL/CAP/ISO 15189 accredited). Generate JSON form schemas that are practical, compliance-ready, and match real-world lab quality forms. Each form schema must have sections with fields appropriate for online filling.

Field types allowed: text | number | temperature | date | time | select | checkbox | textarea | table | signature

For "table" type fields, include a "columns" array. For "select" type fields, include an "options" array.`;

    const userPrompt = `Generate form schemas for these quality forms:
${JSON.stringify(batch.map(f => ({ formCode: f.code, title: f.title, category: f.category, frequency: f.frequency, department: f.department, standards: f.standards })))}

Return ONLY a JSON array (no markdown, no explanation):
[{
  "formCode": "DH/TECH/FR/XX",
  "formSchema": {
    "sections": [
      {
        "title": "section title",
        "fields": [
          {"id": "fieldId", "label": "Field Label", "type": "text|number|temperature|date|time|select|checkbox|textarea|table|signature", "required": true|false, "options": ["opt1","opt2"], "columns": [{"id":"col1","label":"Col 1","type":"text"}]}
        ]
      }
    ],
    "acceptanceCriteria": "string or null",
    "instructions": "brief instructions for filling this form"
  }
}]`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in AI response');

    return JSON.parse(match[0]) as Array<{ formCode: string; formSchema: unknown }>;
  }

  // ─── SAVE FORMS ───────────────────────────────────────────────────────────

  private async saveForms(
    tenantId: string,
    generated: Array<{ formCode: string; formSchema: unknown }>,
    masterBatch: Array<{ code: string; title: string; category: string; frequency: string; department: string; standards: readonly string[] }>,
  ): Promise<void> {
    for (const item of generated) {
      const masterItem = masterBatch.find(f => f.code === item.formCode);
      if (!masterItem) continue;

      try {
        await this.prisma.qualityForm.upsert({
          where: { tenantId_formCode: { tenantId, formCode: item.formCode } },
          create: {
            tenantId,
            formCode: item.formCode,
            name: masterItem.title,
            title: masterItem.title,
            category: masterItem.category,
            type: 'TECHNICAL',
            frequency: masterItem.frequency,
            department: masterItem.department,
            standards: [...masterItem.standards],
            formSchema: item.formSchema as object,
            isAiGenerated: true,
            isCustomized: false,
            status: 'ACTIVE',
            isActive: true,
          },
          update: {
            formSchema: item.formSchema as object,
            isAiGenerated: true,
          },
        });
      } catch (e: unknown) {
        this.logger.error(`Failed to save form ${item.formCode}:`, e);
      }
    }
  }

  // ─── FIND ALL ─────────────────────────────────────────────────────────────

  async findAll(tenantId: string, filters: {
    category?: string;
    frequency?: string;
    department?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 100 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId, isAiGenerated: true };
    if (filters.category) where['category'] = filters.category;
    if (filters.frequency) where['frequency'] = filters.frequency;
    if (filters.department) where['department'] = filters.department;
    if (filters.search) {
      where['OR'] = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { formCode: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.qualityForm.findMany({ where, orderBy: { formCode: 'asc' }, skip, take: limit }),
      this.prisma.qualityForm.count({ where }),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── FIND ONE ─────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const form = await this.prisma.qualityForm.findFirst({ where: { id, tenantId } });
    if (!form) throw new NotFoundException(`Form ${id} not found`);
    return form;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: {
    title?: string;
    formSchema?: unknown;
    status?: string;
    version?: string;
    sourceDocNo?: string;
  }) {
    await this.findOne(tenantId, id);
    const data: Record<string, unknown> = { isCustomized: true };
    if (dto.title !== undefined) { data['name'] = dto.title; data['title'] = dto.title; }
    if (dto.formSchema !== undefined) data['formSchema'] = dto.formSchema as object;
    if (dto.status !== undefined) data['status'] = dto.status;
    if (dto.version !== undefined) data['version'] = dto.version;
    if (dto.sourceDocNo !== undefined) data['sourceDocNo'] = dto.sourceDocNo;

    return this.prisma.qualityForm.update({ where: { id }, data });
  }

  // ─── SUBMIT FORM ──────────────────────────────────────────────────────────

  async submit(tenantId: string, formId: string, userId: string, userName: string, dto: {  // userName is email or display name
    submittedData: unknown;
    notes?: string;
    periodLabel?: string;
    month?: number;
    year?: number;
  }) {
    const form = await this.findOne(tenantId, formId);
    return this.prisma.formSubmission.create({
      data: {
        tenantId,
        formId,
        formCode: form.formCode,
        formTitle: form.title ?? form.name,
        submittedData: dto.submittedData as object,
        submittedBy: userId,
        submittedByName: userName,
        status: 'SUBMITTED',
        notes: dto.notes,
        periodLabel: dto.periodLabel,
        month: dto.month,
        year: dto.year,
      },
    });
  }

  // ─── GET SUBMISSIONS ──────────────────────────────────────────────────────

  async getSubmissions(tenantId: string, formId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { tenantId, formId };
    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── DELETE SUBMISSION ────────────────────────────────────────────────────

  async deleteSubmission(tenantId: string, formId: string, subId: string) {
    const sub = await this.prisma.formSubmission.findFirst({ where: { id: subId, tenantId, formId } });
    if (!sub) throw new NotFoundException(`Submission ${subId} not found`);
    return this.prisma.formSubmission.delete({ where: { id: subId } });
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [total, dailyCount, activeCount, submissionsThisMonth] = await Promise.all([
      this.prisma.qualityForm.count({ where: { tenantId, isAiGenerated: true } }),
      this.prisma.qualityForm.count({ where: { tenantId, isAiGenerated: true, frequency: 'DAILY' } }),
      this.prisma.qualityForm.count({ where: { tenantId, isAiGenerated: true, status: 'ACTIVE' } }),
      this.prisma.formSubmission.count({ where: { tenantId, submittedAt: { gte: monthStart, lte: monthEnd } } }),
    ]);

    return { total, dailyCount, activeCount, submissionsThisMonth };
  }
}

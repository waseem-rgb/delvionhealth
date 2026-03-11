import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';
import { SOP_MASTER_LIST } from './sop-master-list.constant';

@Injectable()
export class SopService implements OnModuleInit {
  private readonly logger = new Logger(SopService.name);
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async onModuleInit() {
    // Auto-resume any jobs that were RUNNING when the server last stopped
    const runningJobs = await this.prisma.sOPGenerationJob.findMany({
      where: { status: 'RUNNING' },
    });
    for (const job of runningJobs) {
      this.logger.log(`Auto-resuming SOP generation job ${job.id} for tenant ${job.tenantId}`);
      setImmediate(() => this.runGenerationJob(job.tenantId, job.id).catch(async (e) => {
        this.logger.error('SOP auto-resume failed:', e);
        await this.prisma.sOPGenerationJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
      }));
    }
  }

  // ─── GENERATION JOB ───────────────────────────────────────────────────────

  async getGenerationStatus(tenantId: string) {
    const job = await this.prisma.sOPGenerationJob.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!job) return { status: 'NOT_STARTED', totalPlanned: 0, totalGenerated: 0, totalFailed: 0, progressPercent: 0, currentDept: null, failedItems: [] };

    const progressPercent = job.totalPlanned > 0
      ? Math.round((job.totalGenerated / job.totalPlanned) * 100)
      : 0;

    return {
      ...job,
      progressPercent,
      failedItems: (job.failedItems as any[]) || [],
    };
  }

  async startGenerationJob(tenantId: string): Promise<{ jobId: string; totalPlanned: number; estimatedMinutes: number }> {
    // Check if already running
    const running = await this.prisma.sOPGenerationJob.findFirst({
      where: { tenantId, status: 'RUNNING' },
    });
    if (running) return { jobId: running.id, totalPlanned: running.totalPlanned, estimatedMinutes: 0 };

    const job = await this.prisma.sOPGenerationJob.create({
      data: {
        tenantId,
        status: 'RUNNING',
        totalPlanned: SOP_MASTER_LIST.length,
        startedAt: new Date(),
      },
    });

    // Background job
    setImmediate(() => this.runGenerationJob(tenantId, job.id).catch(async (e) => {
      this.logger.error(`SOP generation failed:`, e);
      await this.prisma.sOPGenerationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED' },
      });
    }));

    const estimatedMinutes = Math.ceil(SOP_MASTER_LIST.length / 5) * 0.5 + 5;
    return { jobId: job.id, totalPlanned: SOP_MASTER_LIST.length, estimatedMinutes };
  }

  private async runGenerationJob(tenantId: string, jobId: string): Promise<void> {
    const BATCH_SIZE = 1;
    const failedItems: any[] = [];

    // Process in batches
    for (let i = 0; i < SOP_MASTER_LIST.length; i += BATCH_SIZE) {
      const batch = SOP_MASTER_LIST.slice(i, i + BATCH_SIZE);

      // Check which already exist (idempotent)
      const existing = await this.prisma.sOP.findMany({
        where: { tenantId, sopNumber: { in: batch.map(s => s.number) } },
        select: { sopNumber: true },
      });
      const existingNumbers = new Set(existing.map(s => s.sopNumber));
      const toGenerate = batch.filter(s => !existingNumbers.has(s.number));

      if (toGenerate.length === 0) {
        await this.prisma.sOPGenerationJob.update({
          where: { id: jobId },
          data: { totalGenerated: { increment: batch.length }, currentDept: batch[0].dept },
        });
        continue;
      }

      try {
        const generated = await this.generateBatch(toGenerate);
        await this.saveSops(tenantId, generated);

        await this.prisma.sOPGenerationJob.update({
          where: { id: jobId },
          data: {
            totalGenerated: { increment: batch.length },
            currentDept: batch[0].dept,
            currentBatch: batch.map(s => s.number).join(', '),
          },
        });
      } catch (e: any) {
        this.logger.error(`Batch failed for SOPs ${batch.map(s => s.number).join(',')}:`, e.message);
        failedItems.push(...batch.map(s => ({ sopNumber: s.number, error: e.message })));

        await this.prisma.sOPGenerationJob.update({
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

    await this.prisma.sOPGenerationJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date(), failedItems },
    });
  }

  private async generateBatch(batch: typeof SOP_MASTER_LIST): Promise<any[]> {
    const systemPrompt = `You are a NABL/CAP/ISO 15189 quality expert for DELViON Health Diagnostic Laboratory, India.
Generate concise but complete SOPs. Keep each SOP under 600 words total.
Use this structure in the content field (plain text, no markdown headers):
PURPOSE | SCOPE | RESPONSIBILITY | PROCEDURE (numbered steps) | QC | SAFETY | REFERENCES

Return ONLY valid JSON array. No markdown fences. No extra text.`;

    const userPrompt = `Generate SOPs for:
${JSON.stringify(batch.map(s => ({ sopNumber: s.number, title: s.title, dept: s.dept, standards: s.standards.join(',') })))}

Return JSON array:
[{"sopNumber":"string","title":"string","department":"string","objective":"1-2 sentences","scope":"1-2 sentences","responsibility":"who performs/verifies/approves","content":"full SOP text under 500 words with PURPOSE, SCOPE, RESPONSIBILITY, PROCEDURE (numbered), QC, SAFETY, REFERENCES sections","references":"ISO 15189:2022, NABL 112, relevant CLSI guideline","reviewFrequencyMonths":12}]`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    // Strip markdown code fences if present
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in AI response. Preview: ${text.slice(0, 200)}`);

    return JSON.parse(match[0]);
  }

  private async saveSops(tenantId: string, items: any[]): Promise<void> {
    for (const item of items) {
      const masterItem = SOP_MASTER_LIST.find(s => s.number === item.sopNumber);
      if (!masterItem) continue;

      try {
        await this.prisma.sOP.upsert({
          where: { tenantId_sopNumber: { tenantId, sopNumber: item.sopNumber } },
          create: {
            tenantId,
            sopNumber: item.sopNumber,
            title: item.title || masterItem.title,
            department: item.department || masterItem.dept,
            category: masterItem.category || 'CLINICAL',
            standard: masterItem.standards,
            content: item.content || '',
            objective: item.objective || null,
            scope: item.scope || null,
            responsibility: item.responsibility || null,
            references: item.references || null,
            reviewFrequency: item.reviewFrequencyMonths || 12,
            nextReviewDate: new Date(Date.now() + (item.reviewFrequencyMonths || 12) * 30 * 24 * 60 * 60 * 1000),
            isAiGenerated: true,
            aiGeneratedAt: new Date(),
            status: 'DRAFT',
          },
          update: {
            content: item.content || '',
            objective: item.objective || null,
            scope: item.scope || null,
            responsibility: item.responsibility || null,
            references: item.references || null,
            isAiGenerated: true,
            aiGeneratedAt: new Date(),
          },
        });
      } catch (e) {
        this.logger.error(`Failed to save SOP ${item.sopNumber}:`, e);
      }
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, filters: { dept?: string; standard?: string; status?: string; search?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.dept) where.department = filters.dept;
    if (filters.status) where.status = filters.status;
    if (filters.standard) where.standard = { has: filters.standard };
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { sopNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.sOP.findMany({ where, orderBy: { sopNumber: 'asc' }, skip, take: limit }),
      this.prisma.sOP.count({ where }),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.sOP.findFirst({ where: { id, tenantId }, include: { versions: { orderBy: { createdAt: 'desc' }, take: 10 } } });
  }

  async update(tenantId: string, id: string, userId: string, dto: { content?: string; status?: string; version?: string; changeNote?: string }) {
    const sop = await this.prisma.sOP.findFirst({ where: { id, tenantId } });
    if (!sop) throw new Error('SOP not found');

    // Save current version before overwriting
    if (dto.content && dto.content !== sop.content) {
      await this.prisma.sOPVersion.create({
        data: {
          sopId: id,
          version: sop.version,
          content: sop.content,
          changedBy: userId,
          changeNote: dto.changeNote || 'Content updated',
        },
      });
    }

    const newVersion = dto.version || this.incrementVersion(sop.version);

    return this.prisma.sOP.update({
      where: { id },
      data: {
        content: dto.content !== undefined ? dto.content : sop.content,
        status: dto.status || sop.status,
        version: newVersion,
        isCustomized: true,
        lastEditedAt: new Date(),
        lastEditedBy: userId,
      },
    });
  }

  async approve(tenantId: string, id: string, userId: string) {
    return this.prisma.sOP.update({
      where: { id },
      data: { status: 'ACTIVE', approvedBy: userId, approvedAt: new Date() },
    });
  }

  async regenerate(tenantId: string, id: string) {
    const sop = await this.prisma.sOP.findFirst({ where: { id, tenantId } });
    if (!sop) throw new Error('SOP not found');

    const masterItem = SOP_MASTER_LIST.find(s => s.number === sop.sopNumber);
    if (!masterItem) throw new Error('SOP not in master list');

    const generated = await this.generateBatch([masterItem]);
    if (generated.length === 0) throw new Error('Generation returned no results');

    return this.prisma.sOP.update({
      where: { id },
      data: {
        content: generated[0].content,
        objective: generated[0].objective,
        scope: generated[0].scope,
        responsibility: generated[0].responsibility,
        references: generated[0].references,
        isAiGenerated: true,
        aiGeneratedAt: new Date(),
        isCustomized: false,
      },
    });
  }

  async getVersions(tenantId: string, id: string) {
    const sop = await this.prisma.sOP.findFirst({ where: { id, tenantId } });
    if (!sop) throw new Error('SOP not found');
    return this.prisma.sOPVersion.findMany({ where: { sopId: id }, orderBy: { createdAt: 'desc' } });
  }

  async restoreVersion(tenantId: string, id: string, versionId: string, userId: string) {
    const [sop, version] = await Promise.all([
      this.prisma.sOP.findFirst({ where: { id, tenantId } }),
      this.prisma.sOPVersion.findFirst({ where: { id: versionId, sopId: id } }),
    ]);
    if (!sop || !version) throw new Error('SOP or version not found');

    // Save current as version first
    await this.prisma.sOPVersion.create({
      data: {
        sopId: id,
        version: sop.version,
        content: sop.content,
        changedBy: userId,
        changeNote: `Restored to v${version.version}`,
      },
    });

    return this.prisma.sOP.update({
      where: { id },
      data: {
        content: version.content,
        version: this.incrementVersion(sop.version),
        isCustomized: true,
        lastEditedAt: new Date(),
        lastEditedBy: userId,
      },
    });
  }

  async getStats(tenantId: string) {
    const [total, active, draft, underReview, dueForReview] = await Promise.all([
      this.prisma.sOP.count({ where: { tenantId } }),
      this.prisma.sOP.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.sOP.count({ where: { tenantId, status: 'DRAFT' } }),
      this.prisma.sOP.count({ where: { tenantId, status: 'UNDER_REVIEW' } }),
      this.prisma.sOP.count({ where: { tenantId, nextReviewDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }),
    ]);
    return { total, active, draft, underReview, dueForReview };
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const minor = parseInt(parts[1] || '0') + 1;
    return `${parts[0]}.${minor}`;
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

export interface NonPathJobStatus {
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  total: number;
  processed: number;
  failed: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

@Injectable()
export class GenerateNonpathTemplatesService {
  private readonly logger = new Logger(GenerateNonpathTemplatesService.name);

  // In-memory job status per tenant
  private jobStatus = new Map<string, NonPathJobStatus>();

  constructor(private readonly prisma: PrismaService) {}

  getJobStatus(tenantId: string): NonPathJobStatus {
    return (
      this.jobStatus.get(tenantId) ?? {
        status: "IDLE",
        total: 0,
        processed: 0,
        failed: 0,
        startedAt: null,
        completedAt: null,
      }
    );
  }

  async startJob(tenantId: string): Promise<void> {
    const current = this.getJobStatus(tenantId);
    if (current.status === "RUNNING") return;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Find all non-pathology tests for this tenant
    const nonPathCategories = [
      "USG", "CT", "MRI", "X-RAY", "XRAY", "DOPPLER",
      "ECG", "ECHO", "PFT", "EEG", "AUDIOLOGY",
      "IMAGING", "MOLECULAR", "GENETIC",
    ];

    const tests = await this.prisma.testCatalog.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { investigationType: { in: ["IMAGING", "MOLECULAR", "GENETIC"] } },
          { investigationCategory: { in: nonPathCategories } },
        ],
      },
      select: {
        id: true,
        name: true,
        investigationType: true,
        investigationCategory: true,
      },
    });

    this.jobStatus.set(tenantId, {
      status: "RUNNING",
      total: tests.length,
      processed: 0,
      failed: 0,
      startedAt: new Date(),
      completedAt: null,
    });

    this.logger.log(
      `Starting NonPath template generation for tenant ${tenantId}: ${tests.length} tests`
    );

    // Process asynchronously
    this.runJob(tenantId, tests, client).catch((e) => {
      this.logger.error(`NonPath template job failed for tenant ${tenantId}:`, e);
      const status = this.getJobStatus(tenantId);
      this.jobStatus.set(tenantId, { ...status, status: "FAILED", completedAt: new Date() });
    });
  }

  private async runJob(
    tenantId: string,
    tests: Array<{ id: string; name: string; investigationType: string | null; investigationCategory: string | null }>,
    client: Anthropic,
  ): Promise<void> {
    const batchSize = 5;

    for (let i = 0; i < tests.length; i += batchSize) {
      const batch = tests.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (test) => {
          const status = this.getJobStatus(tenantId);
          try {
            // Skip if template already exists
            const existing = await this.prisma.nonPathReportTemplate.findFirst({
              where: {
                tenantId,
                investigationType: test.investigationType ?? "IMAGING",
                testType: test.name,
              },
            });
            if (existing) {
              this.jobStatus.set(tenantId, { ...status, processed: status.processed + 1 });
              return;
            }

            const invType = test.investigationType ?? test.investigationCategory ?? "IMAGING";
            const invCat = test.investigationCategory ?? invType;

            const response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1024,
              messages: [
                {
                  role: "user",
                  content: `Create a structured diagnostic report template for a clinical diagnostic centre.
Test: "${test.name}"
Type: ${invCat}

Return ONLY valid JSON — no markdown, no explanation:
{"sections":[{"id":"clinicalHistory","label":"Clinical History","type":"text","required":true,"placeholder":"Clinical history and indication for the study"},{"id":"technique","label":"Technique","type":"text","defaultValue":"Standard ${invCat} protocol performed"},{"id":"findings","label":"Findings","type":"richtext","required":true,"placeholder":"Describe findings"},{"id":"impression","label":"Impression / Conclusion","type":"richtext","required":true,"placeholder":"Radiological impression and summary"},{"id":"recommendation","label":"Recommendations","type":"text","placeholder":"Further imaging / clinical correlation"}]}`,
                },
              ],
            });

            const content = response.content[0];
            if (content.type !== "text") {
              this.jobStatus.set(tenantId, { ...status, failed: status.failed + 1 });
              return;
            }

            let sections: unknown;
            try {
              const parsed = JSON.parse(content.text.trim()) as { sections: unknown };
              sections = parsed.sections;
            } catch {
              this.jobStatus.set(tenantId, { ...this.getJobStatus(tenantId), failed: this.getJobStatus(tenantId).failed + 1 });
              return;
            }

            await this.prisma.nonPathReportTemplate.create({
              data: {
                tenantId,
                investigationType: invType,
                testType: test.name,
                templateName: `${test.name} — AI Template`,
                methodology: `Standard ${invCat} protocol`,
                sections: sections as never,
                isDefault: false,
              },
            });

            const current = this.getJobStatus(tenantId);
            this.jobStatus.set(tenantId, { ...current, processed: current.processed + 1 });
          } catch (e) {
            const err = e as Error;
            this.logger.error(`Failed template for ${test.name}: ${err.message}`);
            const current = this.getJobStatus(tenantId);
            this.jobStatus.set(tenantId, { ...current, failed: current.failed + 1 });
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < tests.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const finalStatus = this.getJobStatus(tenantId);
    this.jobStatus.set(tenantId, {
      ...finalStatus,
      status: "COMPLETED",
      completedAt: new Date(),
    });

    this.logger.log(
      `NonPath template generation complete for ${tenantId}. Processed: ${finalStatus.processed}, Failed: ${finalStatus.failed}`
    );
  }
}

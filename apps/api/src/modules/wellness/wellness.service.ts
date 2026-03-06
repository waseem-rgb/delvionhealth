import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

@Injectable()
export class WellnessService {
  private readonly logger = new Logger(WellnessService.name);
  private anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.wellnessDashboard.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { organization: { select: { name: true } } },
    });
  }

  async create(
    tenantId: string,
    dto: {
      title: string;
      corporateName: string;
      organizationId?: string;
      campDateFrom: string;
      campDateTo: string;
      testIds?: string[];
      userId?: string;
    },
  ) {
    return this.prisma.wellnessDashboard.create({
      data: {
        tenantId,
        title: dto.title,
        corporateName: dto.corporateName,
        organizationId: dto.organizationId || null,
        campDateFrom: new Date(dto.campDateFrom),
        campDateTo: new Date(dto.campDateTo),
        testIds: dto.testIds ?? [],
        status: "DRAFT",
        createdById: dto.userId ?? null,
      },
    });
  }

  async generate(id: string, tenantId: string) {
    const dashboard = await this.prisma.wellnessDashboard.findFirst({
      where: { id, tenantId },
      include: { organization: true },
    });
    if (!dashboard) throw new NotFoundException("Dashboard not found");

    await this.prisma.wellnessDashboard.update({
      where: { id },
      data: { status: "GENERATING" },
    });

    try {
      const orders = await this.prisma.order.findMany({
        where: {
          tenantId,
          organizationId: dashboard.organizationId ?? undefined,
          createdAt: {
            gte: dashboard.campDateFrom,
            lte: dashboard.campDateTo,
          },
          status: {
            in: ["REPORTED", "APPROVED", "DISPATCHED", "DELIVERED"],
          },
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              dob: true,
              gender: true,
            },
          },
          items: {
            include: {
              testCatalog: {
                select: { name: true, code: true, category: true },
              },
              testResults: true,
            },
          },
        },
      });

      if (!orders.length) {
        await this.prisma.wellnessDashboard.update({
          where: { id },
          data: {
            status: "DRAFT",
            aiNarrative:
              "No completed orders found in the selected date range and organisation.",
          },
        });
        return this.prisma.wellnessDashboard.findFirst({ where: { id } });
      }

      const analytics = this._buildAnalytics(orders);
      const narrative = await this._generateNarrative(
        dashboard.corporateName,
        analytics,
      );
      const htmlContent = this._generateHtml(dashboard, analytics, narrative);

      return this.prisma.wellnessDashboard.update({
        where: { id },
        data: {
          status: "READY",
          htmlContent,
          aiNarrative: narrative.executiveSummary,
          riskSummary: analytics.riskDistribution,
          employeeCount: orders.length,
          generatedAt: new Date(),
        },
      });
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : String(err);
      this.logger.error("Wellness generation error:", errMsg);
      await this.prisma.wellnessDashboard.update({
        where: { id },
        data: { status: "DRAFT" },
      });
      throw err;
    }
  }

  private _getAge(dob: Date): number {
    const diff = Date.now() - dob.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }

  private _buildAnalytics(orders: Array<Record<string, unknown>>) {
    const employees = orders.length;
    const ageGroups: Record<string, number> = {
      "18-30": 0,
      "31-40": 0,
      "41-50": 0,
      "51-60": 0,
      "60+": 0,
    };
    const genderDist: Record<string, number> = {
      MALE: 0,
      FEMALE: 0,
      OTHER: 0,
    };
    const riskDist: Record<string, number> = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      NORMAL: 0,
    };
    const abnormalCounts: Record<
      string,
      { count: number; low: number; high: number }
    > = {};
    const categoryCounts: Record<string, number> = {};

    for (const order of orders) {
      const p = order.patient as {
        firstName: string;
        lastName: string;
        dob: Date;
        gender: string;
      } | null;

      if (p?.dob) {
        const age = this._getAge(new Date(p.dob));
        if (age <= 30) ageGroups["18-30"] = (ageGroups["18-30"] ?? 0) + 1;
        else if (age <= 40) ageGroups["31-40"] = (ageGroups["31-40"] ?? 0) + 1;
        else if (age <= 50) ageGroups["41-50"] = (ageGroups["41-50"] ?? 0) + 1;
        else if (age <= 60) ageGroups["51-60"] = (ageGroups["51-60"] ?? 0) + 1;
        else ageGroups["60+"] = (ageGroups["60+"] ?? 0) + 1;
      }

      const g = (p?.gender ?? "OTHER").toUpperCase();
      genderDist[g] = (genderDist[g] ?? 0) + 1;

      let hasCritical = false;
      let hasAbnormal = false;
      const items = (order.items as Array<Record<string, unknown>>) ?? [];

      for (const item of items) {
        const tc = item.testCatalog as {
          name: string;
          category: string;
        } | null;
        const cat = tc?.category ?? "Other";
        categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;

        const results =
          (item.testResults as Array<Record<string, unknown>>) ?? [];
        for (const result of results) {
          const interp = result.interpretation as string;
          if (interp === "NORMAL") continue;

          const pName = (result.value as string)
            ? (tc?.name ?? "Unknown")
            : (tc?.name ?? "Unknown");
          if (!abnormalCounts[pName])
            abnormalCounts[pName] = { count: 0, low: 0, high: 0 };
          abnormalCounts[pName].count++;

          const numVal = result.numericValue as number | null;
          const refRange = result.referenceRange as string | null;
          if (numVal != null && refRange) {
            const parts = refRange.split("-").map((s) => parseFloat(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
              if (numVal < parts[0]!) abnormalCounts[pName].low++;
              else if (numVal > parts[1]!) abnormalCounts[pName].high++;
            }
          }

          if (interp === "CRITICAL") hasCritical = true;
          else if (interp === "ABNORMAL") hasAbnormal = true;
        }
      }

      if (hasCritical) riskDist.HIGH = (riskDist.HIGH ?? 0) + 1;
      else if (hasAbnormal) riskDist.MEDIUM = (riskDist.MEDIUM ?? 0) + 1;
      else riskDist.NORMAL = (riskDist.NORMAL ?? 0) + 1;
    }

    const topAbnormal = Object.entries(abnormalCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name, data]) => ({
        name,
        count: data.count,
        prevalence: Math.round((data.count / employees) * 100),
        low: data.low,
        high: data.high,
      }));

    return {
      employees,
      ageGroups,
      genderDist,
      riskDistribution: riskDist,
      topAbnormal,
      categoryCounts,
      riskPercent: {
        high: employees > 0 ? Math.round(((riskDist.HIGH ?? 0) / employees) * 100) : 0,
        medium:
          employees > 0 ? Math.round(((riskDist.MEDIUM ?? 0) / employees) * 100) : 0,
        normal:
          employees > 0
            ? Math.round(
                (((riskDist.LOW ?? 0) + (riskDist.NORMAL ?? 0)) / employees) * 100,
              )
            : 0,
      },
    };
  }

  private async _generateNarrative(
    corporateName: string,
    analytics: ReturnType<typeof this._buildAnalytics>,
  ) {
    const prompt = `You are a senior occupational health physician reviewing a corporate health screening program.

COMPANY: ${corporateName}
EMPLOYEES SCREENED: ${analytics.employees}

HEALTH RISK DISTRIBUTION:
- High Risk: ${analytics.riskPercent.high}% (${analytics.riskDistribution.HIGH} employees)
- Medium Risk: ${analytics.riskPercent.medium}% (${analytics.riskDistribution.MEDIUM} employees)
- Normal/Low Risk: ${analytics.riskPercent.normal}% employees

TOP ABNORMAL PARAMETERS (by prevalence):
${analytics.topAbnormal.map((p) => `- ${p.name}: ${p.prevalence}% prevalence (${p.count}/${analytics.employees} employees)`).join("\n")}

AGE DISTRIBUTION:
${Object.entries(analytics.ageGroups).map(([range, count]) => `- ${range}: ${count} employees`).join("\n")}

GENDER: Male: ${analytics.genderDist.MALE}, Female: ${analytics.genderDist.FEMALE}

Write a professional corporate health report narrative. Be evidence-based, actionable, and constructive.

Return ONLY valid JSON:
{
  "executiveSummary": "3-4 sentence executive summary",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3", "Finding 4", "Finding 5"],
  "riskNarrative": "2-3 sentences on risk distribution",
  "topConcerns": ["Concern 1 with recommendation", "Concern 2", "Concern 3"],
  "recommendedInterventions": [
    { "title": "Intervention name", "description": "What to do", "priority": "HIGH", "targetGroup": "Who needs this" }
  ],
  "positiveObservations": ["Something positive"],
  "nextSteps": ["Step 1", "Step 2", "Step 3"],
  "benchmarkNote": "Brief benchmark comparison note"
}`;

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => ("text" in c ? c.text : ""))
      .join("");
    const clean = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(clean);
  }

  private _generateHtml(
    dashboard: Record<string, unknown>,
    analytics: ReturnType<typeof this._buildAnalytics>,
    narrative: Record<string, unknown>,
  ): string {
    const campFrom = new Date(
      dashboard.campDateFrom as string,
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const campTo = new Date(
      dashboard.campDateTo as string,
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const generated = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const topAbnormalBars = analytics.topAbnormal
      .map(
        (p) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="font-weight:600">${p.name}</span>
          <span style="color:#666">${p.prevalence}% (${p.count}/${analytics.employees})</span>
        </div>
        <div style="background:#e5e7eb;border-radius:8px;height:10px;overflow:hidden">
          <div style="width:${Math.min(p.prevalence, 100)}%;background:linear-gradient(90deg,#0d7377,#14a085);height:100%;border-radius:8px"></div>
        </div>
        <div style="font-size:11px;color:#888;margin-top:2px">
          ${p.high > 0 ? `<span style="color:#dc2626">&#8593; High: ${p.high}</span>` : ""}
          ${p.low > 0 ? `<span style="color:#2563eb;margin-left:8px">&#8595; Low: ${p.low}</span>` : ""}
        </div>
      </div>`,
      )
      .join("");

    const keyFindings = ((narrative.keyFindings as string[]) ?? [])
      .map(
        (f) => `
      <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
        <span style="color:#0d7377;margin-right:6px">&#8594;</span>${f}
      </div>`,
      )
      .join("");

    const interventions = (
      (narrative.recommendedInterventions as Array<{
        title: string;
        description: string;
        priority: string;
        targetGroup: string;
      }>) ?? []
    )
      .map(
        (i) => `
      <div style="padding:12px;background:#f8fafc;border-radius:8px;border-left:3px solid ${i.priority === "HIGH" ? "#dc2626" : i.priority === "MEDIUM" ? "#d97706" : "#16a34a"};margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700;font-size:14px">${i.title}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:12px;background:${i.priority === "HIGH" ? "#fee2e2" : i.priority === "MEDIUM" ? "#fef3c7" : "#dcfce7"};color:${i.priority === "HIGH" ? "#dc2626" : i.priority === "MEDIUM" ? "#d97706" : "#16a34a"};font-weight:600">${i.priority}</span>
        </div>
        <div style="font-size:13px;color:#444;margin-bottom:4px">${i.description}</div>
        <div style="font-size:12px;color:#888">&#128101; ${i.targetGroup}</div>
      </div>`,
      )
      .join("");

    const nextSteps = ((narrative.nextSteps as string[]) ?? [])
      .map(
        (s, i) => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0">
        <span style="width:24px;height:24px;border-radius:50%;background:#0d7377;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i + 1}</span>
        <span style="font-size:13px;padding-top:2px">${s}</span>
      </div>`,
      )
      .join("");

    const ageChartBars = Object.entries(analytics.ageGroups)
      .map(([range, count]) => {
        const pct =
          analytics.employees > 0
            ? Math.round((count / analytics.employees) * 100)
            : 0;
        return `
        <div style="text-align:center;flex:1">
          <div style="font-size:11px;color:#666;margin-bottom:4px">${pct}%</div>
          <div style="background:#e5e7eb;border-radius:4px;height:80px;position:relative;overflow:hidden">
            <div style="position:absolute;bottom:0;width:100%;height:${pct}%;background:linear-gradient(180deg,#0d7377,#14a085);border-radius:4px"></div>
          </div>
          <div style="font-size:11px;color:#666;margin-top:4px">${range}</div>
        </div>`;
      })
      .join("");

    const riskH = analytics.riskPercent.high;
    const riskM = analytics.riskPercent.medium;
    const riskN = analytics.riskPercent.normal;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wellness Dashboard - ${dashboard.corporateName as string}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#111}
.container{max-width:1100px;margin:0 auto;padding:32px 24px}
.card{background:white;border-radius:16px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,0.08);margin-bottom:20px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px}
@media(max-width:768px){.grid-2,.grid-4{grid-template-columns:1fr}}
@media print{body{background:white}.no-print{display:none}}
</style>
</head>
<body>
<div class="container">

<div class="card" style="background:linear-gradient(135deg,#0d4f52,#0d7377);color:white;padding:32px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:14px;opacity:0.8;letter-spacing:1px;text-transform:uppercase">Corporate Wellness Report</div>
      <div style="font-size:28px;font-weight:800;margin:8px 0">${dashboard.corporateName as string}</div>
      <div style="opacity:0.8">Health Camp: ${campFrom} &ndash; ${campTo}</div>
    </div>
    <div style="text-align:right;opacity:0.8;font-size:13px">
      <div>Prepared by</div>
      <div style="font-weight:700;font-size:15px">${dashboard.title as string}</div>
      <div>Generated: ${generated}</div>
    </div>
  </div>
</div>

<div class="grid-4">
  ${[
    { label: "Employees Screened", value: analytics.employees, icon: "&#128101;" },
    { label: "High Risk", value: `${riskH}%`, icon: "&#9888;&#65039;", sub: `${analytics.riskDistribution.HIGH} employees` },
    { label: "Medium Risk", value: `${riskM}%`, icon: "&#128202;", sub: `${analytics.riskDistribution.MEDIUM} employees` },
    { label: "Normal / Low Risk", value: `${riskN}%`, icon: "&#9989;", sub: "No abnormal findings" },
  ]
    .map(
      (k) => `
  <div class="card" style="text-align:center">
    <div style="font-size:24px">${k.icon}</div>
    <div style="font-size:28px;font-weight:800;margin:4px 0">${k.value}</div>
    <div style="font-size:12px;color:#666">${k.label}</div>
    ${k.sub ? `<div style="font-size:11px;color:#999;margin-top:2px">${k.sub}</div>` : ""}
  </div>`,
    )
    .join("")}
</div>

<div class="card">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <span style="font-size:18px">&#128203;</span>
    <span style="font-size:16px;font-weight:700">Executive Summary</span>
  </div>
  <p style="font-size:14px;line-height:1.7;color:#333">${narrative.executiveSummary as string}</p>
  ${(narrative.benchmarkNote as string) ? `<p style="font-size:12px;color:#888;margin-top:8px;font-style:italic">${narrative.benchmarkNote as string}</p>` : ""}
</div>

<div class="grid-2">
  <div class="card">
    <div style="font-size:15px;font-weight:700;margin-bottom:16px">Risk Distribution</div>
    <div style="display:flex;border-radius:8px;overflow:hidden;height:14px;margin-bottom:16px">
      <div style="width:${riskH}%;background:#dc2626"></div>
      <div style="width:${riskM}%;background:#d97706"></div>
      <div style="width:${riskN}%;background:#16a34a"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[
        { color: "#dc2626", label: "High Risk", pct: riskH, n: analytics.riskDistribution.HIGH ?? 0 },
        { color: "#d97706", label: "Medium Risk", pct: riskM, n: analytics.riskDistribution.MEDIUM ?? 0 },
        { color: "#16a34a", label: "Normal", pct: riskN, n: (analytics.riskDistribution.NORMAL ?? 0) + (analytics.riskDistribution.LOW ?? 0) },
      ]
        .map(
          (r) => `
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:12px;height:12px;border-radius:50%;background:${r.color};display:inline-block"></span>
        <span style="font-size:13px"><strong>${r.pct}%</strong> ${r.label} (${r.n})</span>
      </div>`,
        )
        .join("")}
    </div>
    <p style="font-size:12px;color:#888;margin-top:12px">${(narrative.riskNarrative as string) ?? ""}</p>
  </div>

  <div class="card">
    <div style="font-size:15px;font-weight:700;margin-bottom:16px">Age Distribution</div>
    <div style="display:flex;gap:8px;align-items:flex-end">${ageChartBars}</div>
    <div style="display:flex;gap:16px;margin-top:12px">
      <span style="font-size:12px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#0d7377;margin-right:4px"></span>Male: ${analytics.genderDist.MALE}</span>
      <span style="font-size:12px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#14a085;margin-right:4px"></span>Female: ${analytics.genderDist.FEMALE}</span>
    </div>
  </div>
</div>

<div class="card">
  <div style="font-size:15px;font-weight:700;margin-bottom:4px">&#128204; Key Findings</div>
  ${keyFindings}
</div>

<div class="card">
  <div style="font-size:15px;font-weight:700;margin-bottom:4px">&#128300; Most Prevalent Abnormalities</div>
  <div style="font-size:12px;color:#888;margin-bottom:16px">Percentage of employees with abnormal values per parameter</div>
  ${topAbnormalBars}
</div>

<div class="grid-2">
  <div class="card">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px">&#127973; Recommended Interventions</div>
    ${interventions}
  </div>
  <div class="card">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px">&#9989; Next Steps</div>
    ${nextSteps}
  </div>
</div>

${
  (narrative.positiveObservations as string[])?.length
    ? `<div class="card" style="border-left:4px solid #16a34a">
  <div style="font-size:15px;font-weight:700;margin-bottom:8px">&#9989; Positive Observations</div>
  ${((narrative.positiveObservations as string[]) ?? []).map((o) => `<div style="padding:4px 0;font-size:13px;color:#333"><span style="color:#16a34a;margin-right:6px">&#9733;</span>${o}</div>`).join("")}
</div>`
    : ""
}

<div style="text-align:center;padding:24px 0;font-size:12px;color:#999;border-top:1px solid #e5e7eb;margin-top:8px">
  This wellness dashboard was generated by DELViON Health Platform<br>
  Report generated on ${generated} &middot; Confidential &mdash; for organisational use only
</div>

</div>
</body>
</html>`;
  }

  async publish(id: string, tenantId: string) {
    const existing = await this.prisma.wellnessDashboard.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("Dashboard not found");
    const newStatus = existing.status === "PUBLISHED" ? "READY" : "PUBLISHED";
    return this.prisma.wellnessDashboard.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  async getByShareToken(shareToken: string) {
    const d = await this.prisma.wellnessDashboard.findFirst({
      where: { shareToken, status: { in: ["READY", "PUBLISHED"] } },
    });
    if (!d) throw new NotFoundException("Dashboard not found or not published");
    return d;
  }

  async getById(id: string, tenantId: string) {
    return this.prisma.wellnessDashboard.findFirst({
      where: { id, tenantId },
      include: { organization: { select: { name: true } } },
    });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.wellnessDashboard.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("Dashboard not found");
    return this.prisma.wellnessDashboard.delete({ where: { id } });
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AiService } from "./ai.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@ApiTags("ai")
@ApiBearerAuth()
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  @Get("status")
  @ApiOperation({ summary: "Get AI engine configuration status" })
  getStatus() {
    return this.aiService.getAiStatus();
  }

  @Post("insights/analytics")
  @ApiOperation({ summary: "Generate AI-powered lab analytics insights" })
  async getAnalyticsInsights(@Body() dto: Record<string, unknown>) {
    const enabled = process.env.AI_ANALYTICS_INSIGHTS_ENABLED === "true";
    if (!enabled) throw new BadRequestException("AI insights not enabled");

    const systemPrompt = `You are an expert diagnostic laboratory analytics advisor with deep knowledge of the Indian pathology industry. Analyze lab performance data and give actionable business insights. Always respond in valid JSON only — no markdown, no explanation outside the JSON.`;

    const totalRevenue = Number(dto.totalRevenue ?? dto.revenue ?? 0);
    const totalPatients = Number(dto.totalPatients ?? dto.patients ?? 0);
    const avgDailyOrders = Number(dto.avgDailyOrders ?? 0);
    const tatBreachRate = Number(dto.tatBreachRate ?? 0);
    const topTest = String(dto.topTest ?? "N/A");
    const outstandingDues = Number(dto.outstandingDues ?? 0);
    const revenueGrowth = Number(dto.revenueGrowth ?? 0);
    const topOrg = String(dto.topOrg ?? "N/A");
    const rejectionRate = Number(dto.rejectionRate ?? 0);
    const topDoctor = String(dto.topDoctor ?? "N/A");

    const userMessage = `Lab performance data for period: ${String(dto.period ?? "Last 30 days")}

Total patients: ${totalPatients}
Total revenue: ₹${totalRevenue}
Avg daily orders: ${avgDailyOrders}
TAT breach rate: ${tatBreachRate}%
Top test by volume: ${topTest}
Outstanding B2B dues: ₹${outstandingDues}
Revenue vs previous period: ${revenueGrowth > 0 ? "+" : ""}${revenueGrowth}%
Top B2B organisation: ${topOrg}
Sample rejection rate: ${rejectionRate}%
Top referring doctor: ${topDoctor}

Return this exact JSON structure:
{
  "summary": "2-3 sentence plain-English overview of lab performance",
  "opportunities": [
    "specific actionable growth opportunity 1",
    "specific actionable growth opportunity 2",
    "specific actionable growth opportunity 3"
  ],
  "issues": [
    "issue 1 if any (leave empty array if none)",
    "issue 2 if any"
  ],
  "recommendations": [
    "priority action 1 with specific detail",
    "priority action 2 with specific detail",
    "priority action 3 with specific detail"
  ],
  "forecastNote": "one sentence about expected next period based on trends"
}`;

    try {
      const result = await this.aiService.complete(systemPrompt, userMessage, 800);
      const clean = result.text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      const match = clean.match(/\{[\s\S]*\}/);
      const insights = JSON.parse(match?.[0] ?? "{}");
      return insights;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI analytics insights failed: ${msg}`);
      return {
        summary: `Your lab processed ${totalPatients} patients with ₹${totalRevenue.toLocaleString("en-IN")} in revenue. ${revenueGrowth > 0 ? "Revenue is trending up." : "Review revenue trends for improvement opportunities."}`,
        opportunities: [
          "Review high-volume tests for bundle pricing opportunities",
          "Focus on doctor referral engagement for growth",
          "Consider home collection expansion for new patient acquisition",
        ],
        issues: rejectionRate > 2
          ? [`Sample rejection rate at ${rejectionRate}% — investigate collection procedures`]
          : [],
        recommendations: [
          "Optimize TAT for high-volume tests to improve patient satisfaction",
          "Follow up on outstanding dues to improve cash flow",
          "Engage top referring doctors with regular visit schedule",
        ],
        forecastNote:
          "Continue monitoring daily order trends and collection efficiency for the next period.",
      };
    }
  }

  @Post("insights/report-interpretation")
  @ApiOperation({
    summary: "Generate AI-powered lab report interpretation",
  })
  async getReportInterpretation(@Body() dto: Record<string, unknown>) {
    const enabled = process.env.AI_REPORT_INTERPRETATION_ENABLED === "true";
    if (!enabled)
      throw new BadRequestException("AI report interpretation not enabled");

    const testResults = (dto.testResults ?? []) as Array<{
      name: string;
      value: string;
      unit: string;
      refRange: string;
      flag: string;
    }>;

    const abnormalResults = testResults.filter(
      (r) =>
        r.flag === "HIGH" || r.flag === "LOW" || r.flag === "CRITICAL"
    );

    if (abnormalResults.length === 0) {
      return {
        hasAbnormal: false,
        summary:
          "All parameters are within normal reference ranges.",
        findings: [],
        lifestyleAdvice: [],
        furtherInvestigations: [],
        specialistReferral: null,
        disclaimer:
          "This interpretation is for educational purposes only. Please consult your doctor for medical advice.",
      };
    }

    const systemPrompt = `You are a clinical pathology assistant helping doctors and patients understand lab reports. You work for an Indian diagnostic laboratory.
CRITICAL RULES:
- ONLY comment on parameters that are flagged as HIGH or LOW (abnormal)
- NEVER make a diagnosis — only interpret findings
- Suggest further investigations ONLY when clinically relevant
- Recommend medical specialist referral ONLY when clearly indicated
- Give non-pharmacological lifestyle advice only (no drug names, no dosages)
- Keep language simple, warm, and non-alarming
- Always recommend consulting a doctor for medical decisions
- Respond in valid JSON only — no markdown
You are NOT providing medical advice — this is educational interpretation only.`;

    const patientAge = String(dto.patientAge ?? "Unknown");
    const patientGender = String(dto.patientGender ?? "Unknown");
    const doctorName = String(dto.doctorName ?? "Not specified");

    const userMessage = `Patient: ${patientAge} year old ${patientGender.toLowerCase()}
Referring Doctor: ${doctorName}

ABNORMAL TEST RESULTS:
${abnormalResults.map((r) => `- ${r.name}: ${r.value} ${r.unit} (Reference: ${r.refRange}) [${r.flag}]`).join("\n")}

ALL TEST RESULTS (for context):
${testResults.map((r) => `- ${r.name}: ${r.value} ${r.unit} [${r.flag ?? "NORMAL"}]`).join("\n")}

Return this exact JSON:
{
  "hasAbnormal": true,
  "summary": "2-3 sentence plain English summary of key findings for a patient",
  "findings": [
    {
      "parameter": "test name",
      "value": "value with unit",
      "flag": "HIGH or LOW",
      "plainExplanation": "what this means in simple terms",
      "possibleCauses": ["cause 1", "cause 2"]
    }
  ],
  "lifestyleAdvice": [
    "specific non-pharmacological advice 1",
    "specific non-pharmacological advice 2"
  ],
  "furtherInvestigations": [
    {
      "testName": "suggested follow-up test",
      "reason": "why this test is suggested"
    }
  ],
  "specialistReferral": {
    "specialty": "e.g. Endocrinologist",
    "urgency": "Routine / Soon / Urgent",
    "reason": "brief reason"
  },
  "disclaimer": "This AI-generated interpretation is for educational purposes only and does not constitute medical advice. Please consult your treating physician for diagnosis and treatment."
}
If no specialist referral is clearly warranted, set specialistReferral to null.
If no further investigations needed, return empty array.`;

    try {
      const result = await this.aiService.complete(
        systemPrompt,
        userMessage,
        1200
      );
      const clean = result.text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      const match = clean.match(/\{[\s\S]*\}/);
      const interpretation = JSON.parse(match?.[0] ?? "{}");
      return interpretation;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI report interpretation failed: ${msg}`);

      // Rule-based fallback
      return {
        hasAbnormal: true,
        summary: `${abnormalResults.length} parameter(s) are outside the normal range. Please discuss these findings with your doctor.`,
        findings: abnormalResults.map((r) => ({
          parameter: r.name,
          value: `${r.value} ${r.unit}`,
          flag: r.flag,
          plainExplanation: `This value is ${r.flag === "HIGH" ? "higher" : "lower"} than the expected reference range (${r.refRange}).`,
          possibleCauses: [
            "Various factors can affect this parameter",
            "Consult your doctor for a proper evaluation",
          ],
        })),
        lifestyleAdvice: [
          "Maintain a balanced diet with adequate hydration",
          "Get regular exercise appropriate for your age and condition",
          "Ensure adequate sleep and stress management",
        ],
        furtherInvestigations: [],
        specialistReferral: null,
        disclaimer:
          "This interpretation is for educational purposes only and does not constitute medical advice. Please consult your treating physician for diagnosis and treatment.",
      };
    }
  }
}

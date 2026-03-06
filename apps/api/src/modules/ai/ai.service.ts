import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
}

export interface LeadScoreInput {
  source: string;
  note_count: number;
  created_at: string;
  last_activity_at?: string;
  expected_value?: number;
  has_email: boolean;
  has_organization: boolean;
  status: string;
}

export interface DoctorScoreInput {
  referral_count_30d: number;
  referral_count_90d: number;
  total_revenue: number;
  days_since_last_visit?: number;
  days_since_last_referral?: number;
  has_email: boolean;
  specialty_tier: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env["AI_SERVICE_URL"] ?? "http://localhost:8000";
  }

  async suggestTests(query: string, topK = 8) {
    try {
      const res = await axios.get(`${this.baseUrl}/suggest/tests`, {
        params: { q: query, top_k: topK },
        timeout: 3000,
      });
      return res.data as {
        query: string;
        suggestions: Array<{ test_name: string; relevance_score: number }>;
        matched_symptoms: Array<{ symptom: string; score: number }>;
        confidence: number;
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI test suggestion failed: ${msg}`);
      return { suggestions: [], matched_symptoms: [], confidence: 0, query };
    }
  }

  async scoreLeads(leads: LeadScoreInput[]) {
    try {
      const res = await axios.post(
        `${this.baseUrl}/leads/score/bulk`,
        { leads },
        { timeout: 5000 }
      );
      return (res.data as { scores: Array<{ score: number; grade: string; breakdown: Record<string, number>; recommendation: string }> }).scores;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI lead scoring failed: ${msg}`);
      return leads.map(() => ({ score: 50, grade: "WARM", breakdown: {}, recommendation: "" }));
    }
  }

  async predictTAT(
    testTurnaroundHours: number[],
    priority: string,
    collectionTime?: Date,
    pendingOrdersCount = 0
  ) {
    try {
      const res = await axios.post(
        `${this.baseUrl}/tat/predict`,
        {
          test_turnaround_hours: testTurnaroundHours,
          priority,
          collection_time: collectionTime?.toISOString(),
          pending_orders_count: pendingOrdersCount,
        },
        { timeout: 3000 }
      );
      return res.data as {
        predicted_hours: number;
        expected_at: string;
        expected_at_display: string;
        message: string;
        confidence: number;
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI TAT prediction failed: ${msg}`);
      const hours = Math.max(...testTurnaroundHours);
      return {
        predicted_hours: hours,
        expected_at: new Date(Date.now() + hours * 3600000).toISOString(),
        expected_at_display: "",
        message: `Expected in approximately ${hours} hours`,
        confidence: 0.5,
      };
    }
  }

  async scoreDoctors(doctors: DoctorScoreInput[]) {
    try {
      const res = await axios.post(
        `${this.baseUrl}/doctors/score/bulk`,
        { doctors },
        { timeout: 5000 }
      );
      return (res.data as { scores: Array<{ score: number; tier: string; visit_priority: string; breakdown: Record<string, number> }> }).scores;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI doctor scoring failed: ${msg}`);
      return doctors.map(() => ({ score: 50, tier: "SILVER", visit_priority: "MONITOR", breakdown: {} }));
    }
  }

  // ─── LLM Completion (provider-agnostic with fallback) ───────────
  async complete(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 1500,
  ): Promise<AIResponse> {
    const primary = process.env.AI_PRIMARY_PROVIDER ?? "anthropic";

    // Try primary provider
    try {
      if (primary === "anthropic" && process.env.ANTHROPIC_API_KEY) {
        return await this.callAnthropic(systemPrompt, userMessage, maxTokens);
      }
      if (primary === "openai" && process.env.OPENAI_API_KEY) {
        return await this.callOpenAI(systemPrompt, userMessage, maxTokens);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Primary AI provider failed: ${msg}. Trying fallback.`);
    }

    // Fallback provider
    const fallback = process.env.AI_FALLBACK_PROVIDER ?? "openai";
    try {
      if (fallback === "openai" && process.env.OPENAI_API_KEY) {
        return await this.callOpenAI(systemPrompt, userMessage, maxTokens);
      }
      if (fallback === "anthropic" && process.env.ANTHROPIC_API_KEY) {
        return await this.callAnthropic(systemPrompt, userMessage, maxTokens);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Fallback AI provider also failed: ${msg}`);
    }

    throw new Error("AI service temporarily unavailable");
  }

  private async callAnthropic(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): Promise<AIResponse> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    return { text, provider: "primary", model: "advanced" };
  }

  private async callOpenAI(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): Promise<AIResponse> {
    // Use fetch to avoid hard dependency on openai package
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    const result = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = result.choices[0]?.message?.content ?? "";
    return { text, provider: "fallback", model: "advanced" };
  }

  getAiStatus(): {
    primaryConfigured: boolean;
    fallbackConfigured: boolean;
    reportInterpretationEnabled: boolean;
    analyticsInsightsEnabled: boolean;
  } {
    return {
      primaryConfigured: !!process.env.ANTHROPIC_API_KEY,
      fallbackConfigured: !!process.env.OPENAI_API_KEY,
      reportInterpretationEnabled:
        process.env.AI_REPORT_INTERPRETATION_ENABLED === "true",
      analyticsInsightsEnabled:
        process.env.AI_ANALYTICS_INSIGHTS_ENABLED === "true",
    };
  }
}

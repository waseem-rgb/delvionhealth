import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class AiPackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async chat(
    tenantId: string,
    sessionId: string | null,
    userMessage: string,
    sessionType: string,
    context: {
      patientAge?: number;
      patientGender?: string;
      symptoms?: string;
      budget?: number;
    },
    userId: string,
  ) {
    // Get or create session
    let session = sessionId
      ? await this.prisma.aIPackageSession.findFirst({
          where: { id: sessionId, tenantId },
        })
      : null;

    const messages: Array<{ role: string; content: string }> = session
      ? JSON.parse(session.messages)
      : [];

    // Get test catalog for AI context
    const catalog = await this.prisma.testCatalog.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        department: true,
        sampleType: true,
        preparationNote: true,
      },
      orderBy: { name: "asc" },
    });

    const catalogSummary = catalog
      .map(
        (t) =>
          `${t.code}|${t.name}|₹${t.price}|${t.department}|${t.sampleType ?? ""}`,
      )
      .join("\n");

    messages.push({ role: "user", content: userMessage });

    // Build system prompt
    const systemPrompt = `You are DELViON AI, diagnostic lab package builder assistant.

Available test catalog:
${catalogSummary}

Rules:
- Only suggest tests from the catalog above (use exact test codes and IDs)
- Be concise and practical
- Consider gender and age appropriateness
- Flag fasting requirements from preparation notes
- When user wants to finalize, respond with JSON:
{
  "type": "PACKAGE_SUGGESTION",
  "packageName": "...",
  "description": "...",
  "tests": [{"id":"clxxx","code":"PT0242","name":"CBC","price":350}, ...],
  "totalMRP": 2500,
  "suggestedPrice": 1999,
  "fastingRequired": true,
  "targetGender": "ALL",
  "targetAgeMin": 18,
  "targetAgeMax": 60,
  "brochureText": "..."
}
- For all other messages, respond in natural conversational text
- Suggest existing test combinations when relevant
- Patient context: ${JSON.stringify(context)}`;

    // Build conversation for AI (only user/assistant messages)
    const aiMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
      )
      .join("\n\n");

    const response = await this.aiService.complete(
      systemPrompt,
      aiMessages,
      2000,
    );
    const assistantMessage = response.text;

    messages.push({ role: "assistant", content: assistantMessage });

    // Save/update session
    if (!session) {
      session = await this.prisma.aIPackageSession.create({
        data: {
          tenantId,
          sessionType,
          messages: JSON.stringify(messages),
          createdById: userId,
        },
      });
    } else {
      await this.prisma.aIPackageSession.update({
        where: { id: session.id },
        data: { messages: JSON.stringify(messages) },
      });
    }

    // Try to parse JSON suggestion
    let suggestion: Record<string, any> | null = null;
    try {
      const jsonMatch = assistantMessage.match(
        /\{[\s\S]*"type"\s*:\s*"PACKAGE_SUGGESTION"[\s\S]*\}/,
      );
      if (jsonMatch) suggestion = JSON.parse(jsonMatch[0]);
    } catch {
      // Not a JSON response, that's fine
    }

    // Enrich suggestion with real catalog prices
    if (suggestion?.tests?.length) {
      const aiTests = suggestion.tests as Array<{
        id?: string;
        code?: string;
        name?: string;
        price?: number;
      }>;
      const codes = aiTests.map((t) => t.code).filter(Boolean) as string[];
      const names = aiTests.map((t) => t.name).filter(Boolean) as string[];

      const realTests = await this.prisma.testCatalog.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            ...(codes.length ? [{ code: { in: codes } }] : []),
            ...(names.length
              ? [{ name: { in: names, mode: "insensitive" as const } }]
              : []),
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          sampleType: true,
          department: true,
          preparationNote: true,
        },
      });

      suggestion.tests = aiTests.map((aiTest) => {
        const match = realTests.find(
          (r) =>
            r.code === aiTest.code ||
            r.name.toLowerCase() === (aiTest.name ?? "").toLowerCase(),
        );
        return {
          id: match?.id ?? aiTest.id ?? null,
          code: match?.code ?? aiTest.code ?? "",
          name: match?.name ?? aiTest.name ?? "",
          price: match ? Number(match.price) : Number(aiTest.price ?? 0),
          sampleType: match?.sampleType ?? null,
          department: match?.department ?? null,
          preparationNote: match?.preparationNote ?? null,
          inCatalog: !!match,
        };
      });

      suggestion.totalMRP = (
        suggestion.tests as Array<{ price: number }>
      ).reduce((s: number, t: { price: number }) => s + t.price, 0);

      if (!suggestion.suggestedPrice) {
        suggestion.suggestedPrice = Math.round(
          (suggestion.totalMRP as number) * 0.85,
        );
      }
    }

    return {
      sessionId: session.id,
      message: assistantMessage,
      suggestion,
      isFinalized: !!suggestion,
    };
  }

  async saveFromAI(
    tenantId: string,
    body: {
      sessionId: string;
      suggestion: any;
      overrides?: { name?: string; price?: number; orgIds?: string };
    },
    userId: string,
  ) {
    const s = body.suggestion;
    const tests = s.tests || [];
    const testIds = tests.map((t: any) => t.id);
    const totalMRP =
      s.totalMRP ||
      tests.reduce((sum: number, t: any) => sum + Number(t.price), 0);
    const price = body.overrides?.price ?? s.suggestedPrice ?? totalMRP;
    const savings = totalMRP - price;
    const discountPct = totalMRP > 0 ? (savings / totalMRP) * 100 : 0;

    const count = await this.prisma.labPackage.count({ where: { tenantId } });
    const code = `PKG-${String(count + 1).padStart(4, "0")}`;

    const pkg = await this.prisma.labPackage.create({
      data: {
        tenantId,
        name: body.overrides?.name ?? s.packageName ?? "AI Package",
        code,
        category: "AI_GENERATED",
        description: s.description,
        aiGeneratedDesc: s.brochureText,
        testIds: JSON.stringify(testIds),
        testCount: testIds.length,
        mrpPrice: totalMRP,
        packagePrice: price,
        offerPrice: price,
        discountPct: Math.round(discountPct * 10) / 10,
        savingsAmt: Math.round(savings * 100) / 100,
        targetGender: s.targetGender ?? "ALL",
        targetAgeMin: s.targetAgeMin,
        targetAgeMax: s.targetAgeMax,
        fastingRequired: s.fastingRequired ?? false,
        assignedOrgIds: body.overrides?.orgIds,
        createdByAI: true,
        createdById: userId,
      },
    });

    // Update session with saved package id
    await this.prisma.aIPackageSession.update({
      where: { id: body.sessionId },
      data: {
        savedAs: pkg.id,
        resultTestIds: JSON.stringify(testIds),
      },
    });

    return pkg;
  }
}

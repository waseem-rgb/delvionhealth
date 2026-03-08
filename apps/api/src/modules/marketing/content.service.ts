import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tenantId: string, dto: {
    contentType: string;
    purpose: string;
    tone?: string;
    labName?: string;
    details?: string;
    language?: string;
  }) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
    const labName = dto.labName ?? tenant?.name ?? "Our Lab";
    const tone = dto.tone ?? "Professional";
    const language = dto.language ?? "English";

    let lengthGuide = "";
    if (dto.contentType === "WHATSAPP") lengthGuide = "Max 160 words, emoji-friendly.";
    else if (dto.contentType === "SMS") lengthGuide = "Max 160 characters total.";
    else if (dto.contentType === "EMAIL") lengthGuide = "Include a proper subject line and body.";

    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a marketing copywriter for ${labName}, a NABL-accredited diagnostic laboratory. Write concise, professional medical marketing content. Always include: lab name, key benefit, call-to-action, contact placeholder. Never make false medical claims. ${lengthGuide} Language: ${language}.`,
        messages: [
          {
            role: "user",
            content: `Content type: ${dto.contentType}. Purpose: ${dto.purpose}. Tone: ${tone}. Details: ${dto.details ?? "General marketing content"}.`,
          },
        ],
      });

      const generatedText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return { content: generatedText, contentType: dto.contentType };
    } catch {
      // Fallback if API key not configured
      return {
        content: this.getFallbackContent(dto.contentType, dto.purpose, labName),
        contentType: dto.contentType,
        fallback: true,
      };
    }
  }

  private getFallbackContent(type: string, purpose: string, labName: string): string {
    const templates: Record<string, string> = {
      WHATSAPP: `Hello! ${labName} brings you a special offer.\n\n${purpose}\n\nBook your appointment today!\nCall: [phone]\nVisit: [address]`,
      SMS: `${labName}: ${purpose}. Book now! Call [phone]`,
      EMAIL: `Subject: ${purpose} — ${labName}\n\nDear Patient,\n\n${purpose}\n\nWe look forward to serving you.\n\nRegards,\nTeam ${labName}`,
    };
    return templates[type] ?? templates.WHATSAPP!;
  }

  async getLibrary(tenantId: string, filters: { type?: string }) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.type) where.type = filters.type;

    return this.prisma.contentTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async saveToLibrary(tenantId: string, dto: {
    name: string;
    type: string;
    purpose?: string;
    channel?: string;
    content: string;
    language?: string;
  }) {
    return this.prisma.contentTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        purpose: dto.purpose,
        channel: dto.channel,
        content: dto.content,
        language: dto.language ?? "en",
      },
    });
  }

  async deleteFromLibrary(tenantId: string, id: string) {
    await this.prisma.contentTemplate.deleteMany({ where: { id, tenantId } });
    return { deleted: true };
  }
}

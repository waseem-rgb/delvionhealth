import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ContentService {
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async findAll(tenantId: string, channel?: string, status?: string, type?: string) {
    return this.prisma.contentStudioItem.findMany({
      where: {
        tenantId,
        ...(channel ? { channel: { has: channel } } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getCalendar(tenantId: string, month: number, year: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);
    return this.prisma.contentStudioItem.findMany({
      where: { tenantId, scheduledAt: { gte: from, lte: to } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async create(tenantId: string, userId: string, dto: Record<string, unknown>) {
    return this.prisma.contentStudioItem.create({
      data: { tenantId, createdBy: userId, ...(dto as any) },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    return this.prisma.contentStudioItem.update({ where: { id }, data: dto as any });
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.contentStudioItem.delete({ where: { id } });
  }

  async schedule(tenantId: string, id: string, scheduledAt: string) {
    return this.prisma.contentStudioItem.update({
      where: { id },
      data: { scheduledAt: new Date(scheduledAt), status: 'SCHEDULED' },
    });
  }

  async publish(tenantId: string, id: string) {
    return this.prisma.contentStudioItem.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async generateMultiChannelContent(dto: { brief: string; audience: string; tone: string; formats: string[] }) {
    const prompt = `Content brief: ${dto.brief}
Target audience: ${dto.audience}
Tone: ${dto.tone}
Generate for these formats: ${dto.formats.join(', ')}

Return ONLY valid JSON with each format as a key:
{
  "instagramPost": { "content": "...", "hashtags": ["..."], "imageDescription": "...", "bestTime": "..." },
  "facebookPost": { "content": "...", "hashtags": ["..."], "imageDescription": "...", "bestTime": "..." },
  "whatsappMessage": { "content": "...", "bestTime": "..." },
  "emailTemplate": { "subject": "...", "body": "...", "bestTime": "..." },
  "smsTemplate": { "content": "...", "bestTime": "..." },
  "healthTip": { "content": "...", "hashtags": ["..."] }
}
Only include the formats requested.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: `You are a creative director for DELViON Health diagnostic lab. Create engaging, compliant health marketing content. Brand voice: Professional yet approachable, health-focused, trust-building, Indian context. Return ONLY valid JSON.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in AI response');
    return JSON.parse(match[0]);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class CampaignsService {
  private anthropic: Anthropic;

  constructor(private prisma: PrismaService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async findAll(tenantId: string, type?: string, status?: string) {
    return this.prisma.campaign.findMany({
      where: {
        tenantId,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.campaign.findFirst({ where: { id, tenantId } });
  }

  async create(tenantId: string, userId: string, dto: Record<string, unknown>) {
    return this.prisma.campaign.create({
      data: { tenantId, createdById: userId, ...(dto as any) },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    return this.prisma.campaign.update({
      where: { id },
      data: dto as any,
    });
  }

  async delete(tenantId: string, id: string) {
    return this.prisma.campaign.delete({ where: { id } });
  }

  async launch(tenantId: string, id: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING' },
    });
  }

  async pause(tenantId: string, id: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async getAnalytics(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) return null;
    const leads = await this.prisma.campaignLead.findMany({ where: { campaignId: id } });
    const sent = leads.filter(l => l.sentAt).length;
    const delivered = leads.filter(l => l.deliveredAt).length;
    const opened = leads.filter(l => l.openedAt).length;
    const clicked = leads.filter(l => l.clickedAt).length;
    const converted = leads.filter(l => l.convertedAt).length;
    return { campaign, funnel: { total: leads.length, sent, delivered, opened, clicked, converted } };
  }

  async getRecipients(tenantId: string, id: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.campaignLead.findMany({ where: { campaignId: id }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.campaignLead.count({ where: { campaignId: id } }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async generateAiContent(dto: { channels: string[]; goal: string; userDescription: string }) {
    const prompt = `Generate healthcare marketing content for these channels: ${dto.channels.join(', ')}.
Campaign goal: ${dto.goal}
Description: ${dto.userDescription}

Return ONLY valid JSON (no other text):
{
  "sms": "max 160 chars",
  "whatsapp": "max 1000 chars, can use *bold* _italic_",
  "emailSubject": "max 60 chars",
  "emailBody": "HTML, professional, max 500 words",
  "instagramCaption": "max 300 chars with hashtags",
  "facebookPost": "max 500 chars"
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a healthcare marketing expert for DELViON Health, an Indian diagnostic lab. Create compelling, compliant medical marketing content. Always include clear value proposition, specific offer/info, call to action. Comply with Indian healthcare advertising guidelines. No false health claims. Include lab name: DELViON Health. Return ONLY valid JSON.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in AI response');
    return JSON.parse(match[0]);
  }

  async getBestScheduleTime(dto: { campaignType: string; targetAudience: string; channel: string }) {
    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: 'You are a healthcare marketing expert. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Recommend optimal send time for a ${dto.campaignType} campaign targeting ${dto.targetAudience} via ${dto.channel} in India. Return JSON: {"day":"string","time":"string","reasoning":"string","alternativeSlots":[{"day":"string","time":"string"}]}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { day: 'Tuesday', time: '10:00', reasoning: 'Best engagement for healthcare', alternativeSlots: [] };
  }

  async getStats(tenantId: string) {
    const [total, active, campaigns] = await Promise.all([
      this.prisma.campaign.count({ where: { tenantId } }),
      this.prisma.campaign.count({ where: { tenantId, status: { in: ['RUNNING', 'SCHEDULED'] } } }),
      this.prisma.campaign.findMany({ where: { tenantId }, select: { totalRecipients: true, revenue: true } }),
    ]);
    const totalReached = campaigns.reduce((s, c) => s + (c.totalRecipients || 0), 0);
    const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue || 0), 0);
    return { total, active, totalReached, totalRevenue };
  }
}

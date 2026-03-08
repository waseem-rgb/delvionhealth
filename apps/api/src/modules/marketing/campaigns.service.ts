import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters: { type?: string; status?: string }) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    return this.prisma.labCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true, doctorMembers: true } },
      },
    });
  }

  async getById(tenantId: string, id: string) {
    const campaign = await this.prisma.labCampaign.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { members: true, doctorMembers: true } },
      },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    return campaign;
  }

  async create(tenantId: string, dto: {
    name: string;
    type: string;
    channel: string;
    targetAudience: string;
    subject?: string;
    messageTemplate?: string;
    scheduledAt?: string;
  }, userId: string) {
    return this.prisma.labCampaign.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        channel: dto.channel,
        targetAudience: dto.targetAudience,
        subject: dto.subject,
        messageTemplate: dto.messageTemplate,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        createdById: userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Record<string, unknown>) {
    const campaign = await this.prisma.labCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException("Campaign not found");

    return this.prisma.labCampaign.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt as string) : undefined,
      },
    });
  }

  async launch(tenantId: string, id: string) {
    const campaign = await this.prisma.labCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.status === "RUNNING") throw new BadRequestException("Campaign already running");

    const memberCount = await this.prisma.campaignMember.count({ where: { campaignId: id } });
    const doctorMemberCount = await this.prisma.doctorCampaignMember.count({ where: { campaignId: id } });
    const totalTargeted = memberCount + doctorMemberCount;

    if (totalTargeted === 0) throw new BadRequestException("No members added to campaign");

    // Mark all members as SENT
    await this.prisma.campaignMember.updateMany({
      where: { campaignId: id, status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    });
    await this.prisma.doctorCampaignMember.updateMany({
      where: { campaignId: id, status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    });

    return this.prisma.labCampaign.update({
      where: { id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        totalTargeted,
        totalSent: totalTargeted,
        totalDelivered: totalTargeted,
      },
    });
  }

  async pause(tenantId: string, id: string) {
    const campaign = await this.prisma.labCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException("Campaign not found");

    return this.prisma.labCampaign.update({
      where: { id },
      data: { status: campaign.status === "PAUSED" ? "RUNNING" : "PAUSED" },
    });
  }

  async getMembers(tenantId: string, campaignId: string) {
    const [members, doctorMembers] = await this.prisma.$transaction([
      this.prisma.campaignMember.findMany({ where: { tenantId, campaignId } }),
      this.prisma.doctorCampaignMember.findMany({
        where: { tenantId, campaignId },
        include: { doctor: { select: { name: true, phone: true, specialization: true } } },
      }),
    ]);
    return { members, doctorMembers };
  }

  async addMembers(tenantId: string, campaignId: string, members: Array<{
    audienceType: string;
    audienceId: string;
    name?: string;
    phone?: string;
    email?: string;
  }>) {
    const campaign = await this.prisma.labCampaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException("Campaign not found");

    await this.prisma.campaignMember.createMany({
      data: members.map((m) => ({
        tenantId,
        campaignId,
        audienceType: m.audienceType,
        audienceId: m.audienceId,
        name: m.name,
        phone: m.phone,
        email: m.email,
      })),
    });

    return { added: members.length };
  }

  async addDoctorMembers(tenantId: string, campaignId: string, doctorIds: string[]) {
    const campaign = await this.prisma.labCampaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!campaign) throw new NotFoundException("Campaign not found");

    await this.prisma.doctorCampaignMember.createMany({
      data: doctorIds.map((doctorId) => ({ tenantId, campaignId, doctorId })),
      skipDuplicates: true,
    });

    return { added: doctorIds.length };
  }

  async updateMemberStatus(tenantId: string, campaignId: string, memberId: string, status: string) {
    await this.prisma.campaignMember.updateMany({
      where: { id: memberId, tenantId, campaignId },
      data: {
        status,
        respondedAt: status === "RESPONDED" ? new Date() : undefined,
      },
    });

    // Update campaign stats
    if (status === "RESPONDED") {
      await this.prisma.labCampaign.update({
        where: { id: campaignId },
        data: { totalResponded: { increment: 1 } },
      });
    } else if (status === "CONVERTED") {
      await this.prisma.labCampaign.update({
        where: { id: campaignId },
        data: { totalConverted: { increment: 1 } },
      });
    }

    return { updated: true };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<unknown[]> {
    return [];
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  async listApiKeys(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
    return keys;
  }

  async createApiKey(
    tenantId: string,
    userId: string,
    name: string,
    permissions: string[]
  ) {
    // Generate a cryptographically random key: dh_<64 hex chars>
    const rawKey = `dh_${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        createdById: userId,
        name,
        keyHash,
        keyPrefix,
        permissions,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });

    // Return full key only on creation — never stored in plain text
    return { ...apiKey, fullKey: rawKey };
  }

  async deleteApiKey(id: string, tenantId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!key) throw new NotFoundException("API key not found");

    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  }
}

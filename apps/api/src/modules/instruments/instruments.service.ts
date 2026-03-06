import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { InstrumentGatewayService } from "./instrument-gateway.service";
import type { InstrumentStatus, ConnectionProtocol, TempUnit } from "@prisma/client";

export interface CreateConnectionDto {
  protocol: ConnectionProtocol;
  host: string;
  port: number;
  apiKey?: string;
  isActive?: boolean;
}

export interface UpdateConnectionDto extends Partial<CreateConnectionDto> {}

export interface CreateLoggerDto {
  name: string;
  serialNumber?: string;
  location?: string;
  branchId?: string;
  unit?: TempUnit;
  alertMin: number;
  alertMax: number;
}

@Injectable()
export class InstrumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: InstrumentGatewayService,
  ) {}

  async findAll(tenantId: string, query: { status?: string; limit?: number } = {}) {
    return this.prisma.instrument.findMany({
      where: {
        tenantId,
        ...(query.status && query.status !== "ALL" ? { status: query.status as InstrumentStatus } : {}),
      },
      include: {
        branch: { select: { name: true } },
        connections: { select: { id: true, protocol: true, status: true, isActive: true } },
      },
      orderBy: { name: "asc" },
      take: query.limit ?? 50,
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.instrument.findFirst({
      where: { id, tenantId },
      include: { branch: { select: { name: true } }, connections: true },
    });
  }

  // ─── Connections ───────────────────────────────────────────────────────────

  async findConnections(instrumentId: string, tenantId: string) {
    return this.prisma.instrumentConnection.findMany({
      where: { instrumentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConnection(instrumentId: string, dto: CreateConnectionDto, tenantId: string) {
    const conn = await this.prisma.instrumentConnection.create({
      data: { tenantId, instrumentId, ...dto },
    });
    if (conn.isActive) {
      await this.gateway.startServer(conn).catch(() => {});
    }
    return conn;
  }

  async updateConnection(connId: string, dto: UpdateConnectionDto, tenantId: string) {
    const existing = await this.prisma.instrumentConnection.findFirst({ where: { id: connId, tenantId } });
    if (!existing) throw new NotFoundException('Connection not found');

    // Stop old server before updating
    await this.gateway.stopServer(connId).catch(() => {});

    const updated = await this.prisma.instrumentConnection.update({
      where: { id: connId },
      data: dto,
    });

    if (updated.isActive) {
      await this.gateway.startServer(updated).catch(() => {});
    }
    return updated;
  }

  async deleteConnection(connId: string, tenantId: string) {
    const existing = await this.prisma.instrumentConnection.findFirst({ where: { id: connId, tenantId } });
    if (!existing) throw new NotFoundException('Connection not found');
    await this.gateway.stopServer(connId).catch(() => {});
    await this.prisma.instrumentConnection.delete({ where: { id: connId } });
    return { deleted: true };
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  async findMessages(tenantId: string, query: {
    connectionId?: string;
    from?: string;
    to?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.connectionId ? { connectionId: query.connectionId } : {}),
      ...(query.status ? { status: query.status as 'RAW' | 'PARSED' | 'POSTED' | 'FAILED' } : {}),
      ...(query.from || query.to ? {
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.instrumentMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.instrumentMessage.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getMessageStats(tenantId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = await this.prisma.instrumentMessage.groupBy({
      by: ['status'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    return stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count._all }), {} as Record<string, number>);
  }

  // ─── Temperature Loggers ───────────────────────────────────────────────────

  async findLoggers(tenantId: string) {
    const loggers = await this.prisma.temperatureLogger.findMany({
      where: { tenantId, isActive: true },
      include: {
        readings: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });
    return loggers.map(l => ({
      ...l,
      latestReading: l.readings[0] ?? null,
      readings: undefined,
    }));
  }

  async createLogger(dto: CreateLoggerDto, tenantId: string) {
    const apiKey = `dv-temp-${Math.random().toString(36).slice(2, 18)}`;
    return this.prisma.temperatureLogger.create({
      data: { tenantId, apiKey, ...dto },
    });
  }

  async updateLogger(id: string, dto: Partial<CreateLoggerDto>, tenantId: string) {
    const existing = await this.prisma.temperatureLogger.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Temperature logger not found');
    return this.prisma.temperatureLogger.update({ where: { id }, data: dto });
  }

  async ingestReading(apiKey: string, temperature: number, unit: TempUnit, recordedAt: Date) {
    const logger = await this.prisma.temperatureLogger.findUnique({ where: { apiKey, isActive: true } });
    if (!logger) return null;

    const isAlert = temperature < logger.alertMin || temperature > logger.alertMax;
    const reading = await this.prisma.temperatureReading.create({
      data: { loggerId: logger.id, temperature, unit, recordedAt, isAlert },
    });
    return { logger, reading, isAlert };
  }

  async findReadings(loggerId: string, tenantId: string, from?: string, to?: string, limit = 500) {
    // Verify logger belongs to tenant
    const logger = await this.prisma.temperatureLogger.findFirst({ where: { id: loggerId, tenantId } });
    if (!logger) throw new NotFoundException('Logger not found');

    return this.prisma.temperatureReading.findMany({
      where: {
        loggerId,
        ...(from || to ? {
          recordedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      orderBy: { recordedAt: 'asc' },
      take: Math.min(limit, 1000),
    });
  }

  async getAlertSummary(loggerId: string, tenantId: string, from?: string, to?: string) {
    const logger = await this.prisma.temperatureLogger.findFirst({ where: { id: loggerId, tenantId } });
    if (!logger) throw new NotFoundException('Logger not found');

    return this.prisma.temperatureReading.count({
      where: {
        loggerId,
        isAlert: true,
        ...(from || to ? {
          recordedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
    });
  }
}

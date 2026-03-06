import * as net from 'net';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AstmParser } from './astm.parser';
import { Hl7Parser } from './hl7.parser';
import { ResultsService } from '../results/results.service';
import type { InstrumentConnection } from '@prisma/client';

interface InstrumentResultEvent {
  tenantId: string;
  connectionId: string;
  messageId: string;
  patientId: string;
  orderId: string;
  results: Array<{ testCode: string; value: string; unit: string }>;
}

@Injectable()
export class InstrumentGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstrumentGatewayService.name);
  private readonly servers = new Map<string, net.Server>();
  private readonly astm = new AstmParser();
  private readonly hl7 = new Hl7Parser();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly resultsService: ResultsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const connections = await this.prisma.instrumentConnection.findMany({
        where: { isActive: true },
      });
      for (const conn of connections) {
        await this.startServer(conn);
      }
      this.logger.log(`Started ${connections.length} instrument connection(s)`);
    } catch (err) {
      this.logger.warn(`GatewayService init error: ${err}`);
    }
  }

  onModuleDestroy(): void {
    for (const [id, server] of this.servers.entries()) {
      server.close();
      this.servers.delete(id);
    }
  }

  async startServer(conn: InstrumentConnection): Promise<void> {
    if (this.servers.has(conn.id)) return;

    const server = net.createServer((socket) => {
      this.logger.log(`[${conn.id}] Client connected from ${socket.remoteAddress}`);

      // Update connection status to CONNECTED
      this.prisma.instrumentConnection.update({
        where: { id: conn.id },
        data: { status: 'CONNECTED', lastConnectedAt: new Date() },
      }).catch(() => {});

      let buffer = Buffer.alloc(0);

      socket.on('data', async (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        // ASTM: ENQ handshake
        if (conn.protocol === 'ASTM' && this.astm.isEnq(buffer)) {
          socket.write(this.astm.ackBuffer());
          buffer = Buffer.alloc(0);
          return;
        }
        // ASTM: EOT signals end of transmission
        if (conn.protocol === 'ASTM' && this.astm.isEot(buffer)) {
          buffer = Buffer.alloc(0);
          return;
        }

        // HL7: wait for complete MLLP message (ends with FS+CR)
        if (conn.protocol === 'HL7_MLLP') {
          if (!buffer.includes(0x1c)) return; // incomplete
        }

        await this.handleMessage(conn, buffer, socket);
        buffer = Buffer.alloc(0);
      });

      socket.on('end', () => {
        this.prisma.instrumentConnection.update({
          where: { id: conn.id },
          data: { status: 'IDLE' },
        }).catch(() => {});
      });

      socket.on('error', (err) => {
        this.logger.error(`[${conn.id}] Socket error: ${err.message}`);
        this.prisma.instrumentConnection.update({
          where: { id: conn.id },
          data: { status: 'ERROR' },
        }).catch(() => {});
      });
    });

    server.on('error', (err) => {
      this.logger.error(`[${conn.id}] Server error: ${err.message}`);
      this.prisma.instrumentConnection.update({
        where: { id: conn.id },
        data: { status: 'ERROR' },
      }).catch(() => {});
    });

    server.listen(conn.port, conn.host || '0.0.0.0', () => {
      this.logger.log(`[${conn.id}] Listening on ${conn.host || '0.0.0.0'}:${conn.port} (${conn.protocol})`);
    });

    this.servers.set(conn.id, server);
  }

  async stopServer(connectionId: string): Promise<void> {
    const server = this.servers.get(connectionId);
    if (server) {
      server.close();
      this.servers.delete(connectionId);
    }
    await this.prisma.instrumentConnection.update({
      where: { id: connectionId },
      data: { status: 'DISCONNECTED' },
    }).catch(() => {});
  }

  private async handleMessage(conn: InstrumentConnection, buffer: Buffer, socket: net.Socket): Promise<void> {
    // Create RAW message record
    const rawMsg = await this.prisma.instrumentMessage.create({
      data: {
        tenantId: conn.tenantId,
        connectionId: conn.id,
        direction: 'INBOUND',
        rawPayload: buffer.toString('ascii'),
        status: 'RAW',
      },
    }).catch(() => null);

    try {
      let parsed: {
        messageId: string;
        patientId: string;
        orderId: string;
        results: Array<{ testCode: string; value: string; unit: string; referenceRange: string; flags: string }>;
      } | null = null;

      if (conn.protocol === 'ASTM') {
        parsed = this.astm.parse(buffer);
        if (parsed) socket.write(this.astm.ackBuffer());
      } else if (conn.protocol === 'HL7_MLLP') {
        parsed = this.hl7.parse(buffer);
        if (parsed) socket.write(this.hl7.ack(parsed.messageId));
      }

      if (!parsed || !rawMsg) return;

      await this.prisma.instrumentMessage.update({
        where: { id: rawMsg.id },
        data: {
          status: 'PARSED',
          parsedJson: parsed as object,
          resultCount: parsed.results.length,
        },
      });

      this.eventEmitter.emit('instrument.result', {
        tenantId: conn.tenantId,
        connectionId: conn.id,
        messageId: rawMsg.id,
        patientId: parsed.patientId,
        orderId: parsed.orderId,
        results: parsed.results,
      } satisfies InstrumentResultEvent);

    } catch (err) {
      if (rawMsg) {
        await this.prisma.instrumentMessage.update({
          where: { id: rawMsg.id },
          data: { status: 'FAILED', errorMessage: String(err) },
        }).catch(() => {});
      }
      this.logger.error(`[${conn.id}] Parse error: ${err}`);
    }
  }

  @OnEvent('instrument.result')
  async handleResultEvent(event: InstrumentResultEvent): Promise<void> {
    try {
      // Try to match the instrument result to an internal order
      // Strategy: find pending order items whose test catalog code matches
      const testCodes = event.results.map(r => r.testCode).filter(Boolean);
      if (!testCodes.length) return;

      // Find test catalog entries matching these codes
      const catalogs = await this.prisma.testCatalog.findMany({
        where: {
          tenantId: event.tenantId,
          OR: [
            { code: { in: testCodes } },
            { name: { in: testCodes } },
            { loincCode: { in: testCodes } },
          ],
        },
        select: { id: true, code: true, name: true, loincCode: true },
      });

      if (!catalogs.length) {
        this.logger.warn(`[instrument.result] No test catalog matches for codes: ${testCodes.join(', ')}`);
        return;
      }

      const catalogIds = catalogs.map(c => c.id);

      // Find pending OrderItems for these test catalog IDs.
      // Note: OrderItem does not have tenantId — filter through order.tenantId
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          testCatalogId: { in: catalogIds },
          order: {
            tenantId: event.tenantId,
            status: { in: ['SAMPLE_COLLECTED', 'IN_PROCESSING', 'RESULTED'] },
          },
        },
        include: {
          order: {
            include: {
              samples: {
                where: { status: { in: ['COLLECTED', 'RECEIVED', 'PROCESSING'] } },
                take: 1,
              },
            },
          },
        },
        take: 20,
      });

      if (!orderItems.length) {
        this.logger.warn(`[instrument.result] No matching order items found`);
        return;
      }

      // Map results to CreateResultDto
      const resultDtos = orderItems.flatMap(item => {
        const catalog = catalogs.find(c => c.id === item.testCatalogId);
        const sample = item.order.samples[0];
        if (!catalog || !sample) return [];

        const instrResult = event.results.find(r =>
          r.testCode === catalog.code ||
          r.testCode === catalog.name ||
          r.testCode === catalog.loincCode
        );
        if (!instrResult) return [];

        const numericVal = parseFloat(instrResult.value);

        return [{
          orderItemId: item.id,
          sampleId: sample.id,
          value: instrResult.value,
          numericValue: !isNaN(numericVal) ? numericVal : undefined,
          unit: instrResult.unit || undefined,
          isDraft: false,
        }];
      });

      if (!resultDtos.length) return;

      // Use a system user ID — find first admin user for this tenant
      const adminUser = await this.prisma.user.findFirst({
        where: {
          tenantId: event.tenantId,
          role: { in: ['TENANT_ADMIN', 'LAB_MANAGER'] },
          isActive: true,
        },
        select: { id: true },
      });

      if (!adminUser) return;

      await this.resultsService.bulkCreate({ results: resultDtos }, event.tenantId, adminUser.id);

      // Mark the message as POSTED
      await this.prisma.instrumentMessage.update({
        where: { id: event.messageId },
        data: { status: 'POSTED', processedAt: new Date(), resultCount: resultDtos.length },
      }).catch(() => {});

      this.logger.log(`[instrument.result] Posted ${resultDtos.length} results for tenant ${event.tenantId}`);
    } catch (err) {
      this.logger.error(`[instrument.result] Auto-post error: ${err}`);
    }
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Server, Socket } from "socket.io";
import type { JwtPayload } from "@delvion/types";

interface SocketData {
  userId: string;
  tenantId: string;
  role: string;
}

@Injectable()
@WebSocketGateway({
  namespace: "/realtime",
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth["token"] as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>("JWT_SECRET", "changeme"),
      });

      (client.data as SocketData) = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
      };

      // Join tenant room for broadcast events
      await client.join(`tenant:${payload.tenantId}`);
      // Join personal room for user-specific events
      await client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // Socket.io auto-removes client from all rooms on disconnect
  }

  /** Broadcast an event to all connected users of a tenant */
  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  /** Send an event to a specific user */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Emit a critical alert (abnormal/critical result) to all tenant users */
  emitCriticalAlert(
    tenantId: string,
    alert: {
      message: string;
      orderId?: string;
      sampleId?: string;
      patientName?: string;
    }
  ): void {
    this.server.to(`tenant:${tenantId}`).emit("critical_alert", {
      ...alert,
      timestamp: new Date().toISOString(),
    });
  }

  /** Emit an order status change to all tenant users */
  emitOrderUpdate(
    tenantId: string,
    payload: { orderId: string; orderNumber: string; status: string }
  ): void {
    this.server.to(`tenant:${tenantId}`).emit("order_update", payload);
  }

  /** Emit a sample status change to all tenant users */
  emitSampleUpdate(
    tenantId: string,
    payload: { sampleId: string; barcodeId: string; status: string }
  ): void {
    this.server.to(`tenant:${tenantId}`).emit("sample_update", payload);
  }

  /** Send an in-app notification to a specific user */
  emitNotification(
    userId: string,
    payload: { title: string; body: string; type: string }
  ): void {
    this.server.to(`user:${userId}`).emit("notification", payload);
  }
}

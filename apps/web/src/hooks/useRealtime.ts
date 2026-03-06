"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

// ─────────────────────────────────────────────
// Payload types
// ─────────────────────────────────────────────

export interface CriticalAlertPayload {
  message: string;
  orderId?: string;
  sampleId?: string;
  patientName?: string;
  timestamp: string;
}

export interface OrderUpdatePayload {
  orderId: string;
  orderNumber: string;
  status: string;
}

export interface SampleUpdatePayload {
  sampleId: string;
  barcodeId: string;
  status: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
}

// Socket.io event map — handlers typed as functions (required by Socket.io generics)
type ServerToClientEvents = {
  critical_alert: (data: CriticalAlertPayload) => void;
  order_update: (data: OrderUpdatePayload) => void;
  sample_update: (data: SampleUpdatePayload) => void;
  notification: (data: NotificationPayload) => void;
};

type TypedSocket = Socket<ServerToClientEvents>;

// ─────────────────────────────────────────────
// Shared singleton socket
// ─────────────────────────────────────────────

let sharedSocket: TypedSocket | null = null;
let socketRefCount = 0;

function getOrCreateSocket(token: string): TypedSocket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(`${WS_URL}/realtime`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
    }) as TypedSocket;
  }
  return sharedSocket;
}

function acquireSocket(token: string): TypedSocket {
  const socket = getOrCreateSocket(token);
  socketRefCount += 1;
  return socket;
}

function releaseSocket(): void {
  socketRefCount = Math.max(0, socketRefCount - 1);
  if (socketRefCount === 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
}

// ─────────────────────────────────────────────
// Concrete event hooks (avoid Socket.io generic inference issues)
// ─────────────────────────────────────────────

function useRealtimeEvent<T>(
  event: keyof ServerToClientEvents,
  subscribe: (socket: TypedSocket, handler: (data: T) => void) => void,
  unsubscribe: (socket: TypedSocket, handler: (data: T) => void) => void,
  handler: (data: T) => void
): void {
  const { user } = useAuthStore();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const stableHandler = useCallback(
    (data: T) => handlerRef.current(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally stable
    []
  );

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("delvion_access_token");
    if (!token) return;

    const socket = acquireSocket(token);
    subscribe(socket, stableHandler);

    return () => {
      unsubscribe(socket, stableHandler);
      releaseSocket();
    };
    // event is constant per hook call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, event, subscribe, unsubscribe, stableHandler]);
}

/** Listen for critical alerts (abnormal / critical lab results) */
export function useCriticalAlerts(
  handler: (alert: CriticalAlertPayload) => void
): void {
  const sub = useCallback(
    (s: TypedSocket, h: (d: CriticalAlertPayload) => void) =>
      s.on("critical_alert", h),
    []
  );
  const unsub = useCallback(
    (s: TypedSocket, h: (d: CriticalAlertPayload) => void) =>
      s.off("critical_alert", h),
    []
  );
  useRealtimeEvent("critical_alert", sub, unsub, handler);
}

/** Listen for order status changes */
export function useOrderUpdates(
  handler: (update: OrderUpdatePayload) => void
): void {
  const sub = useCallback(
    (s: TypedSocket, h: (d: OrderUpdatePayload) => void) =>
      s.on("order_update", h),
    []
  );
  const unsub = useCallback(
    (s: TypedSocket, h: (d: OrderUpdatePayload) => void) =>
      s.off("order_update", h),
    []
  );
  useRealtimeEvent("order_update", sub, unsub, handler);
}

/** Listen for sample status changes */
export function useSampleUpdates(
  handler: (update: SampleUpdatePayload) => void
): void {
  const sub = useCallback(
    (s: TypedSocket, h: (d: SampleUpdatePayload) => void) =>
      s.on("sample_update", h),
    []
  );
  const unsub = useCallback(
    (s: TypedSocket, h: (d: SampleUpdatePayload) => void) =>
      s.off("sample_update", h),
    []
  );
  useRealtimeEvent("sample_update", sub, unsub, handler);
}

/** Listen for in-app notifications pushed by the server */
export function useNotifications(
  handler: (notification: NotificationPayload) => void
): void {
  const sub = useCallback(
    (s: TypedSocket, h: (d: NotificationPayload) => void) =>
      s.on("notification", h),
    []
  );
  const unsub = useCallback(
    (s: TypedSocket, h: (d: NotificationPayload) => void) =>
      s.off("notification", h),
    []
  );
  useRealtimeEvent("notification", sub, unsub, handler);
}

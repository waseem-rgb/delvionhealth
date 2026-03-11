"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wifi,
  WifiOff,
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  Plug,
  Send,
  Bot,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Connection {
  id: string;
  protocol: string;
  host: string;
  port: number;
  status: string;
  isActive: boolean;
  apiKey: string | null;
}

interface Instrument {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: string;
  branch: { name: string };
  connections: Connection[];
}

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInterfaceDirection(connections: Connection[]): {
  label: string;
  color: string;
  icon: React.ElementType;
} {
  if (connections.length === 0) {
    return { label: "Not Configured", color: "bg-slate-100 text-slate-500", icon: Plug };
  }
  // Heuristic: ASTM/HL7 are bidirectional; HTTP is typically send-only
  const protocols = connections.map((c) => c.protocol);
  if (protocols.some((p) => p === "ASTM" || p === "HL7_MLLP")) {
    return { label: "Bidirectional", color: "bg-purple-100 text-purple-700", icon: ArrowLeftRight };
  }
  return { label: "Send Only", color: "bg-blue-100 text-blue-700", icon: ArrowUpFromLine };
}

function getProtocolLabel(protocol: string) {
  const map: Record<string, { label: string; color: string }> = {
    ASTM:     { label: "ASTM",    color: "bg-amber-100 text-amber-700" },
    HL7_MLLP: { label: "HL7",     color: "bg-purple-100 text-purple-700" },
    HTTP:     { label: "TCP/IP",  color: "bg-slate-100 text-slate-600" },
    SERIAL:   { label: "Serial",  color: "bg-green-100 text-green-700" },
  };
  return map[protocol] ?? { label: protocol, color: "bg-slate-100 text-slate-600" };
}

// ── Instrument Interface Card ─────────────────────────────────────────────────

function InstrumentInterfaceCard({ instrument }: { instrument: Instrument }) {
  const connections = instrument.connections ?? [];
  const direction = getInterfaceDirection(connections);
  const DirectionIcon = direction.icon;

  const testMutation = useMutation({
    mutationFn: () => api.post(`/instruments/${instrument.id}/test`, {}),
    onSuccess: (res) => {
      toast.success(`Interface test passed for ${instrument.name}`, {
        description: res.data?.message ?? "Connection verified successfully.",
      });
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 404) {
        toast.info("Test endpoint not available", {
          description: "The instrument test endpoint has not been configured yet.",
        });
      } else {
        toast.error(`Interface test failed for ${instrument.name}`, {
          description: err?.response?.data?.message ?? "Could not reach instrument.",
        });
      }
    },
  });

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm truncate">{instrument.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {instrument.manufacturer} · {instrument.model}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${direction.color}`}
        >
          <DirectionIcon className="w-3 h-3" />
          {direction.label}
        </span>
      </div>

      {/* Connections */}
      {connections.length === 0 ? (
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
          <WifiOff className="w-4 h-4 text-slate-300" />
          <span className="text-xs text-slate-400">No connections configured</span>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => {
            const proto = getProtocolLabel(conn.protocol);
            const isConnected = conn.status === "CONNECTED" || conn.isActive;
            return (
              <div key={conn.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <WifiOff className="w-4 h-4 text-slate-300 shrink-0" />
                )}
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${proto.color}`}
                >
                  {proto.label}
                </span>
                <span className="font-mono text-xs text-slate-600 truncate flex-1">
                  {conn.host}:{conn.port}
                </span>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                    isConnected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {conn.status ?? "Idle"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <ArrowUpFromLine className="w-3 h-3" />
            Last Sent
          </div>
          <p className="text-slate-600 font-medium">—</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <ArrowDownToLine className="w-3 h-3" />
            Last Received
          </div>
          <p className="text-slate-600 font-medium">—</p>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-1 border-t border-slate-50">
        <button
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#0D7E8A]/10 hover:bg-[#0D7E8A]/20 text-[#0D7E8A] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {testMutation.isPending ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
              Testing...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Test Interface
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── AI Assistant Panel ────────────────────────────────────────────────────────

function AiAssistantPanel() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      api.post("/instruments/ai-interface", { message }).then((r) => r.data),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data?.response ?? data?.message ?? JSON.stringify(data) },
      ]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 404 || status === 500) {
        setAiUnavailable(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "AI assistant is not available at this time. Please configure the AI service or contact support.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Unable to process your request. Please try again.",
          },
        ]);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
  });

  function handleSend() {
    const msg = input.trim();
    if (!msg || sendMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    sendMutation.mutate(msg);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="w-80 shrink-0 bg-white border border-slate-100 rounded-xl flex flex-col sticky top-4 max-h-[calc(100vh-180px)]">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#0D7E8A]/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-[#0D7E8A]" />
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm">Interface Setup Assistant</p>
          <p className="text-xs text-slate-400">AI-powered configuration help</p>
        </div>
      </div>

      {/* AI Unavailable Banner */}
      {aiUnavailable && (
        <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          AI not available — service not configured
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              Describe your instrument and I'll help configure the interface...
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#0D7E8A] text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-500 flex items-center gap-1.5">
              <span className="animate-pulse">Thinking</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe your instrument and I'll help configure the interface..."
            rows={2}
            className="flex-1 resize-none border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30 placeholder-slate-300"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="px-3 py-2 bg-[#0D7E8A] text-white rounded-lg hover:bg-[#0a6b76] disabled:opacity-40 transition-colors self-end"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-300 mt-1.5">Press Enter to send, Shift+Enter for newline</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InstrumentInterfacesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["instruments-interfaces"],
    queryFn: () =>
      api
        .get("/instruments?limit=100")
        .then((r) => {
          const raw = r.data;
          // API may return { data: [...] } or plain array
          if (Array.isArray(raw)) return raw as Instrument[];
          if (raw?.data) return raw.data as Instrument[];
          return [] as Instrument[];
        })
        .catch(() => [] as Instrument[]),
    retry: 1,
    staleTime: 30000,
  });

  const instruments = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instrument Interfaces"
        subtitle="Two-way interfacing configuration"
        actions={null}
      />

      <div className="flex gap-6 items-start">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse">
                  <div className="h-5 w-3/4 bg-slate-200 rounded mb-3" />
                  <div className="h-4 w-1/2 bg-slate-100 rounded mb-4" />
                  <div className="h-16 bg-slate-50 rounded-lg mb-3" />
                  <div className="h-8 bg-slate-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : instruments.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
              <Plug className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No instruments found</p>
              <p className="text-slate-300 text-xs mt-1">
                Add instruments to configure their interfaces
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {instruments.map((inst) => (
                <InstrumentInterfaceCard key={inst.id} instrument={inst} />
              ))}
            </div>
          )}
        </div>

        {/* AI Assistant Panel */}
        <AiAssistantPanel />
      </div>
    </div>
  );
}

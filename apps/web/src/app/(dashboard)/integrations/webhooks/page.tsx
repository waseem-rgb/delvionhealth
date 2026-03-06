import type { Metadata } from "next";

export const metadata: Metadata = { title: "Webhook Logs" };

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Webhook Logs</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
        Webhook configurations, delivery logs, and retry management
      </div>
    </div>
  );
}

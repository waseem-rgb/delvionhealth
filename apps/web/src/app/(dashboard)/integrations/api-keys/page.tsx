import type { Metadata } from "next";

export const metadata: Metadata = { title: "API Keys" };

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
        Generate and manage API keys for external integrations
      </div>
    </div>
  );
}

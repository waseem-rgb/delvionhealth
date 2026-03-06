"use client";

import Link from "next/link";
import { Key, Webhook, Link2, ArrowRight, XCircle } from "lucide-react";

const INTEGRATIONS = [
  { name: "HL7 FHIR", desc: "Connect to hospital information systems via FHIR R4 standard", status: "Not Connected", icon: "🏥" },
  { name: "Aarogya Setu / ABHA", desc: "Link patient records with Ayushman Bharat Health Accounts", status: "Not Connected", icon: "🇮🇳" },
  { name: "GST Portal", desc: "Automated GST return filing and reconciliation", status: "Not Connected", icon: "📊" },
  { name: "WhatsApp Business", desc: "Send reports and updates via WhatsApp notifications", status: "Not Connected", icon: "💬" },
  { name: "Razorpay", desc: "Online payment gateway for patient portal bookings", status: "Not Connected", icon: "💳" },
  { name: "Eka Care", desc: "ABDM-compliant health record sharing", status: "Not Connected", icon: "🔗" },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Connected Systems</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage integrations, API keys, and webhook configurations
        </p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/integrations/api-keys"
          className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-sm">API Keys</div>
              <div className="text-xs text-slate-400">Manage access tokens</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
        </Link>
        <Link
          href="/integrations/webhooks"
          className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Webhook className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-sm">Webhooks</div>
              <div className="text-xs text-slate-400">Real-time event notifications</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
        </Link>
      </div>

      {/* External integrations */}
      <div>
        <h2 className="font-semibold text-slate-700 text-sm mb-3">
          Available Integrations
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTEGRATIONS.map((integ) => (
            <div
              key={integ.name}
              className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-2 mb-3">
                <span className="text-2xl">{integ.icon}</span>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {integ.name}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <XCircle className="w-3 h-3 text-slate-300" />
                    <span className="text-xs text-slate-400">{integ.status}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">{integ.desc}</p>
              <button className="w-full py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                <Link2 className="w-3 h-3" /> Connect
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-100 rounded-xl p-5 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-800">
            Need a custom integration?
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            Use our REST API + webhooks to build any custom workflow
          </div>
        </div>
        <Link
          href="/integrations/api-keys"
          className="flex items-center gap-1.5 text-sm text-blue-700 font-medium hover:underline"
        >
          Get API Key <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

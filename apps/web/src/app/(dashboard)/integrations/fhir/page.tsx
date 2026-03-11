"use client";

import { useState, useCallback } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import {
  Search,
  ClipboardCopy,
  CheckCheck,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Users,
  Shield,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FhirResource {
  resourceType: string;
  [key: string]: unknown;
}

interface FhirBundle {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: FhirResource }>;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
    >
      {copied ? (
        <>
          <CheckCheck className="w-3.5 h-3.5 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <ClipboardCopy className="w-3.5 h-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

// ── JsonViewer ────────────────────────────────────────────────────────────────

function JsonViewer({ data }: { data: unknown }) {
  const text = prettyJson(data);
  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10">
        <CopyButton text={text} />
      </div>
      <pre className="bg-white text-green-300 rounded-xl p-4 pt-10 text-xs font-mono overflow-x-auto overflow-y-auto max-h-[500px] leading-relaxed whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  );
}

// ── ErrorBox ──────────────────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Tab 1: Patient Lookup ─────────────────────────────────────────────────────

function PatientLookupTab() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"identifier" | "name">("identifier");
  const [result, setResult] = useState<FhirResource | FhirBundle | null>(null);
  const [capabilityStmt, setCapabilityStmt] = useState<Record<string, unknown> | null>(null);
  const [capabilityOpen, setCapabilityOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const param = searchType === "identifier" ? `identifier=${query}` : `name=${query}`;
      const res = await api.get(`/fhir/Patient?${param}`);
      setResult(res.data as FhirResource | FhirBundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch FHIR Patient resource.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [query, searchType]);

  const handleLoadCapability = useCallback(async () => {
    if (capabilityStmt) {
      setCapabilityOpen((v) => !v);
      return;
    }
    setCapabilityLoading(true);
    try {
      const res = await api.get("/fhir/metadata");
      setCapabilityStmt(res.data);
      setCapabilityOpen(true);
    } catch {
      setCapabilityStmt({ error: "Failed to load CapabilityStatement" });
      setCapabilityOpen(true);
    } finally {
      setCapabilityLoading(false);
    }
  }, [capabilityStmt]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(["identifier", "name"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSearchType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  searchType === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "identifier" ? "MRN / Identifier" : "Name"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "identifier" ? "Enter MRN or identifier…" : "Enter patient name…"}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D7E8A] text-slate-900 rounded-xl text-sm font-medium hover:bg-[#0a6b76] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {error && <ErrorBox message={error} />}
        {result && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              FHIR Response — {(result as FhirResource).resourceType}
            </p>
            <JsonViewer data={result} />
          </div>
        )}
      </div>

      {/* CapabilityStatement */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
        <button
          onClick={handleLoadCapability}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" />
            CapabilityStatement
            <span className="text-xs font-normal text-slate-500">GET /fhir/metadata</span>
          </div>
          <div className="flex items-center gap-2">
            {capabilityLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
            {capabilityOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </div>
        </button>
        {capabilityOpen && capabilityStmt && (
          <div className="border-t border-slate-100 p-4">
            <JsonViewer data={capabilityStmt} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Diagnostic Report ──────────────────────────────────────────────────

function DiagnosticReportTab() {
  const [orderId, setOrderId] = useState("");
  const [result, setResult] = useState<FhirResource | FhirBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = useCallback(async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.get(`/fhir/DiagnosticReport?subject=${orderId}`);
      setResult(res.data as FhirResource | FhirBundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch DiagnosticReport.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Fetch DiagnosticReport by Order ID</span>
        </div>
        <p className="text-xs text-slate-500">
          Endpoint: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">GET /fhir/DiagnosticReport?subject=&#123;orderId&#125;</code>
        </p>

        <div className="flex gap-2">
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="Enter Order ID (e.g. clxyz123…)"
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
          />
          <button
            onClick={handleFetch}
            disabled={!orderId.trim() || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D7E8A] text-slate-900 rounded-xl text-sm font-medium hover:bg-[#0a6b76] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Fetch Report
          </button>
        </div>

        {error && <ErrorBox message={error} />}
        {result && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              FHIR Response — {(result as FhirResource).resourceType}
            </p>
            <JsonViewer data={result} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Observations ───────────────────────────────────────────────────────

function ObservationsTab() {
  const [patientId, setPatientId] = useState("");
  const [result, setResult] = useState<FhirBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = useCallback(async () => {
    if (!patientId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.get(`/fhir/Observation?subject=${patientId}`);
      setResult(res.data as FhirBundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch Observations.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  const obsCount = result?.total ?? result?.entry?.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Fetch Observations by Patient ID</span>
        </div>
        <p className="text-xs text-slate-500">
          Endpoint: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">GET /fhir/Observation?subject=&#123;patientId&#125;</code>
        </p>

        <div className="flex gap-2">
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="Enter Patient ID (e.g. clxyz123…)"
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7E8A]/30"
          />
          <button
            onClick={handleFetch}
            disabled={!patientId.trim() || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D7E8A] text-slate-900 rounded-xl text-sm font-medium hover:bg-[#0a6b76] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Fetch Observations
          </button>
        </div>

        {error && <ErrorBox message={error} />}

        {result && (
          <div className="space-y-3">
            {/* Count badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0D7E8A]/10 text-[#0D7E8A] rounded-full text-sm font-semibold">
                <Activity className="w-3.5 h-3.5" />
                {obsCount} Observation{obsCount !== 1 ? "s" : ""} returned
              </span>
              <span className="text-xs text-slate-500">
                resourceType: <code className="bg-slate-100 px-1 rounded">{result.resourceType}</code>
              </span>
            </div>
            <JsonViewer data={result} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FhirExplorerPage() {
  const [tab, setTab] = useState("patient");

  return (
    <div className="space-y-6">
      <PageHeader
        title="FHIR R4 Explorer"
        subtitle="Interact with the FHIR R4 API"
        breadcrumbs={[
          { label: "Integrations", href: "/integrations" },
        ]}
      />

      {/* Info banner */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <Shield className="w-4 h-4 shrink-0" />
        <span>
          <span className="font-semibold">Base URL:</span> /fhir &nbsp;|&nbsp;
          <span className="font-semibold">FHIR Version:</span> R4 (4.0.1)
        </span>
      </div>

      <RadixTabs.Root value={tab} onValueChange={setTab}>
        <RadixTabs.List className="flex gap-0.5 bg-slate-100 rounded-xl p-1 w-fit mb-6">
          {[
            { value: "patient",     label: "Patient Lookup",      icon: Users },
            { value: "report",      label: "Diagnostic Report",   icon: FileText },
            { value: "observation", label: "Observations",        icon: Activity },
          ].map(({ value, label, icon: Icon }) => (
            <RadixTabs.Trigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                text-slate-500 hover:text-slate-800
                data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              <Icon className="w-4 h-4" />
              {label}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>

        <RadixTabs.Content value="patient">
          <PatientLookupTab />
        </RadixTabs.Content>
        <RadixTabs.Content value="report">
          <DiagnosticReportTab />
        </RadixTabs.Content>
        <RadixTabs.Content value="observation">
          <ObservationsTab />
        </RadixTabs.Content>
      </RadixTabs.Root>
    </div>
  );
}

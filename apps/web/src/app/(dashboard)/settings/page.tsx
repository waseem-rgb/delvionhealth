"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  FlaskConical,
  Bell,
  Plug,
  Building2,
  CreditCard,
  Plus,
  X,
  Copy,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Search,
  Loader2,
  Package,
  Hospital,
  FileText,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TeamUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface TestCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
  turnaroundHours: number;
  type?: string | null;
  _count?: { reportParameters: number };
}

interface ProfileComponent {
  testId: string;
  code: string;
  name: string;
  price: number;
}

interface ProfileDetail {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number;
  componentTotal: number;
  discountAmount: number;
  turnaroundHours: number;
  components: ProfileComponent[];
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface BranchItem {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  isActive: boolean;
  phone: string | null;
}

// ─────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────
const TABS = [
  { id: "team", label: "Team Members", icon: Users },
  { id: "tests", label: "Test Catalog", icon: FlaskConical },
  { id: "lab", label: "Lab Profile", icon: Hospital },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "branch", label: "Branch", icon: Building2 },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "smart", label: "Smart Features", icon: Sparkles },
] as const;

type TabId = typeof TABS[number]["id"];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-purple-100 text-purple-700",
  LAB_MANAGER: "bg-blue-100 text-blue-700",
  PATHOLOGIST: "bg-teal-100 text-teal-700",
  LAB_TECHNICIAN: "bg-green-100 text-green-700",
  RECEPTIONIST: "bg-amber-100 text-amber-700",
  PHLEBOTOMIST: "bg-orange-100 text-orange-700",
  ACCOUNTANT: "bg-indigo-100 text-indigo-700",
};

// ─────────────────────────────────────────────
// Team Members Tab
// ─────────────────────────────────────────────
function TeamTab() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "LAB_TECHNICIAN" });
  const [successMsg, setSuccessMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users", search],
    queryFn: () => api.get(`/users?search=${search}&limit=50`).then((r) => r.data.data as { data: TeamUser[] }),
  });

  const invite = useMutation({
    mutationFn: (dto: typeof form) => api.post("/users/invite", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setInviteOpen(false);
      setForm({ email: "", firstName: "", lastName: "", role: "LAB_TECHNICIAN" });
      setSuccessMsg("Invitation sent successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/users/${id}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 text-sm">
          <CheckCircle className="w-4 h-4" /> {successMsg}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Role</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Last Login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {[...Array(6)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No team members found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-slate-400"}`}
                      />
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleDateString("en-IN")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleStatus.mutate({ id: u.id, isActive: !u.isActive })
                      }
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Invite Team Member</h3>
              <button onClick={() => setInviteOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    First Name
                  </label>
                  <input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Last Name
                  </label>
                  <input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, role: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(ROLE_COLORS)
                    .filter((r) => r !== "SUPER_ADMIN")
                    .map((r) => (
                      <option key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                </select>
              </div>
              {invite.error && (
                <p className="text-sm text-red-600">
                  Failed to send invite. Please try again.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setInviteOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => invite.mutate(form)}
                disabled={
                  invite.isPending ||
                  !form.email ||
                  !form.firstName ||
                  !form.lastName
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {invite.isPending ? "Sending…" : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Test Catalog Tab
// ─────────────────────────────────────────────
function TestsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  // ─── Profile form state ─────────────────────
  const [profileName, setProfileName] = useState("");
  const [profileCategory, setProfileCategory] = useState("Profile");
  const [profileDepartment, setProfileDepartment] = useState("General");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedComponents, setSelectedComponents] = useState<ProfileComponent[]>([]);
  const [compSearch, setCompSearch] = useState("");
  const [compResults, setCompResults] = useState<TestCatalogItem[]>([]);
  const [compSearching, setCompSearching] = useState(false);
  const compSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch catalog list ─────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["test-catalog", search],
    queryFn: () =>
      api
        .get(`/test-catalog?search=${search}&limit=50`)
        .then((r) => r.data.data as { data: TestCatalogItem[] }),
  });

  const tests = data?.data ?? [];

  // ─── Fetch profile detail ───────────────────
  const { data: profileDetail } = useQuery<ProfileDetail>({
    queryKey: ["profile-detail", selectedProfile],
    queryFn: () =>
      api.get(`/test-catalog/profiles/${selectedProfile}`).then((r) => r.data.data as ProfileDetail),
    enabled: !!selectedProfile,
  });

  // ─── Debounced component search ─────────────
  useEffect(() => {
    if (compSearchRef.current) clearTimeout(compSearchRef.current);
    if (!compSearch.trim() || compSearch.length < 2) {
      setCompResults([]);
      return;
    }
    setCompSearching(true);
    compSearchRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/test-catalog/search?q=${encodeURIComponent(compSearch)}`);
        const items = (res.data.data ?? res.data ?? []) as TestCatalogItem[];
        // Exclude profiles and already-selected tests
        const selectedIds = new Set(selectedComponents.map((c) => c.testId));
        setCompResults(items.filter((t) => t.type !== "PROFILE" && !selectedIds.has(t.id)));
      } catch {
        setCompResults([]);
      } finally {
        setCompSearching(false);
      }
    }, 300);
    return () => { if (compSearchRef.current) clearTimeout(compSearchRef.current); };
  }, [compSearch, selectedComponents]);

  // ─── Computed pricing ───────────────────────
  const componentTotal = useMemo(
    () => selectedComponents.reduce((sum, c) => sum + c.price, 0),
    [selectedComponents]
  );
  const clampedDiscount = Math.min(Math.max(discountAmount, 0), componentTotal);
  const profilePrice = componentTotal - clampedDiscount;

  // ─── Create profile mutation ────────────────
  const createProfile = useMutation({
    mutationFn: (payload: {
      name: string;
      category: string;
      department: string;
      componentTestIds: string[];
      discountAmount: number;
    }) => api.post("/test-catalog/profiles", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-catalog"] });
      toast.success("Profile created successfully");
      resetProfileForm();
    },
    onError: () => toast.error("Failed to create profile"),
  });

  function resetProfileForm() {
    setProfileOpen(false);
    setProfileName("");
    setProfileCategory("Profile");
    setProfileDepartment("General");
    setDiscountAmount(0);
    setSelectedComponents([]);
    setCompSearch("");
    setCompResults([]);
  }

  function addComponent(t: TestCatalogItem) {
    setSelectedComponents((prev) => [
      ...prev,
      { testId: t.id, code: t.code, name: t.name, price: Number(t.price) },
    ]);
    setCompSearch("");
    setCompResults([]);
  }

  function removeComponent(testId: string) {
    setSelectedComponents((prev) => prev.filter((c) => c.testId !== testId));
  }

  function handleSaveProfile() {
    if (!profileName.trim()) return toast.error("Profile name is required");
    if (selectedComponents.length < 2) return toast.error("Select at least 2 tests");
    createProfile.mutate({
      name: profileName.trim(),
      category: profileCategory,
      department: profileDepartment,
      componentTestIds: selectedComponents.map((c) => c.testId),
      discountAmount: clampedDiscount,
    });
  }

  const [seeding, setSeeding] = useState(false);
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  const handleSeedParameters = async () => {
    setSeeding(true);
    try {
      const res = await api.post<{ data: { code: string; name?: string; status: string; count?: number }[] }>("/test-catalog/seed-parameters");
      const data = Array.isArray(res.data.data) ? res.data.data : (res.data as unknown as { code: string; name?: string; status: string; count?: number }[]);
      const seeded = data.filter((r) => r.status === "SEEDED");
      const skipped = data.filter((r) => r.status === "SKIPPED_HAS_PARAMS");
      const notFound = data.filter((r) => r.status === "NOT_FOUND");
      toast.success(
        `Parameters seeded: ${seeded.length} tests updated, ${skipped.length} already had params, ${notFound.length} not found`,
        { duration: 8000 },
      );
      void qc.invalidateQueries({ queryKey: ["test-catalog"] });
    } catch {
      toast.error("Failed to seed parameters");
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedTemplates = async () => {
    setSeedingTemplates(true);
    try {
      const res = await api.post("/test-catalog/seed-templates");
      const data = res.data?.data ?? res.data;
      toast.success(
        `Templates seeded: ${data.updated?.length ?? 0} tests updated, ${data.notFound?.length ?? 0} not found`,
        { duration: 6000 },
      );
      void qc.invalidateQueries({ queryKey: ["test-catalog"] });
      void qc.invalidateQueries({ queryKey: ["template-status"] });
    } catch {
      toast.error("Failed to seed templates");
    } finally {
      setSeedingTemplates(false);
    }
  };

  const { data: templateStatus } = useQuery<{
    totalWithParams: number;
    complete: number;
    incomplete: number;
    tests: { code: string; name: string; paramCount: number; score: number; isComplete: boolean; missing: string[] }[];
  }>({
    queryKey: ["template-status"],
    queryFn: () => api.get("/test-catalog/template-status").then((r) => r.data?.data ?? r.data),
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search tests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{tests.length} tests</span>
          <button
            onClick={handleSeedParameters}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Seed Parameters
          </button>
          <button
            onClick={handleSeedTemplates}
            disabled={seedingTemplates}
            className="inline-flex items-center gap-2 px-3 py-2 border border-teal-200 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 disabled:opacity-50 transition-colors"
          >
            {seedingTemplates ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Seed Templates
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Package className="w-4 h-4" /> Create Profile
          </button>
        </div>
      </div>

      {/* Template Status Dashboard */}
      {templateStatus && templateStatus.totalWithParams > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h4 className="text-sm font-semibold text-slate-700">Template Status</h4>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-0.5">
                <CheckCircle className="w-3 h-3" /> {templateStatus.complete} complete
              </span>
              {templateStatus.incomplete > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5">
                  {templateStatus.incomplete} incomplete
                </span>
              )}
            </div>
            <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${templateStatus.totalWithParams > 0 ? (templateStatus.complete / templateStatus.totalWithParams) * 100 : 0}%` }}
              />
            </div>
          </div>
          {templateStatus.incomplete > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {templateStatus.tests
                .filter((t) => !t.isComplete)
                .slice(0, 5)
                .map((t) => (
                  <span key={t.code} className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                    {t.code} — {t.missing[0]}
                  </span>
                ))}
              {templateStatus.incomplete > 5 && (
                <span className="text-xs text-slate-400">+{templateStatus.incomplete - 5} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tests Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500">Code</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Test Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Category</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Price</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">TAT (hrs)</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Params</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {[...Array(9)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : tests.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No tests found
                </td>
              </tr>
            ) : (
              tests.map((t) => (
                <tr
                  key={t.id}
                  className={`border-b border-slate-50 hover:bg-slate-50 ${
                    t.type === "PROFILE" ? "cursor-pointer" : ""
                  }`}
                  onClick={() => t.type === "PROFILE" && setSelectedProfile(t.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3">
                    {t.type === "PROFILE" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        Profile
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Test</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.category}</td>
                  <td className="px-4 py-3 text-right text-slate-800">
                    ₹{Number(t.price).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{t.turnaroundHours}</td>
                  <td className="px-4 py-3">
                    {(t._count?.reportParameters ?? 0) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        {t._count?.reportParameters} params
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500 border border-red-200">
                        No params
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/settings/test-catalog/${t.id}/report`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Report
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Create Profile Modal ───────────────── */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">Create Profile / Panel</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bundle tests together at a discounted price
                </p>
              </div>
              <button
                onClick={resetProfileForm}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Profile Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Profile Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Liver Function Test (LFT)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Category & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={profileCategory}
                    onChange={(e) => setProfileCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={profileDepartment}
                    onChange={(e) => setProfileDepartment(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Component Test Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Add Tests <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={compSearch}
                    onChange={(e) => setCompSearch(e.target.value)}
                    placeholder="Search tests to add…"
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {compSearching && (
                    <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 animate-spin" />
                  )}
                </div>

                {/* Search results dropdown */}
                {compResults.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                    {compResults.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addComponent(t)}
                        className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center justify-between text-sm border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <span className="font-medium text-slate-800">{t.name}</span>
                          <span className="ml-2 text-xs text-slate-400 font-mono">{t.code}</span>
                        </div>
                        <span className="text-slate-600 font-medium">
                          ₹{Number(t.price).toLocaleString("en-IN")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Components */}
              {selectedComponents.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    Selected Tests ({selectedComponents.length})
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {selectedComponents.map((c, idx) => (
                      <div
                        key={c.testId}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs w-5">{idx + 1}.</span>
                          <span className="text-slate-800">{c.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{c.code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">
                            ₹{c.price.toLocaleString("en-IN")}
                          </span>
                          <button
                            onClick={() => removeComponent(c.testId)}
                            className="p-0.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing Summary */}
              {selectedComponents.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Component Total</span>
                    <span className="font-medium text-slate-700">
                      ₹{componentTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Discount (₹)</span>
                    <input
                      type="number"
                      min={0}
                      max={componentTotal}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Profile Price</span>
                    <span className="text-lg font-bold text-violet-700">
                      ₹{profilePrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {clampedDiscount > 0 && (
                    <div className="text-xs text-green-600 text-right">
                      {((clampedDiscount / componentTotal) * 100).toFixed(1)}% discount applied
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={resetProfileForm}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={createProfile.isPending || !profileName.trim() || selectedComponents.length < 2}
                className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
              >
                {createProfile.isPending && <Loader2 size={14} className="animate-spin" />}
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Profile Detail Slide-over ──────────── */}
      {selectedProfile && profileDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">{profileDetail.name}</h3>
                <span className="text-xs font-mono text-slate-400">{profileDetail.code}</span>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Profile Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs">Category</span>
                  <span className="font-medium text-slate-800">{profileDetail.category}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Department</span>
                  <span className="font-medium text-slate-800">{profileDetail.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">TAT</span>
                  <span className="font-medium text-slate-800">{profileDetail.turnaroundHours} hrs</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Tests</span>
                  <span className="font-medium text-slate-800">{profileDetail.components.length} tests</span>
                </div>
              </div>

              {/* Component Tests */}
              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">Component Tests</div>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {profileDetail.components.map((c, idx) => (
                    <div key={c.testId} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs w-5">{idx + 1}.</span>
                        <span className="text-slate-800">{c.name}</span>
                      </div>
                      <span className="text-slate-500 font-mono text-xs">
                        ₹{c.price.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Component Total</span>
                  <span className="text-slate-700">₹{profileDetail.componentTotal.toLocaleString("en-IN")}</span>
                </div>
                {profileDetail.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>−₹{profileDetail.discountAmount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold">
                  <span className="text-slate-700">Profile Price</span>
                  <span className="text-violet-700">₹{profileDetail.price.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Notifications Tab
// ─────────────────────────────────────────────
const NOTIF_EVENTS = [
  {
    key: "orderConfirmed" as const,
    label: "Order Confirmed",
    desc: "When a new order is confirmed",
  },
  {
    key: "sampleCollected" as const,
    label: "Sample Collected",
    desc: "When a sample is collected",
  },
  {
    key: "reportReady" as const,
    label: "Report Ready",
    desc: "When a lab report is generated",
  },
  {
    key: "criticalAlert" as const,
    label: "Critical Alert",
    desc: "When a critical result is found",
  },
  {
    key: "paymentReceived" as const,
    label: "Payment Received",
    desc: "When a payment is processed",
  },
];

type NotifKey = "orderConfirmed" | "sampleCollected" | "reportReady" | "criticalAlert" | "paymentReceived";

function NotificationsTab() {
  const [prefs, setPrefs] = useState<Record<NotifKey, { email: boolean; sms: boolean }>>({
    orderConfirmed: { email: true, sms: false },
    sampleCollected: { email: true, sms: true },
    reportReady: { email: true, sms: true },
    criticalAlert: { email: true, sms: true },
    paymentReceived: { email: true, sms: false },
  });
  const [saved, setSaved] = useState(false);

  function toggle(key: NotifKey, channel: "email" | "sms") {
    setPrefs((p) => ({
      ...p,
      [key]: { ...p[key], [channel]: !p[key][channel] },
    }));
  }

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 text-sm">
          <CheckCircle className="w-4 h-4" /> Preferences saved
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 grid grid-cols-3 gap-4">
          <div className="font-medium text-xs text-slate-500">Event</div>
          <div className="font-medium text-xs text-slate-500 text-center">Email</div>
          <div className="font-medium text-xs text-slate-500 text-center">SMS</div>
        </div>
        {NOTIF_EVENTS.map((ev) => (
          <div
            key={ev.key}
            className="border-b border-slate-50 last:border-0 px-4 py-4 grid grid-cols-3 gap-4 items-center hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-medium text-slate-800">{ev.label}</div>
              <div className="text-xs text-slate-400">{ev.desc}</div>
            </div>
            {(["email", "sms"] as const).map((ch) => (
              <div key={ch} className="flex justify-center">
                <button
                  onClick={() => toggle(ev.key, ch)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    prefs[ev.key][ch] ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                      prefs[ev.key][ch] ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={save}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Integrations & API Keys Tab
// ─────────────────────────────────────────────
function IntegrationsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () =>
      api
        .get("/integrations/api-keys")
        .then((r) => r.data.data as ApiKeyItem[]),
  });

  const createKey = useMutation({
    mutationFn: (name: string) =>
      api.post("/integrations/api-keys", {
        name,
        permissions: ["read", "write"],
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey((res.data as { data: { fullKey: string } }).data.fullKey);
      setNewKeyName("");
      setCreateOpen(false);
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function copyKey() {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const keys = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">API Keys</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Keys are shown only once at creation. Store them securely.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> New Key
          </button>
        </div>

        {createdKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="text-sm font-semibold text-amber-800 mb-2">
              ⚠ Save this key — it will not be shown again
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-white border border-amber-200 rounded px-3 py-2 text-amber-900 break-all">
                {showKey
                  ? createdKey
                  : `${createdKey.slice(0, 20)}${"•".repeat(20)}`}
              </code>
              <button onClick={() => setShowKey((v) => !v)}>
                {showKey ? (
                  <EyeOff className="w-4 h-4 text-amber-600" />
                ) : (
                  <Eye className="w-4 h-4 text-amber-600" />
                )}
              </button>
              <button
                onClick={copyKey}
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
              >
                <Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => setCreatedKey(null)}>
                <X className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Loading…
            </div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No API keys yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Key Prefix
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Last Used
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {k.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {k.keyPrefix}••••••••
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(k.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleDateString("en-IN")
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteKey.mutate(k.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Connected Systems */}
      <div>
        <h3 className="font-semibold text-slate-800 text-sm mb-3">
          Connected Systems
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { name: "HL7 FHIR", status: "Not Connected", icon: "🏥" },
            { name: "HIS / HMIS", status: "Not Connected", icon: "💻" },
            { name: "Aarogya Setu", status: "Not Connected", icon: "🇮🇳" },
          ].map((sys) => (
            <div
              key={sys.name}
              className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{sys.icon}</span>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {sys.name}
                  </div>
                  <div className="text-xs text-slate-400">{sys.status}</div>
                </div>
              </div>
              <button className="text-xs text-blue-600 hover:underline font-medium">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create Key Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Create API Key</h3>
              <button onClick={() => setCreateOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Key Name
              </label>
              <input
                autoFocus
                placeholder="e.g. Mobile App Production"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => createKey.mutate(newKeyName)}
                disabled={!newKeyName || createKey.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Branch Tab
// ─────────────────────────────────────────────
function BranchTab() {
  const { data: tenantData } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: () =>
      api
        .get("/tenants/my-settings")
        .then((r) => (r.data as { data: { id: string } }).data),
  });

  const tenantId = tenantData?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["branches", tenantId],
    enabled: !!tenantId,
    queryFn: () =>
      api
        .get(`/tenants/${tenantId}/branches`)
        .then((r) => (r.data as { data: BranchItem[] }).data),
  });

  const branches = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">
            Branch Locations
          </h3>
          <button className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Branch
          </button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Loading…
          </div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No branches found
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {branches.map((b) => (
              <div
                key={b.id}
                className="px-5 py-4 flex items-center justify-between hover:bg-slate-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 text-sm">
                      {b.name}
                    </span>
                    <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      {b.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {b.city}, {b.state}
                    {b.phone ? ` · ${b.phone}` : ""}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    b.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {b.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Billing Tab
// ─────────────────────────────────────────────
function BillingTab() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-gradient-to-br from-[#1B4F8A] to-[#0D9488] rounded-2xl text-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-white/70 uppercase tracking-wider mb-1">
              Current Plan
            </div>
            <div className="text-2xl font-bold">Enterprise</div>
            <div className="text-sm text-white/80 mt-1">
              Multi-branch · Unlimited users · All modules
            </div>
          </div>
          <span className="bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">
            Active
          </span>
        </div>
        <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-sm">
          <div>
            <div className="text-white/70 text-xs">Next billing date</div>
            <div className="font-semibold">April 1, 2026</div>
          </div>
          <div className="text-right">
            <div className="text-white/70 text-xs">Monthly amount</div>
            <div className="font-semibold">₹29,999 / month</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Users", used: 8, total: "Unlimited" },
          { label: "Branches", used: 1, total: "Unlimited" },
          { label: "Monthly Orders", used: 124, total: "Unlimited" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white border border-slate-100 rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-slate-900">{item.used}</div>
            <div className="text-xs text-slate-400">{item.label} used</div>
            <div className="text-xs text-slate-300 mt-0.5">of {item.total}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 text-sm mb-3">
          Billing History
        </h3>
        <div className="space-y-2">
          {[
            { date: "Mar 1, 2026", amount: "₹29,999", status: "Paid" },
            { date: "Feb 1, 2026", amount: "₹29,999", status: "Paid" },
            { date: "Jan 1, 2026", amount: "₹29,999", status: "Paid" },
          ].map((inv) => (
            <div
              key={inv.date}
              className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
            >
              <div className="text-sm text-slate-700">{inv.date}</div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-800">
                  {inv.amount}
                </span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {inv.status}
                </span>
                <button className="text-xs text-blue-600 hover:underline">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
        <RefreshCw className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">
          Need to upgrade or change your plan?
        </p>
        <button className="mt-2 text-sm text-blue-600 hover:underline font-medium">
          Contact Sales →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Smart Features Tab
// ─────────────────────────────────────────────
interface AiStatusResponse {
  primaryConfigured: boolean;
  fallbackConfigured: boolean;
  reportInterpretationEnabled: boolean;
  analyticsInsightsEnabled: boolean;
}

// ─────────────────────────────────────────────
// Lab Profile Tab
// ─────────────────────────────────────────────
function LabProfileTab() {
  const qc = useQueryClient();
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ["tenant-profile"],
    queryFn: () => api.get("/tenants/current").then((r) => (r.data?.data ?? r.data) as Record<string, unknown>),
  });

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    gstNumber: "",
    nabId: "",
    licenseNumber: "",
    reportHeaderHtml: "",
    reportFooterHtml: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (tenantData && !loaded) {
      const t = tenantData as Record<string, string | undefined>;
      setForm({
        name: t.name ?? "",
        address: t.address ?? "",
        city: t.city ?? "",
        state: t.state ?? "",
        phone: t.phone ?? "",
        email: t.adminEmail ?? "",
        gstNumber: t.gstNumber ?? "",
        nabId: t.nabId ?? "",
        licenseNumber: t.licenseNumber ?? "",
        reportHeaderHtml: t.reportHeaderHtml ?? "",
        reportFooterHtml: t.reportFooterHtml ?? "",
      });
      setLoaded(true);
    }
  }, [tenantData, loaded]);

  const updateProfile = useMutation({
    mutationFn: (dto: typeof form) => api.put("/tenants/current", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-profile"] });
      toast.success("Lab profile updated");
    },
    onError: () => toast.error("Failed to update lab profile"),
  });

  if (isLoading) return <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>;

  const fields: { label: string; key: keyof typeof form; type?: string; rows?: number; colSpan?: boolean }[] = [
    { label: "Lab Name", key: "name" },
    { label: "Phone", key: "phone" },
    { label: "Email", key: "email" },
    { label: "City", key: "city" },
    { label: "State", key: "state" },
    { label: "Address", key: "address", colSpan: true },
    { label: "GST Number", key: "gstNumber" },
    { label: "NAB Accreditation ID", key: "nabId" },
    { label: "License Number", key: "licenseNumber" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Lab Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className={f.colSpan ? "md:col-span-2" : ""}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
              <input
                type={f.type ?? "text"}
                value={form[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Report Branding</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Report Header HTML</label>
            <textarea
              value={form.reportHeaderHtml}
              onChange={(e) => setForm((prev) => ({ ...prev, reportHeaderHtml: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="<div>Your lab header HTML...</div>"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Report Footer HTML</label>
            <textarea
              value={form.reportFooterHtml}
              onChange={(e) => setForm((prev) => ({ ...prev, reportFooterHtml: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="<div>Your lab footer HTML...</div>"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => updateProfile.mutate(form)}
          disabled={updateProfile.isPending}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          {updateProfile.isPending ? "Saving..." : "Save Lab Profile"}
        </button>
      </div>
    </div>
  );
}

function SmartFeaturesTab() {
  const qc = useQueryClient();
  const [generatingNotes, setGeneratingNotes] = useState(false);

  const { data: statusData, isLoading } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () =>
      api.get("/ai/status").then((r) => (r.data?.data ?? r.data) as AiStatusResponse),
    staleTime: 30_000,
  });

  const { data: smartSettings, isLoading: smartLoading } = useQuery({
    queryKey: ["smart-report-settings"],
    queryFn: () =>
      api.get("/smart-report/settings").then((r) => (r.data?.data ?? r.data) as {
        enabled: boolean;
        harrisonIndexed: boolean;
      }),
    staleTime: 30_000,
  });

  const { data: indexStatus } = useQuery({
    queryKey: ["smart-report-index-status"],
    queryFn: () =>
      api.get("/smart-report/index-status").then((r) => (r.data?.data ?? r.data) as {
        indexed: boolean;
        chunkCount: number;
      }),
    staleTime: 30_000,
  });

  const { data: notesProgress } = useQuery({
    queryKey: ["test-notes-progress"],
    queryFn: () =>
      api.get("/test-notes/progress").then((r) => (r.data?.data ?? r.data) as {
        total: number;
        generated: number;
        pending: number;
        percent: number;
      }),
    refetchInterval: generatingNotes ? 5000 : 30_000,
  });

  // Stop polling when all notes are done
  useEffect(() => {
    if (generatingNotes && notesProgress && notesProgress.pending === 0) {
      setGeneratingNotes(false);
      toast.success("All test notes generated!");
    }
  }, [generatingNotes, notesProgress]);

  const toggleSmartReport = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put("/smart-report/settings", { enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-report-settings"] });
      toast.success("Smart Report setting updated");
    },
    onError: () => toast.error("Failed to update Smart Report setting"),
  });

  const buildIndex = useMutation({
    mutationFn: () => api.post("/smart-report/build-index"),
    onSuccess: (r) => {
      const d = r.data?.data ?? r.data;
      qc.invalidateQueries({ queryKey: ["smart-report-index-status"] });
      qc.invalidateQueries({ queryKey: ["smart-report-settings"] });
      toast.success(
        `Harrison index built — ${(d?.chunks ?? 0).toLocaleString()} chunks from ${d?.pages ?? 0} pages`,
      );
    },
    onError: () => toast.error("Failed to build Harrison index — check server logs"),
  });

  const generateAllNotes = useMutation({
    mutationFn: () => api.post("/test-notes/generate-all"),
    onSuccess: (r) => {
      const d = r.data?.data ?? r.data;
      setGeneratingNotes(true);
      toast.success(`Generating notes for ${d?.queued ?? 0} tests — running in background`);
    },
    onError: () => toast.error("Failed to start notes generation"),
  });

  const status = statusData ?? {
    primaryConfigured: false,
    fallbackConfigured: false,
    reportInterpretationEnabled: false,
    analyticsInsightsEnabled: false,
  };

  const smartEnabled = smartSettings?.enabled ?? false;
  const harrisonIndexed = indexStatus?.indexed ?? smartSettings?.harrisonIndexed ?? false;
  const chunkCount = indexStatus?.chunkCount ?? 0;
  const notesDone = notesProgress?.pending === 0 && (notesProgress?.total ?? 0) > 0;

  function StatusDot({ active }: { active: boolean }) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-500" : "bg-slate-300"}`}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Engine Status */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Smart Engine Status</h3>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <StatusDot active={status.primaryConfigured} />
                <span className="text-sm text-slate-700">Primary AI Engine</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                status.primaryConfigured ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              }`}>
                {status.primaryConfigured ? "Configured" : "Not Configured"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <StatusDot active={status.fallbackConfigured} />
                <span className="text-sm text-slate-700">Fallback AI Engine</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                status.fallbackConfigured ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              }`}>
                {status.fallbackConfigured ? "Configured" : "Not Configured"}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-4">
          API keys are configured in the server environment. Contact your system administrator to update credentials.
        </p>
      </div>

      {/* Smart Report Toggle + Harrison Index */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Smart Report (AI Appendix)</h3>
        {smartLoading ? (
          <div className="py-4 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div>
                <div className="text-sm font-medium text-slate-800">Enable Smart Report</div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Appends a 2-page AI-generated appendix to reports with abnormal parameter interpretation and evidence-based lifestyle advice.
                </p>
              </div>
              <button
                onClick={() => toggleSmartReport.mutate(!smartEnabled)}
                disabled={toggleSmartReport.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                  smartEnabled ? "bg-violet-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    smartEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Harrison Index */}
            <div className="py-3 border-b border-slate-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📚</span>
                    <div className="text-sm font-medium text-slate-800">Clinical Reference Index</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      harrisonIndexed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {harrisonIndexed ? "Ready" : "Not built"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {harrisonIndexed
                      ? `Harrison's Principles of Internal Medicine (22nd Ed.) — ${chunkCount.toLocaleString()} sections indexed`
                      : "Harrison's Medicine 22nd Ed. needs to be indexed once. This takes 1-3 minutes."}
                  </p>
                  {buildIndex.isPending && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-violet-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Building index — parsing 4,200+ pages. Do not close this page...
                    </div>
                  )}
                </div>
                <button
                  onClick={() => buildIndex.mutate()}
                  disabled={buildIndex.isPending}
                  className="shrink-0 ml-4 px-3 py-1.5 text-xs font-medium rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition-colors"
                >
                  {buildIndex.isPending ? "Building..." : harrisonIndexed ? "Rebuild Index" : "Build Index Now"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Notes Generation */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📋</span>
              <h3 className="font-semibold text-slate-800 text-sm">Clinical Report Notes</h3>
              {notesProgress && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  notesDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {notesDone
                    ? `All ${notesProgress.total} done`
                    : `${notesProgress.generated} / ${notesProgress.total}`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Generate once for all {notesProgress?.total ?? 966} tests in the catalog.
              Clinical footnotes (high/low value meaning, age notes, pregnancy notes, critical values)
              appear at the bottom of every report PDF.
            </p>

            {/* Progress bar */}
            {(generatingNotes || (notesProgress && notesProgress.generated > 0 && !notesDone)) && notesProgress && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{notesProgress.generated} / {notesProgress.total} tests done</span>
                  <span>{notesProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${notesProgress.percent}%` }}
                  />
                </div>
                {generatingNotes && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Running in background — roughly {Math.round((notesProgress.pending * 1.5) / 60)} minutes remaining
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => generateAllNotes.mutate()}
            disabled={generateAllNotes.isPending || generatingNotes || notesDone}
            className="shrink-0 ml-4 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            {generatingNotes
              ? "Generating..."
              : notesDone
                ? "All Generated"
                : `Generate All Notes (${notesProgress?.pending ?? "?"} pending)`}
          </button>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-800 text-sm mb-4">Feature Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-start justify-between py-2 border-b border-slate-50">
            <div>
              <div className="text-sm font-medium text-slate-800">Smart Report Interpretation</div>
              <p className="text-xs text-slate-400 mt-0.5">
                AI-powered interpretation of lab results highlighting abnormal values, lifestyle advice, and follow-up suggestions.
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-4 ${
              status.reportInterpretationEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}>
              {status.reportInterpretationEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-start justify-between py-2 border-b border-slate-50">
            <div>
              <div className="text-sm font-medium text-slate-800">Analytics Smart Insights</div>
              <p className="text-xs text-slate-400 mt-0.5">
                AI analysis of your lab&apos;s performance data with growth opportunities, issue detection, and actionable recommendations.
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-4 ${
              status.analyticsInsightsEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}>
              {status.analyticsInsightsEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Feature toggles are managed via server environment variables. Contact your system administrator to enable or disable features.
        </p>
      </div>

      {/* Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">About DELViON Smart Features</h4>
            <p className="text-sm text-slate-600 mt-1">
              Smart features use advanced AI to provide intelligent insights about your lab operations.
              All data is processed securely and no patient data is stored by the AI engine. Results are
              for informational purposes only and do not constitute medical advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("team");

  const tabContent: Record<TabId, React.ReactNode> = {
    team: <TeamTab />,
    tests: <TestsTab />,
    lab: <LabProfileTab />,
    notifications: <NotificationsTab />,
    integrations: <IntegrationsTab />,
    branch: <BranchTab />,
    billing: <BillingTab />,
    smart: <SmartFeaturesTab />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your lab configuration, team, and integrations
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>{tabContent[activeTab]}</div>
    </div>
  );
}

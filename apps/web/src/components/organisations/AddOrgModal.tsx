"use client";

import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { key: "basic", label: "Basic Information" },
  { key: "payment", label: "Payment Configurations" },
  { key: "account", label: "Account Settings" },
  { key: "access", label: "Login and Access" },
  { key: "hierarchy", label: "Org Hierarchy" },
];

interface AddOrgModalProps {
  onClose: () => void;
  onCreated: (org: Record<string, unknown>) => void;
}

export default function AddOrgModal({ onClose, onCreated }: AddOrgModalProps) {
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    panNumber: "",
    paymentType: "CASH",
    creditLimit: "",
    creditTermDays: "30",
    upiId: "",
    discountPercent: "",
    rateListId: "",
    parentOrgId: "",
  });

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Organisation name is required");
      setTab("basic");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/organisations", {
        name: form.name.trim(),
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        gstNumber: form.gstNumber || undefined,
        panNumber: form.panNumber || undefined,
        paymentType: form.paymentType,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : 0,
        creditDays: form.creditTermDays
          ? parseInt(form.creditTermDays)
          : 30,
        parentOrgId: form.parentOrgId || undefined,
      });
      onCreated(res.data.data ?? res.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create organisation";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const tabIdx = TABS.findIndex((t) => t.key === tab);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-lg">Add Organisation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 border-r bg-gray-50 p-3 space-y-1 shrink-0">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                  tab === t.key
                    ? "bg-teal-700 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* BASIC INFORMATION */}
            {tab === "basic" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Organisation Name *
                  </label>
                  <input
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                    placeholder="Enter organisation name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Code
                    </label>
                    <input
                      className="w-full border rounded-xl px-4 py-2.5 text-sm bg-gray-50"
                      placeholder="Auto-generated"
                      readOnly
                      value={form.code}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Contact Person
                    </label>
                    <input
                      className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                      value={form.contactPerson}
                      onChange={(e) => set("contactPerson", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Address
                  </label>
                  <input
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "City", key: "city" },
                    { label: "State", key: "state" },
                    { label: "Pincode", key: "pincode" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        {f.label}
                      </label>
                      <input
                        className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                        value={form[f.key as keyof typeof form]}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      GST Number
                    </label>
                    <input
                      className="w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-teal-500"
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      value={form.gstNumber}
                      onChange={(e) =>
                        set("gstNumber", e.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      PAN Number
                    </label>
                    <input
                      className="w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-teal-500"
                      placeholder="e.g. ABCDE1234F"
                      value={form.panNumber}
                      onChange={(e) =>
                        set("panNumber", e.target.value.toUpperCase())
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENT CONFIGURATIONS */}
            {tab === "payment" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Default Payment Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        key: "CASH",
                        label: "Cash",
                        icon: "\uD83D\uDCB5",
                        desc: "Payments collected at reception",
                      },
                      {
                        key: "CREDIT",
                        label: "Credit",
                        icon: "\uD83C\uDFE2",
                        desc: "Bills posted to org ledger",
                      },
                      {
                        key: "UPI",
                        label: "UPI",
                        icon: "\uD83D\uDCF1",
                        desc: "Digital payment via UPI ID",
                      },
                    ].map((pt) => (
                      <button
                        key={pt.key}
                        onClick={() => set("paymentType", pt.key)}
                        className={`p-4 rounded-xl border-2 text-left transition ${
                          form.paymentType === pt.key
                            ? "border-teal-600 bg-teal-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="text-2xl mb-1">{pt.icon}</div>
                        <p
                          className={`font-semibold text-sm ${form.paymentType === pt.key ? "text-teal-700" : "text-gray-700"}`}
                        >
                          {pt.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {pt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {form.paymentType === "CREDIT" && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">
                      Credit Configuration
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Credit Limit (INR)
                        </label>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                          placeholder="e.g. 50000"
                          value={form.creditLimit}
                          onChange={(e) => set("creditLimit", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Credit Terms (days)
                        </label>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                          placeholder="e.g. 30"
                          value={form.creditTermDays}
                          onChange={(e) =>
                            set("creditTermDays", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.paymentType === "UPI" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      UPI ID
                    </label>
                    <input
                      className="w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-teal-500"
                      placeholder="e.g. orgname@paytm"
                      value={form.upiId}
                      onChange={(e) => set("upiId", e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Default Discount (%)
                    <span className="font-normal text-gray-400 ml-1">
                      - applied to all orders from this org
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full border rounded-xl px-4 py-2.5 text-sm pr-8 focus:outline-none focus:border-teal-500"
                      placeholder="0"
                      value={form.discountPercent}
                      onChange={(e) => set("discountPercent", e.target.value)}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-400 text-sm">
                      %
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT SETTINGS */}
            {tab === "account" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Rate List
                  </label>
                  <select
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                    value={form.rateListId}
                    onChange={(e) => set("rateListId", e.target.value)}
                  >
                    <option value="">-- Default rate list --</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Leave blank to use the default pricing from test catalog
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border text-xs text-gray-500">
                  Additional account settings can be configured after creation
                  from the Organisation detail page.
                </div>
              </div>
            )}

            {/* LOGIN AND ACCESS */}
            {tab === "access" && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl border text-sm text-gray-500">
                  <p className="font-medium text-gray-700 mb-1">
                    Portal Access
                  </p>
                  <p className="text-xs">
                    Login credentials and portal access settings can be
                    configured after creation from the Organisation detail page.
                  </p>
                </div>
              </div>
            )}

            {/* ORG HIERARCHY */}
            {tab === "hierarchy" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Parent Organisation
                  </label>
                  <select
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                    value={form.parentOrgId}
                    onChange={(e) => set("parentOrgId", e.target.value)}
                  >
                    <option value="">
                      None - this is a top-level organisation
                    </option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Set a parent org if this branch/sub-org&apos;s dues are
                    settled by a main organisation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <div className="flex gap-2">
            {tabIdx > 0 && (
              <button
                onClick={() => setTab(TABS[tabIdx - 1].key)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-white"
              >
                &larr; Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-white"
            >
              Close
            </button>
            {tabIdx < TABS.length - 1 ? (
              <button
                onClick={() => setTab(TABS[tabIdx + 1].key)}
                className="px-5 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800"
              >
                Next &rarr;
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-5 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Organisation"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

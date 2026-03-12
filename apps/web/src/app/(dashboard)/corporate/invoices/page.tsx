"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, X } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [corporateId, setCorporateId] = useState("");
  const [status, setStatus] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [genForm, setGenForm] = useState({
    corporateId: "",
    fromDate: "",
    toDate: "",
    grossAmount: "",
    discountAmount: "",
  });
  const [payForm, setPayForm] = useState({ status: "PAID", paymentMode: "BANK_TRANSFER", paidAmount: "" });

  const { data: corporates } = useQuery({
    queryKey: ["corporates-list"],
    queryFn: async () => {
      const res = await api.get("/corporate/corporates", { params: { limit: 100 } });
      return res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
    },
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", corporateId, status],
    queryFn: async () => {
      const params: any = {};
      if (corporateId) params.corporateId = corporateId;
      if (status) params.status = status;
      const res = await api.get("/corporate/invoices", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const generateMut = useMutation({
    mutationFn: (dto: any) => api.post("/corporate/invoices/b2b", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowGenerate(false);
      setGenForm({ corporateId: "", fromDate: "", toDate: "", grossAmount: "", discountAmount: "" });
    },
  });

  const paymentMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) =>
      api.patch(`/corporate/invoices/${id}/payment`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setPaymentModal(null);
    },
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "PAID": return "bg-green-100 text-green-700";
      case "OVERDUE": return "bg-red-100 text-red-700";
      case "PARTIALLY_PAID": return "bg-amber-100 text-amber-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Corporate Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage B2B billing</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a] transition"
        >
          <Plus className="w-4 h-4" />
          Generate B2B Invoice
        </button>
      </div>

      <div className="flex gap-3">
        <select
          value={corporateId}
          onChange={(e) => setCorporateId(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Corporates</option>
          {(corporates ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
        >
          <option value="">All Status</option>
          {["RAISED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (!invoices || invoices.length === 0) ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">No invoices found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {["Invoice #", "Corporate", "Type", "Period", "Orders", "Net Amount", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoices ?? []).map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.corporate?.name}</td>
                  <td className="px-4 py-3 text-slate-500">{inv.invoiceType}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(inv.fromDate)} — {formatDate(inv.toDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.orderCount}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">₹{inv.netAmount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.status !== "PAID" && (
                      <button
                        onClick={() => {
                          setPaymentModal(inv);
                          setPayForm({ status: "PAID", paymentMode: "BANK_TRANSFER", paidAmount: inv.netAmount });
                        }}
                        className="text-xs text-[#1B4F8A] hover:underline"
                      >
                        Update Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Generate Invoice Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Generate B2B Invoice</h3>
              <button onClick={() => setShowGenerate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Corporate *</label>
              <select
                value={genForm.corporateId}
                onChange={(e) => setGenForm((f) => ({ ...f, corporateId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              >
                <option value="">Select corporate</option>
                {(corporates ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
                <input type="date" value={genForm.fromDate} onChange={(e) => setGenForm((f) => ({ ...f, fromDate: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
                <input type="date" value={genForm.toDate} onChange={(e) => setGenForm((f) => ({ ...f, toDate: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Gross Amount (paise)</label>
                <input type="number" value={genForm.grossAmount} onChange={(e) => setGenForm((f) => ({ ...f, grossAmount: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Discount (paise)</label>
                <input type="number" value={genForm.discountAmount} onChange={(e) => setGenForm((f) => ({ ...f, discountAmount: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowGenerate(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => generateMut.mutate(genForm)}
                disabled={generateMut.isPending || !genForm.corporateId || !genForm.fromDate || !genForm.toDate}
                className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {generateMut.isPending ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Update Payment</h3>
              <button onClick={() => setPaymentModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500">{paymentModal.invoiceNumber}</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select value={payForm.status} onChange={(e) => setPayForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {["SENT", "PARTIALLY_PAID", "PAID"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
              <select value={payForm.paymentMode} onChange={(e) => setPayForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {["BANK_TRANSFER", "CHEQUE", "NEFT", "UPI", "CASH"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Paid Amount (paise)</label>
              <input type="number" value={payForm.paidAmount} onChange={(e) => setPayForm((f) => ({ ...f, paidAmount: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPaymentModal(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => paymentMut.mutate({ id: paymentModal.id, dto: payForm })}
                disabled={paymentMut.isPending}
                className="flex-1 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {paymentMut.isPending ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

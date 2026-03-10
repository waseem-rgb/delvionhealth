"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Truck,
  Package,
  FileText,
  ShoppingCart,
  Users,
  Plus,
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  ArrowRightLeft,
  CreditCard,
  CheckCircle2,
  Minus,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  paymentTerms: string;
  tdsApplicable: boolean;
  isActive: boolean;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: any;
  vendorId: string;
  totalAmount: number;
  status: string;
  expectedDelivery: string;
  items: any[];
  createdAt: string;
}

interface GRN {
  id: string;
  grnNumber?: string;
  vendor: any;
  vendorId: string;
  purchaseOrderId?: string;
  poNumber?: string;
  totalAmount: number;
  status: string;
  receivedDate: string;
  items: any[];
  createdAt: string;
}

interface VendorInvoice {
  id: string;
  invoiceNumber: string;
  vendor: any;
  vendorId: string;
  subtotal: number;
  tds: number;
  netPayable: number;
  status: string;
  matchStatus?: string;
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  status?: string;
}

// ── Status Colors ────────────────────────────────────────────────────────────

const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-300",
  PENDING: "bg-yellow-900/60 text-yellow-300",
  APPROVED: "bg-emerald-900/60 text-emerald-300",
  PARTIALLY_RECEIVED: "bg-blue-900/60 text-blue-300",
  RECEIVED: "bg-teal-900/60 text-teal-300",
  CANCELLED: "bg-red-900/60 text-red-300",
};

const GRN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-300",
  PENDING: "bg-yellow-900/60 text-yellow-300",
  CONFIRMED: "bg-emerald-900/60 text-emerald-300",
  REJECTED: "bg-red-900/60 text-red-300",
};

const VI_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-300",
  PENDING: "bg-yellow-900/60 text-yellow-300",
  MATCHED: "bg-emerald-900/60 text-emerald-300",
  PAID: "bg-teal-900/60 text-teal-300",
  DISPUTED: "bg-red-900/60 text-red-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  REAGENT: "bg-blue-900/60 text-blue-300",
  CONSUMABLE: "bg-purple-900/60 text-purple-300",
  EQUIPMENT: "bg-orange-900/60 text-orange-300",
  GENERAL: "bg-slate-700 text-slate-300",
};

const TABS = ["Purchase Orders", "GRN", "Vendor Invoices", "Inventory", "Vendors"] as const;
type Tab = (typeof TABS)[number];

// ── Component ────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Purchase Orders");
  const [loading, setLoading] = useState(true);

  // Data
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Modals
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showCreateGRN, setShowCreateGRN] = useState(false);
  const [showCreateVI, setShowCreateVI] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [showInventoryOut, setShowInventoryOut] = useState(false);

  // PO Form
  const [poForm, setPoForm] = useState({
    vendorId: "",
    expectedDelivery: "",
    items: [{ name: "", quantity: 1, unitPrice: 0 }],
  });

  // GRN Form
  const [grnForm, setGrnForm] = useState({
    vendorId: "",
    purchaseOrderId: "",
    items: [{ name: "", quantity: 1, unitPrice: 0 }],
  });

  // Vendor Invoice Form
  const [viForm, setViForm] = useState({
    vendorId: "",
    invoiceNumber: "",
    subtotal: 0,
    tds: 0,
  });

  // Vendor Form
  const [vendorForm, setVendorForm] = useState({
    name: "",
    code: "",
    contactPerson: "",
    phone: "",
    email: "",
    paymentTerms: "NET_30",
    tdsApplicable: false,
  });

  // Inventory Out Form
  const [invOutForm, setInvOutForm] = useState({
    itemId: "",
    quantity: 1,
    orderReference: "",
  });

  // ── Data Loading ───────────────────────────────────────────────────────────

  const fetchVendors = async () => {
    try {
      const res = await api.get("/finance/vendors");
      const raw = res.data?.data ?? res.data;
      setVendors(Array.isArray(raw) ? raw : raw?.vendors ?? raw?.items ?? []);
    } catch { setVendors([]); }
  };

  const fetchPOs = async () => {
    try {
      const res = await api.get("/finance/purchase-orders");
      const raw = res.data?.data ?? res.data;
      setPurchaseOrders(Array.isArray(raw) ? raw : raw?.purchaseOrders ?? raw?.items ?? []);
    } catch { setPurchaseOrders([]); }
  };

  const fetchGRNs = async () => {
    try {
      const res = await api.get("/finance/grns");
      const raw = res.data?.data ?? res.data;
      setGrns(Array.isArray(raw) ? raw : raw?.grns ?? raw?.items ?? []);
    } catch { setGrns([]); }
  };

  const fetchVendorInvoices = async () => {
    try {
      const res = await api.get("/finance/vendor-invoices");
      const raw = res.data?.data ?? res.data;
      setVendorInvoices(Array.isArray(raw) ? raw : raw?.invoices ?? raw?.items ?? []);
    } catch { setVendorInvoices([]); }
  };

  const fetchInventory = async () => {
    try {
      const res = await api.get("/finance/inventory");
      const raw = res.data?.data ?? res.data;
      setInventory(Array.isArray(raw) ? raw : raw?.items ?? []);
    } catch { setInventory([]); }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchVendors(), fetchPOs(), fetchGRNs(), fetchVendorInvoices(), fetchInventory()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreatePO = async () => {
    try {
      const items = poForm.items.map((it) => ({ ...it, amount: it.quantity * it.unitPrice }));
      const totalAmount = items.reduce((s, i) => s + i.amount, 0);
      await api.post("/finance/purchase-orders", { vendorId: poForm.vendorId, expectedDelivery: poForm.expectedDelivery, items, totalAmount });
      setShowCreatePO(false);
      setPoForm({ vendorId: "", expectedDelivery: "", items: [{ name: "", quantity: 1, unitPrice: 0 }] });
      fetchPOs();
    } catch (err) { console.error("Failed to create PO", err); }
  };

  const handleApprovePO = async (poId: string) => {
    try {
      await api.patch(`/finance/purchase-orders/${poId}/approve`);
      fetchPOs();
    } catch (err) { console.error("Failed to approve PO", err); }
  };

  const handleCreateGRN = async () => {
    try {
      const items = grnForm.items.map((it) => ({ ...it, amount: it.quantity * it.unitPrice }));
      await api.post("/finance/grns", { vendorId: grnForm.vendorId, purchaseOrderId: grnForm.purchaseOrderId || undefined, items });
      setShowCreateGRN(false);
      setGrnForm({ vendorId: "", purchaseOrderId: "", items: [{ name: "", quantity: 1, unitPrice: 0 }] });
      fetchGRNs();
    } catch (err) { console.error("Failed to create GRN", err); }
  };

  const handleConfirmGRN = async (grnId: string) => {
    try {
      await api.post(`/finance/grns/${grnId}/confirm`);
      fetchGRNs();
      fetchInventory();
    } catch (err) { console.error("Failed to confirm GRN", err); }
  };

  const handleCreateVI = async () => {
    try {
      await api.post("/finance/vendor-invoices", {
        vendorId: viForm.vendorId,
        invoiceNumber: viForm.invoiceNumber,
        subtotal: viForm.subtotal,
        tds: viForm.tds,
        netPayable: viForm.subtotal - viForm.tds,
      });
      setShowCreateVI(false);
      setViForm({ vendorId: "", invoiceNumber: "", subtotal: 0, tds: 0 });
      fetchVendorInvoices();
    } catch (err) { console.error("Failed to create vendor invoice", err); }
  };

  const handleMatchVI = async (viId: string) => {
    try {
      await api.post(`/finance/vendor-invoices/${viId}/match`);
      fetchVendorInvoices();
    } catch (err) { console.error("Failed to match vendor invoice", err); }
  };

  const handlePayVI = async (viId: string) => {
    try {
      await api.post("/finance/vendor-payments", { vendorInvoiceId: viId });
      fetchVendorInvoices();
    } catch (err) { console.error("Failed to pay vendor invoice", err); }
  };

  const handleCreateVendor = async () => {
    try {
      await api.post("/finance/vendors", vendorForm);
      setShowCreateVendor(false);
      setVendorForm({ name: "", code: "", contactPerson: "", phone: "", email: "", paymentTerms: "NET_30", tdsApplicable: false });
      fetchVendors();
    } catch (err) { console.error("Failed to create vendor", err); }
  };

  const handleInventoryOut = async () => {
    try {
      await api.post("/finance/inventory/out", invOutForm);
      setShowInventoryOut(false);
      setInvOutForm({ itemId: "", quantity: 1, orderReference: "" });
      fetchInventory();
    } catch (err) { console.error("Failed to process inventory out", err); }
  };

  // PO form helpers
  const addPoItem = () => setPoForm((f) => ({ ...f, items: [...f.items, { name: "", quantity: 1, unitPrice: 0 }] }));
  const removePoItem = (idx: number) => setPoForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updatePoItem = (idx: number, field: string, value: any) => setPoForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));
  const poTotal = poForm.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // GRN form helpers
  const addGrnItem = () => setGrnForm((f) => ({ ...f, items: [...f.items, { name: "", quantity: 1, unitPrice: 0 }] }));
  const removeGrnItem = (idx: number) => setGrnForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateGrnItem = (idx: number, field: string, value: any) => setGrnForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-slate-800 rounded animate-pulse" />
        <div className="h-12 bg-slate-900 border border-slate-800 rounded-lg animate-pulse" />
        <div className="h-96 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Procurement Management</h1>
          <p className="text-sm text-slate-400 mt-1">Purchase orders, goods received, vendor invoices & inventory</p>
        </div>
        <button
          onClick={() => { fetchPOs(); fetchGRNs(); fetchVendorInvoices(); fetchInventory(); fetchVendors(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition whitespace-nowrap ${
              activeTab === tab ? "bg-teal-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Purchase Orders Tab ──────────────────────────────────────────────── */}
      {activeTab === "Purchase Orders" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreatePO(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
              <Plus className="w-4 h-4" /> Create PO
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["PO #", "Vendor", "Total", "Status", "Expected Delivery", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {purchaseOrders.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No purchase orders found</td></tr>
                  ) : (
                    purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-white font-medium">{po.poNumber}</td>
                        <td className="px-4 py-3 text-slate-300">{po.vendor?.name ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-300">{`\u20B9${(po.totalAmount ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${PO_STATUS_COLORS[po.status] ?? "bg-slate-800 text-slate-400"}`}>
                            {po.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          {(po.status === "DRAFT" || po.status === "PENDING") && (
                            <button onClick={() => handleApprovePO(po.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-900/40 text-emerald-300 rounded hover:bg-emerald-900/60 transition">
                              <Check className="w-3 h-3" /> Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── GRN Tab ──────────────────────────────────────────────────────────── */}
      {activeTab === "GRN" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreateGRN(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
              <Plus className="w-4 h-4" /> Create GRN
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["GRN ID", "Vendor", "PO #", "Total", "Status", "Received Date", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {grns.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No GRNs found</td></tr>
                  ) : (
                    grns.map((grn) => (
                      <tr key={grn.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-white font-medium">{grn.grnNumber ?? grn.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-slate-300">{grn.vendor?.name ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-400">{grn.poNumber ?? grn.purchaseOrderId?.slice(0, 8) ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-300">{`\u20B9${(grn.totalAmount ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${GRN_STATUS_COLORS[grn.status] ?? "bg-slate-800 text-slate-400"}`}>
                            {grn.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          {(grn.status === "DRAFT" || grn.status === "PENDING") && (
                            <button onClick={() => handleConfirmGRN(grn.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-900/40 text-emerald-300 rounded hover:bg-emerald-900/60 transition">
                              <CheckCircle2 className="w-3 h-3" /> Confirm
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Vendor Invoices Tab ──────────────────────────────────────────────── */}
      {activeTab === "Vendor Invoices" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreateVI(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
              <Plus className="w-4 h-4" /> Create Invoice
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Invoice #", "Vendor", "Subtotal", "TDS", "Net Payable", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {vendorInvoices.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No vendor invoices found</td></tr>
                  ) : (
                    vendorInvoices.map((vi) => (
                      <tr key={vi.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-white font-medium">{vi.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-300">{vi.vendor?.name ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-300">{`\u20B9${(vi.subtotal ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3 text-slate-400">{`\u20B9${(vi.tds ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3 text-white font-medium">{`\u20B9${(vi.netPayable ?? 0).toLocaleString()}`}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${VI_STATUS_COLORS[vi.status] ?? "bg-slate-800 text-slate-400"}`}>
                            {vi.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {vi.status !== "MATCHED" && vi.status !== "PAID" && (
                              <button onClick={() => handleMatchVI(vi.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-900/40 text-blue-300 rounded hover:bg-blue-900/60 transition" title="3-Way Match">
                                <ArrowRightLeft className="w-3 h-3" /> Match
                              </button>
                            )}
                            {(vi.status === "MATCHED" || vi.status === "PENDING") && (
                              <button onClick={() => handlePayVI(vi.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-900/40 text-teal-300 rounded hover:bg-teal-900/60 transition">
                                <CreditCard className="w-3 h-3" /> Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Inventory Tab ────────────────────────────────────────────────────── */}
      {activeTab === "Inventory" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowInventoryOut(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
              <Minus className="w-4 h-4" /> Inventory Out
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Name", "Category", "Unit", "Current Stock", "Reorder Level", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {inventory.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No inventory items found</td></tr>
                  ) : (
                    inventory.map((item) => {
                      const isLow = item.currentStock < item.reorderLevel;
                      return (
                        <tr key={item.id} className={`transition ${isLow ? "bg-red-950/20 hover:bg-red-950/30" : "hover:bg-slate-800/30"}`}>
                          <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[item.category] ?? "bg-slate-700 text-slate-300"}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                          <td className={`px-4 py-3 font-medium ${isLow ? "text-red-400" : "text-slate-300"}`}>{item.currentStock}</td>
                          <td className="px-4 py-3 text-slate-400">{item.reorderLevel}</td>
                          <td className="px-4 py-3">
                            {isLow ? (
                              <span className="flex items-center gap-1 text-xs text-red-400">
                                <AlertTriangle className="w-3 h-3" /> Low Stock
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-400">In Stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Vendors Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "Vendors" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreateVendor(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Name", "Code", "Contact Person", "Phone", "Email", "Payment Terms", "TDS"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {vendors.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No vendors found</td></tr>
                  ) : (
                    vendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-white font-medium">{v.name}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{v.code}</td>
                        <td className="px-4 py-3 text-slate-300">{v.contactPerson || "-"}</td>
                        <td className="px-4 py-3 text-slate-400">{v.phone || "-"}</td>
                        <td className="px-4 py-3 text-slate-400">{v.email || "-"}</td>
                        <td className="px-4 py-3 text-slate-300">{v.paymentTerms ?? "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${v.tdsApplicable ? "bg-yellow-900/60 text-yellow-300" : "bg-slate-700 text-slate-400"}`}>
                            {v.tdsApplicable ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Create PO Modal ──────────────────────────────────────────────────── */}
      {showCreatePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Create Purchase Order</h2>
              <button onClick={() => setShowCreatePO(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                <select value={poForm.vendorId} onChange={(e) => setPoForm((f) => ({ ...f, vendorId: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500">
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Expected Delivery</label>
                <input type="date" value={poForm.expectedDelivery} onChange={(e) => setPoForm((f) => ({ ...f, expectedDelivery: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Items</label>
                <div className="space-y-2">
                  {poForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" value={item.name} onChange={(e) => updatePoItem(idx, "name", e.target.value)} placeholder="Item name" className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" />
                      <input type="number" value={item.quantity} onChange={(e) => updatePoItem(idx, "quantity", Number(e.target.value))} placeholder="Qty" className="w-20 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
                      <input type="number" value={item.unitPrice} onChange={(e) => updatePoItem(idx, "unitPrice", Number(e.target.value))} placeholder="Price" className="w-28 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
                      <span className="text-sm text-slate-400 w-24 text-right">{`\u20B9${(item.quantity * item.unitPrice).toLocaleString()}`}</span>
                      {poForm.items.length > 1 && <button onClick={() => removePoItem(idx)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                <button onClick={addPoItem} className="mt-2 text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add item</button>
              </div>
              <div className="bg-slate-800 rounded-lg p-3 flex justify-between">
                <span className="text-sm text-slate-400">Total</span>
                <span className="text-sm font-bold text-teal-400">{`\u20B9${poTotal.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreatePO(false)} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition">Cancel</button>
                <button onClick={handleCreatePO} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">Create PO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create GRN Modal ─────────────────────────────────────────────────── */}
      {showCreateGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Create Goods Received Note</h2>
              <button onClick={() => setShowCreateGRN(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                <select value={grnForm.vendorId} onChange={(e) => setGrnForm((f) => ({ ...f, vendorId: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500">
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">PO Reference (optional)</label>
                <select value={grnForm.purchaseOrderId} onChange={(e) => setGrnForm((f) => ({ ...f, purchaseOrderId: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500">
                  <option value="">No PO reference</option>
                  {purchaseOrders.filter((po) => po.status === "APPROVED").map((po) => <option key={po.id} value={po.id}>{po.poNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Items Received</label>
                <div className="space-y-2">
                  {grnForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" value={item.name} onChange={(e) => updateGrnItem(idx, "name", e.target.value)} placeholder="Item name" className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" />
                      <input type="number" value={item.quantity} onChange={(e) => updateGrnItem(idx, "quantity", Number(e.target.value))} placeholder="Qty" className="w-20 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
                      <input type="number" value={item.unitPrice} onChange={(e) => updateGrnItem(idx, "unitPrice", Number(e.target.value))} placeholder="Unit price" className="w-28 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
                      {grnForm.items.length > 1 && <button onClick={() => removeGrnItem(idx)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                <button onClick={addGrnItem} className="mt-2 text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add item</button>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateGRN(false)} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition">Cancel</button>
                <button onClick={handleCreateGRN} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">Create GRN</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Vendor Invoice Modal ──────────────────────────────────────── */}
      {showCreateVI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Create Vendor Invoice</h2>
              <button onClick={() => setShowCreateVI(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Vendor</label>
                <select value={viForm.vendorId} onChange={(e) => setViForm((f) => ({ ...f, vendorId: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500">
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Invoice Number</label>
                <input type="text" value={viForm.invoiceNumber} onChange={(e) => setViForm((f) => ({ ...f, invoiceNumber: e.target.value }))} placeholder="e.g. VND-INV-001" className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Subtotal</label>
                <input type="number" value={viForm.subtotal} onChange={(e) => setViForm((f) => ({ ...f, subtotal: Number(e.target.value) }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">TDS Deduction</label>
                <input type="number" value={viForm.tds} onChange={(e) => setViForm((f) => ({ ...f, tds: Number(e.target.value) }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
              </div>
              <div className="bg-slate-800 rounded-lg p-3 flex justify-between">
                <span className="text-sm text-slate-400">Net Payable</span>
                <span className="text-sm font-bold text-teal-400">{`\u20B9${(viForm.subtotal - viForm.tds).toLocaleString()}`}</span>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateVI(false)} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition">Cancel</button>
                <button onClick={handleCreateVI} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">Create Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Vendor Modal ──────────────────────────────────────────────── */}
      {showCreateVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Add Vendor</h2>
              <button onClick={() => setShowCreateVendor(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { key: "name", label: "Vendor Name", placeholder: "e.g. BioMerieux India" },
                { key: "code", label: "Vendor Code", placeholder: "e.g. VND-001" },
                { key: "contactPerson", label: "Contact Person", placeholder: "Full name" },
                { key: "phone", label: "Phone", placeholder: "+91..." },
                { key: "email", label: "Email", placeholder: "vendor@example.com" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm text-slate-400 mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={(vendorForm as any)[field.key]}
                    onChange={(e) => setVendorForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Payment Terms</label>
                <select value={vendorForm.paymentTerms} onChange={(e) => setVendorForm((f) => ({ ...f, paymentTerms: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500">
                  {["NET_15", "NET_30", "NET_45", "NET_60", "IMMEDIATE"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tds" checked={vendorForm.tdsApplicable} onChange={(e) => setVendorForm((f) => ({ ...f, tdsApplicable: e.target.checked }))} className="rounded border-slate-700 bg-slate-800 text-teal-500 focus:ring-teal-500" />
                <label htmlFor="tds" className="text-sm text-slate-300">TDS Applicable</label>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateVendor(false)} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition">Cancel</button>
                <button onClick={handleCreateVendor} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">Add Vendor</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Inventory Out Modal ──────────────────────────────────────────────── */}
      {showInventoryOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Inventory Out</h2>
              <button onClick={() => setShowInventoryOut(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Item</label>
                <select value={invOutForm.itemId} onChange={(e) => setInvOutForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500">
                  <option value="">Select item...</option>
                  {inventory.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.currentStock} {item.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Quantity</label>
                <input type="number" value={invOutForm.quantity} onChange={(e) => setInvOutForm((f) => ({ ...f, quantity: Number(e.target.value) }))} min={1} className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Order Reference</label>
                <input type="text" value={invOutForm.orderReference} onChange={(e) => setInvOutForm((f) => ({ ...f, orderReference: e.target.value }))} placeholder="e.g. ORD-12345" className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowInventoryOut(false)} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition">Cancel</button>
                <button onClick={handleInventoryOut} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">Confirm Out</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

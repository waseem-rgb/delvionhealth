"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Truck,
  Package,
  ShoppingCart,
  Store,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  name: string;
  contactPerson: string | null;
  gstNumber: string | null;
  paymentTerms: number | null;
  rating: number | null;
  isActive: boolean;
  createdAt: string;
}

interface GRNItem {
  id: string;
  inventoryItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  expiryDate: string | null;
  lotNumber: string | null;
}

interface GRN {
  id: string;
  status: string;
  totalAmount: number | null;
  receivedAt: string | null;
  createdAt: string;
  vendor: { id: string; name: string } | null;
  vendorId: string | null;
  items?: GRNItem[];
}

interface InventoryLot {
  id: string;
  lotNumber: string;
  receivedAt: string;
  remainingQuantity: number;
  unitCost: number;
  expiryDate: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  unit: string;
  isExpiringSoon: boolean;
  lots?: InventoryLot[];
}

interface GRNFormItem {
  inventoryItemId: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitPrice: string;
  expiryDate: string;
  lotNumber: string;
}

// ── Helper Components ───────────────────────────────────────────────────────

function StarRating({
  rating,
  onRate,
}: {
  rating: number | null;
  onRate?: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const effective = hovered || (rating ?? 0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className={`text-lg leading-none transition-colors ${
            s <= effective ? "text-amber-400" : "text-slate-200"
          } ${onRate ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
          onMouseEnter={() => onRate && setHovered(s)}
          onMouseLeave={() => onRate && setHovered(0)}
          onClick={() => onRate?.(s)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function GRNStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    RECEIVED: "bg-green-50 text-green-700 border-green-200",
    PARTIALLY_RECEIVED: "bg-amber-50 text-amber-700 border-amber-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
        map[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// ── Add Vendor Modal ────────────────────────────────────────────────────────

function AddVendorModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
    gstNumber: "",
    paymentTerms: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post("/procurement/vendors", data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create vendor"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Vendor name is required");
      return;
    }
    mutation.mutate({
      name: form.name,
      contactPerson: form.contactPerson || undefined,
      gstNumber: form.gstNumber || undefined,
      paymentTerms: form.paymentTerms
        ? parseInt(form.paymentTerms, 10)
        : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Add Vendor</h2>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Vendor Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Contact Person
            </label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPerson: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                GST Number
              </label>
              <input
                type="text"
                value={form.gstNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gstNumber: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Payment Terms (days)
              </label>
              <input
                type="number"
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Creating..." : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Vendor Modal ───────────────────────────────────────────────────────

function EditVendorModal({
  vendor,
  onClose,
  onSuccess,
}: {
  vendor: Vendor;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: vendor.name,
    contactPerson: vendor.contactPerson ?? "",
    gstNumber: vendor.gstNumber ?? "",
    paymentTerms: vendor.paymentTerms ? String(vendor.paymentTerms) : "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/procurement/vendors/${vendor.id}`, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update vendor"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Vendor name is required");
      return;
    }
    mutation.mutate({
      name: form.name,
      contactPerson: form.contactPerson || undefined,
      gstNumber: form.gstNumber || undefined,
      paymentTerms: form.paymentTerms
        ? parseInt(form.paymentTerms, 10)
        : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Edit Vendor</h2>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Vendor Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Contact Person
            </label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactPerson: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                GST Number
              </label>
              <input
                type="text"
                value={form.gstNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gstNumber: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Payment Terms (days)
              </label>
              <input
                type="number"
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paymentTerms: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create GRN Modal ────────────────────────────────────────────────────────

function CreateGRNModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<GRNFormItem[]>([
    {
      inventoryItemId: "",
      quantityOrdered: "",
      quantityReceived: "",
      unitPrice: "",
      expiryDate: "",
      lotNumber: "",
    },
  ]);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post("/procurement/grn", data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create GRN"
      );
    },
  });

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        inventoryItemId: "",
        quantityOrdered: "",
        quantityReceived: "",
        unitPrice: "",
        expiryDate: "",
        lotNumber: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof GRNFormItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId.trim()) {
      setError("Vendor ID is required");
      return;
    }
    if (items.length === 0) {
      setError("At least one item is required");
      return;
    }
    mutation.mutate({
      vendorId,
      purchaseOrderId: purchaseOrderId || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        quantityOrdered: parseFloat(item.quantityOrdered) || 0,
        quantityReceived: parseFloat(item.quantityReceived) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        expiryDate: item.expiryDate || undefined,
        lotNumber: item.lotNumber || undefined,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Create GRN</h2>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Vendor ID *
              </label>
              <input
                type="text"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                placeholder="Vendor UUID"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Purchase Order ID (optional)
              </label>
              <input
                type="text"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs text-[#1B4F8A] font-semibold hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-lg p-3 space-y-2 relative"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-slate-500">
                      Item {index + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Inventory Item ID
                      </label>
                      <input
                        type="text"
                        value={item.inventoryItemId}
                        onChange={(e) =>
                          updateItem(index, "inventoryItemId", e.target.value)
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Lot Number
                      </label>
                      <input
                        type="text"
                        value={item.lotNumber}
                        onChange={(e) =>
                          updateItem(index, "lotNumber", e.target.value)
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Qty Ordered
                      </label>
                      <input
                        type="number"
                        value={item.quantityOrdered}
                        onChange={(e) =>
                          updateItem(index, "quantityOrdered", e.target.value)
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Qty Received
                      </label>
                      <input
                        type="number"
                        value={item.quantityReceived}
                        onChange={(e) =>
                          updateItem(index, "quantityReceived", e.target.value)
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(index, "unitPrice", e.target.value)
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) =>
                          updateItem(index, "expiryDate", e.target.value)
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/30"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Creating..." : "Create GRN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Consume Stock Modal ─────────────────────────────────────────────────────

function ConsumeStockModal({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { quantity: number }) =>
      api.post(`/procurement/inventory/${item.id}/consume`, data),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to consume stock"
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Enter a valid quantity");
      return;
    }
    mutation.mutate({ quantity: qty });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Consume Stock</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="font-semibold text-slate-800">{item.name}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Current stock:{" "}
            <span className="font-bold text-slate-700">
              {item.currentStock} {item.unit}
            </span>
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Quantity to Consume ({item.unit})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-[#1B4F8A] rounded-lg text-sm font-semibold text-white hover:bg-[#163d6a] disabled:opacity-50"
            >
              {mutation.isPending ? "Consuming..." : "Consume"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Vendors Tab ─────────────────────────────────────────────────────────────

function VendorsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["procurement-vendors", page],
    queryFn: async () => {
      const res = await api.get<{
        data: { data: Vendor[]; meta: { total: number } };
      }>(`/procurement/vendors?page=${page}&limit=20`);
      return res.data.data;
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) =>
      api.post(`/procurement/vendors/${id}/rate`, { rating }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-vendors"] }),
  });

  const columns: ColumnDef<Vendor>[] = [
    {
      header: "Name",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800">{row.original.name}</span>
      ),
    },
    {
      header: "Contact Person",
      cell: ({ row }) => row.original.contactPerson ?? "—",
    },
    {
      header: "GST Number",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.gstNumber ?? "—"}
        </span>
      ),
    },
    {
      header: "Payment Terms",
      cell: ({ row }) =>
        row.original.paymentTerms ? `${row.original.paymentTerms} days` : "—",
    },
    {
      header: "Rating",
      cell: ({ row }) => (
        <StarRating
          rating={row.original.rating}
          onRate={(r) =>
            rateMutation.mutate({ id: row.original.id, rating: r })
          }
        />
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
            row.original.isActive
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-slate-100 text-slate-500 border border-slate-200"
          }`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setEditVendor(row.original)}
          className="px-2 py-1 text-xs font-semibold border border-slate-200 rounded hover:bg-slate-50"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.meta?.total}
        pageSize={20}
        onPageChange={setPage}
      />
      {showAdd && (
        <AddVendorModal
          onClose={() => setShowAdd(false)}
          onSuccess={() =>
            qc.invalidateQueries({ queryKey: ["procurement-vendors"] })
          }
        />
      )}
      {editVendor && (
        <EditVendorModal
          vendor={editVendor}
          onClose={() => setEditVendor(null)}
          onSuccess={() =>
            qc.invalidateQueries({ queryKey: ["procurement-vendors"] })
          }
        />
      )}
    </div>
  );
}

// ── GRN Tab ─────────────────────────────────────────────────────────────────

function GRNTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["procurement-grn", page],
    queryFn: async () => {
      const res = await api.get<{
        data: { data: GRN[]; meta: { total: number } };
      }>(`/procurement/grn?page=${page}&limit=20`);
      return res.data.data;
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/procurement/grn/${id}/receive`, {}),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["procurement-grn"] }),
  });

  const columns: ColumnDef<GRN>[] = [
    {
      header: "GRN #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {row.original.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor",
      cell: ({ row }) => row.original.vendor?.name ?? "—",
    },
    {
      header: "Status",
      cell: ({ row }) => <GRNStatusBadge status={row.original.status} />,
    },
    {
      header: "Total Amount",
      cell: ({ row }) =>
        row.original.totalAmount != null
          ? formatCurrency(Number(row.original.totalAmount))
          : "—",
    },
    {
      header: "Received At",
      cell: ({ row }) =>
        row.original.receivedAt ? formatDate(row.original.receivedAt) : "—",
    },
    {
      header: "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "DRAFT" ? (
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Mark this GRN as received? This cannot be undone."
                )
              ) {
                receiveMutation.mutate(row.original.id);
              }
            }}
            disabled={receiveMutation.isPending}
            className="px-2 py-1 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
          >
            Receive
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6a]"
        >
          <Plus className="w-4 h-4" /> Create GRN
        </button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.meta?.total}
        pageSize={20}
        onPageChange={setPage}
      />
      {showCreate && (
        <CreateGRNModal
          onClose={() => setShowCreate(false)}
          onSuccess={() =>
            qc.invalidateQueries({ queryKey: ["procurement-grn"] })
          }
        />
      )}
    </div>
  );
}

// ── Inventory Tab (FIFO Lots) ───────────────────────────────────────────────

function InventoryTab() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [consumeItem, setConsumeItem] = useState<InventoryItem | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["procurement-inventory-lots"],
    queryFn: async () => {
      const res = await api.get<{ data: InventoryItem[] }>(
        "/procurement/inventory/lots"
      );
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F8A]" />
      </div>
    );
  }

  const itemList = items ?? [];

  return (
    <div className="space-y-2">
      {itemList.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-12">
          No inventory items found
        </p>
      )}
      {itemList.map((item) => {
        const isExpanded = expandedId === item.id;
        const isLow = item.currentStock <= item.reorderPoint;
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Row Header */}
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="text-slate-400 hover:text-slate-600"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">
                    {item.name}
                  </span>
                  {item.isExpiringSoon && (
                    <span className="flex items-center gap-0.5 text-red-600 text-xs font-semibold">
                      <AlertTriangle className="w-3 h-3" /> Expiring Soon
                    </span>
                  )}
                  {isLow && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Low Stock
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-400">
                  <span>
                    Stock:{" "}
                    <span className="font-semibold text-slate-700">
                      {item.currentStock} {item.unit}
                    </span>
                  </span>
                  <span>
                    Reorder Point:{" "}
                    <span className="font-medium">{item.reorderPoint}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConsumeItem(item)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
              >
                Consume Stock
              </button>
            </div>

            {/* Expanded Lots */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50">
                {!item.lots || item.lots.length === 0 ? (
                  <p className="px-10 py-3 text-xs text-slate-400">
                    No lots available
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-10 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">
                          Lot #
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">
                          Received At
                        </th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider">
                          Remaining
                        </th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider">
                          Unit Cost
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">
                          Expiry
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.lots.map((lot) => (
                        <tr
                          key={lot.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-white"
                        >
                          <td className="px-10 py-2 font-mono text-slate-700">
                            {lot.lotNumber}
                          </td>
                          <td className="px-4 py-2 text-slate-500">
                            {formatDate(lot.receivedAt)}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-700">
                            {lot.remainingQuantity}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600">
                            {formatCurrency(Number(lot.unitCost))}
                          </td>
                          <td className="px-4 py-2 text-slate-500">
                            {lot.expiryDate ? formatDate(lot.expiryDate) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {consumeItem && (
        <ConsumeStockModal
          item={consumeItem}
          onClose={() => setConsumeItem(null)}
          onSuccess={() =>
            qc.invalidateQueries({ queryKey: ["procurement-inventory-lots"] })
          }
        />
      )}
    </div>
  );
}

// ── Purchase Orders Tab ─────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["procurement-po-history", page],
    queryFn: async () => {
      const res = await api.get<{
        data: { data: GRN[]; meta: { total: number } };
      }>(`/procurement/grn?page=${page}&limit=20`);
      return res.data.data;
    },
  });

  const lowStockMutation = useMutation({
    mutationFn: () => api.post("/procurement/low-stock-check", {}),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["procurement-inventory-lots"] }),
  });

  const columns: ColumnDef<GRN>[] = [
    {
      header: "GRN ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {row.original.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor",
      cell: ({ row }) => row.original.vendor?.name ?? "—",
    },
    {
      header: "Status",
      cell: ({ row }) => <GRNStatusBadge status={row.original.status} />,
    },
    {
      header: "Total",
      cell: ({ row }) =>
        row.original.totalAmount != null
          ? formatCurrency(Number(row.original.totalAmount))
          : "—",
    },
    {
      header: "Date",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => lowStockMutation.mutate()}
          disabled={lowStockMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-sm font-semibold hover:bg-amber-100 disabled:opacity-50"
        >
          <AlertTriangle className="w-4 h-4" />
          {lowStockMutation.isPending
            ? "Checking..."
            : "Trigger Low Stock Check"}
        </button>
      </div>
      {lowStockMutation.isSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
          Low stock check completed successfully.
        </div>
      )}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.meta?.total}
        pageSize={20}
        onPageChange={setPage}
      />
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "vendors", label: "Vendors", icon: Store },
  { id: "grn", label: "Goods Received Notes", icon: Truck },
  { id: "inventory", label: "Inventory (FIFO Lots)", icon: Package },
  { id: "po", label: "Purchase Orders", icon: ShoppingCart },
];

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState("vendors");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Procurement</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Vendor management, goods received notes, FIFO inventory, and purchase
          history
        </p>
      </div>

      {/* Tab Nav */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#1B4F8A] text-[#1B4F8A] bg-blue-50/30"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === "vendors" && <VendorsTab />}
          {activeTab === "grn" && <GRNTab />}
          {activeTab === "inventory" && <InventoryTab />}
          {activeTab === "po" && <PurchaseOrdersTab />}
        </div>
      </div>
    </div>
  );
}

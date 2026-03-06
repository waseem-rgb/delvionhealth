"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface OrderPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  collectionType: string;
  totalAmount: string;
  discountAmount: string;
  netAmount: string;
  createdAt: string;
  patient: OrderPatient;
  branch: { id: string; name: string } | null;
  _count: { items: number };
}

interface QueryResponse {
  data: Order[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending Collection", value: "PENDING_COLLECTION" },
  { label: "Collected", value: "SAMPLE_COLLECTED" },
  { label: "Received", value: "RECEIVED" },
  { label: "Processing", value: "IN_PROCESSING" },
  { label: "Resulted", value: "RESULTED" },
  { label: "Reported", value: "REPORTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PRIORITY_FILTERS = [
  { label: "All", value: "" },
  { label: "Routine", value: "ROUTINE" },
  { label: "Urgent", value: "URGENT" },
  { label: "STAT", value: "STAT" },
];

const SOURCE_TABS = [
  { label: "All Sources", value: "" },
  { label: "Walk-in", value: "WALK_IN" },
  { label: "Home Collection", value: "HOME_COLLECTION" },
  { label: "B2B", value: "B2B" },
  { label: "Camp", value: "CAMP" },
  { label: "Outsource", value: "OUTSOURCE_RECEIVED" },
];

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN: "Walk-in",
  HOME_COLLECTION: "Home",
  B2B: "B2B",
  CAMP: "Camp",
  OUTSOURCE_RECEIVED: "Outsource",
};

export default function OrdersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [collectionType, setCollectionType] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({});

  // 'n' keyboard shortcut → new order
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n") router.push("/orders/new");
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [router]);

  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(collectionType && { collectionType }),
    ...(dateRange.from && { dateFrom: dateRange.from }),
    ...(dateRange.to && { dateTo: dateRange.to }),
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["orders", params],
    queryFn: async () => {
      const res = await api.get<{ data: QueryResponse }>(`/orders?${params}`);
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#1B4F8A] font-semibold">
          {row.original.orderNumber}
        </span>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original.patient;
        return (
          <div>
            <p className="font-medium text-slate-900">
              {p.firstName} {p.lastName}
            </p>
            <p className="text-xs text-slate-400 font-mono">{p.mrn}</p>
          </div>
        );
      },
    },
    {
      id: "tests",
      header: "Tests",
      cell: ({ row }) => (
        <span className="text-slate-600">{row.original._count.items}</span>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
          {SOURCE_LABELS[row.original.collectionType] || row.original.collectionType || "Walk-in"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-medium text-slate-900">
          {formatCurrency(Number(row.original.netAmount))}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-slate-500 text-xs">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/orders/${row.original.id}`);
          }}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#1B4F8A] transition"
          title="View"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.meta.total ?? 0} total orders
          </p>
        </div>
        <button
          onClick={() => router.push("/orders/new")}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] hover:bg-[#143C6B] text-white text-sm font-medium rounded-lg transition-colors"
          title="New order (N)"
        >
          <Plus size={16} />
          New Order
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-0.5 border-b border-slate-200 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              status === tab.value
                ? "border-[#1B4F8A] text-[#1B4F8A]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Source filter chips */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium mr-1">Source:</span>
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setCollectionType(tab.value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
              collectionType === tab.value
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by order #, patient name or MRN..."
          />
        </div>

        {/* Priority chips */}
        <div className="flex items-center gap-1.5">
          {PRIORITY_FILTERS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setPriority(p.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                priority === p.value
                  ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <DateRangePicker
          value={dateRange}
          onChange={(r) => { setDateRange(r); setPage(1); }}
          placeholder="Date range"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl card-shadow overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          total={data?.meta.total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

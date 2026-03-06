"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationState {
  pageIndex: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  pagination?: PaginationState;
  onRowClick?: (row: TData) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  className?: string;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  pagination,
  onRowClick,
  emptyMessage = "No data found.",
  emptyAction,
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const startItem = pagination
    ? pagination.pageIndex * pagination.pageSize + 1
    : 1;
  const endItem = pagination
    ? Math.min((pagination.pageIndex + 1) * pagination.pageSize, pagination.total)
    : data.length;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-100">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 first:rounded-tl-lg last:rounded-tr-lg"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                          <Inbox size={24} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600 mb-1">{emptyMessage}</p>
                        {emptyAction && (
                          <button
                            onClick={emptyAction.onClick}
                            className="mt-2 text-sm text-[#0D7E8A] hover:underline font-medium"
                          >
                            {emptyAction.label}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-50 transition-colors hover:bg-slate-50/60",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
          <p className="text-xs text-slate-500">
            Showing {startItem}–{endItem} of {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange && (
              <select
                value={pagination.pageSize}
                onChange={(e) => pagination.onPageSizeChange?.(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s} / page</option>
                ))}
              </select>
            )}
            <button
              onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
              disabled={pagination.pageIndex === 0}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-slate-700 font-medium px-1">
              {pagination.pageIndex + 1} / {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
              disabled={endItem >= pagination.total}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

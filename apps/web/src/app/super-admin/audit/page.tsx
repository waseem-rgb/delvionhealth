'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import api from '@/lib/api';

interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  tenantId?: string;
  tenantName?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

const LIMIT = 50;

function JsonDetails({ details }: { details: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(details, null, 2);
  const preview = JSON.stringify(details).slice(0, 60) + (JSON.stringify(details).length > 60 ? '...' : '');

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs transition-colors"
        style={{ color: '#64748b' }}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRightIcon size={11} />}
        <span className="font-mono" style={{ color: '#818cf8' }}>
          {expanded ? 'Hide' : preview}
        </span>
      </button>
      {expanded && (
        <pre
          className="mt-2 p-3 rounded-lg text-xs font-mono overflow-x-auto"
          style={{
            backgroundColor: '#0A1628',
            color: '#94a3b8',
            border: '1px solid rgba(255,255,255,0.06)',
            maxWidth: '400px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {json}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tenantFilter, setTenantFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(
    async (p: number, tenantId: string, action: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(LIMIT),
        });
        if (tenantId.trim()) params.set('tenantId', tenantId.trim());
        if (action.trim()) params.set('action', action.trim());
        const res = await api.get<{ data: AuditLogResponse }>(
          `/super-admin/audit-log?${params.toString()}`
        );
        const payload = res.data.data;
        setEntries(payload.data ?? []);
        setTotal(payload.meta?.total ?? 0);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchLogs(page, tenantFilter, actionFilter);
  }, [page, fetchLogs]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        void fetchLogs(page, tenantFilter, actionFilter);
      }, 30_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, page, tenantFilter, actionFilter, fetchLogs]);

  const handleSearch = () => {
    setPage(1);
    void fetchLogs(1, tenantFilter, actionFilter);
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            {total.toLocaleString('en-IN')} total events
          </p>
        </div>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: autoRefresh ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.08)',
            color: autoRefresh ? '#0D9488' : '#94a3b8',
            border: `1px solid ${autoRefresh ? 'rgba(13,148,136,0.3)' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
          Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filter by Tenant ID..."
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: '#1B2B4B',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#ffffff',
            minWidth: '220px',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
        />
        <input
          type="text"
          placeholder="Filter by Action..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: '#1B2B4B',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#ffffff',
            minWidth: '180px',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#0D9488' }}
        >
          Search
        </button>
        <button
          onClick={() => {
            setTenantFilter('');
            setActionFilter('');
            setPage(1);
            void fetchLogs(1, '', '');
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B2B4B' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Timestamp', 'Actor', 'Action', 'Target', 'Tenant', 'Details'].map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: '#64748b' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12" style={{ color: '#94a3b8' }}>
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12" style={{ color: '#64748b' }}>
                    No audit log entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono" style={{ color: '#64748b' }}>
                        {formatDate(entry.createdAt)}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-3">
                      <div>
                        {entry.actorEmail ? (
                          <span className="text-xs text-white">{entry.actorEmail}</span>
                        ) : (
                          <span className="text-xs font-mono" style={{ color: '#64748b' }}>
                            {entry.actorId ?? 'System'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(13,148,136,0.12)',
                          color: '#0D9488',
                        }}
                      >
                        {entry.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="px-4 py-3">
                      {entry.targetType || entry.targetId ? (
                        <div className="text-xs" style={{ color: '#94a3b8' }}>
                          {entry.targetType && (
                            <span style={{ color: '#64748b' }}>{entry.targetType}: </span>
                          )}
                          <span className="font-mono">{entry.targetId ?? ''}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#475569' }}>—</span>
                      )}
                    </td>

                    {/* Tenant */}
                    <td className="px-4 py-3">
                      {entry.tenantName ? (
                        <span className="text-xs text-white">{entry.tenantName}</span>
                      ) : entry.tenantId ? (
                        <span className="text-xs font-mono" style={{ color: '#64748b' }}>
                          {entry.tenantId.slice(0, 8)}...
                        </span>
                      ) : (
                        <span style={{ color: '#475569' }}>Platform</span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3" style={{ maxWidth: '200px' }}>
                      {entry.details && Object.keys(entry.details).length > 0 ? (
                        <JsonDetails details={entry.details} />
                      ) : (
                        <span className="text-xs" style={{ color: '#475569' }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-xs" style={{ color: '#64748b' }}>
            Page {page} of {totalPages} ({total.toLocaleString('en-IN')} total events)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

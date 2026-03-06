'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription?: {
    planName: string;
  };
  _count?: {
    users: number;
  };
}

interface TenantsResponse {
  data: Tenant[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Active' },
  TRIAL: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Trial' },
  SUSPENDED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Suspended' },
  CANCELLED: { bg: 'rgba(100,116,139,0.15)', color: '#64748b', label: 'Cancelled' },
};

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'];

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [suspendModal, setSuspendModal] = useState<{ open: boolean; tenantId: string; tenantName: string }>({
    open: false,
    tenantId: '',
    tenantName: '',
  });
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 20;

  const fetchTenants = useCallback(async (p: number, s: string, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
      });
      if (s) params.set('search', s);
      if (status !== 'ALL') params.set('status', status);
      const res = await api.get<{ data: TenantsResponse }>(`/super-admin/tenants?${params.toString()}`);
      const payload = res.data.data;
      setTenants(payload.data ?? []);
      setTotal(payload.meta?.total ?? 0);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTenants(page, search, statusFilter);
  }, [page, statusFilter, fetchTenants]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      void fetchTenants(1, value, statusFilter);
    }, 300);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return;
    setSuspending(true);
    try {
      await api.put(`/super-admin/tenants/${suspendModal.tenantId}/suspend`, {
        reason: suspendReason,
      });
      setSuspendModal({ open: false, tenantId: '', tenantName: '' });
      setSuspendReason('');
      void fetchTenants(page, search, statusFilter);
    } catch {
      // silently fail
    } finally {
      setSuspending(false);
    }
  };

  const handleReactivate = async (tenantId: string) => {
    try {
      await api.put(`/super-admin/tenants/${tenantId}/reactivate`);
      void fetchTenants(page, search, statusFilter);
    } catch {
      // silently fail
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            {total} tenant{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => router.push('/super-admin/provision')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#0D9488' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0b7a70')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0D9488')}
        >
          <Plus size={15} />
          Provision New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white outline-none focus:ring-1"
            style={{
              backgroundColor: '#1B2B4B',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ffffff',
            }}
          />
        </div>

        {/* Status filter buttons */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: statusFilter === s ? '#0D9488' : '#1B2B4B',
                color: statusFilter === s ? '#ffffff' : '#94a3b8',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {s === 'ALL' ? 'All' : STATUS_COLORS[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B2B4B' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Tenant Name', 'Slug', 'Plan', 'Status', 'Users', 'Created', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: '#64748b' }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12" style={{ color: '#94a3b8' }}>
                    Loading...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12" style={{ color: '#64748b' }}>
                    No tenants found
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const statusInfo = STATUS_COLORS[tenant.status] ?? STATUS_COLORS.CANCELLED;
                  return (
                    <tr
                      key={tenant.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'rgba(13,148,136,0.15)' }}
                          >
                            <Building2 size={13} style={{ color: '#0D9488' }} />
                          </div>
                          <span className="font-medium text-white">{tenant.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs" style={{ color: '#94a3b8' }}>
                          {tenant.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span style={{ color: '#94a3b8' }}>
                          {tenant.subscription?.planName ?? 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                        {tenant._count?.users ?? 0}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                        {new Date(tenant.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                          >
                            View
                          </button>
                          {tenant.status !== 'SUSPENDED' && tenant.status !== 'CANCELLED' && (
                            <button
                              onClick={() =>
                                setSuspendModal({
                                  open: true,
                                  tenantId: tenant.id,
                                  tenantName: tenant.name,
                                })
                              }
                              className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: 'rgba(234,179,8,0.15)',
                                color: '#eab308',
                              }}
                            >
                              Suspend
                            </button>
                          )}
                          {tenant.status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleReactivate(tenant.id)}
                              className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: 'rgba(16,185,129,0.15)',
                                color: '#10b981',
                              }}
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
            Page {page} of {totalPages} ({total} total)
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

      {/* Suspend Modal */}
      {suspendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="rounded-xl p-6 w-full max-w-md shadow-2xl"
            style={{ backgroundColor: '#1B2B4B', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(234,179,8,0.15)' }}
              >
                <AlertTriangle size={18} style={{ color: '#eab308' }} />
              </div>
              <div>
                <h3 className="font-semibold text-white">Suspend Tenant</h3>
                <p className="text-xs" style={{ color: '#94a3b8' }}>
                  {suspendModal.tenantName}
                </p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
              Please provide a reason for suspending this tenant account.
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="Suspension reason..."
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white resize-none outline-none focus:ring-1"
              style={{
                backgroundColor: '#0F1F3D',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setSuspendModal({ open: false, tenantId: '', tenantName: '' });
                  setSuspendReason('');
                }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSuspend()}
                disabled={suspending || !suspendReason.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#eab308' }}
              >
                {suspending ? 'Suspending...' : 'Suspend Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

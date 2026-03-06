'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  maxUsers: number;
  maxBranches: number;
  adminUser?: {
    email: string;
    firstName: string;
    lastName: string;
  };
  subscription?: {
    planName: string;
    status: string;
    mrr: number;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt?: string;
  };
}

interface FlagOverride {
  flag: {
    key: string;
    name: string;
    category: string;
    description: string;
    defaultValue: boolean;
  };
  override: boolean | null;
  effectiveValue: boolean;
}

interface UsageMetrics {
  users: { current: number; limit: number };
  branches: { current: number; limit: number };
  orders: { current: number; limit: number };
  storage: { current: number; limit: number };
  apiCalls: { current: number; limit: number };
}

interface Plan {
  id: string;
  name: string;
  price: number;
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  TRIAL: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  SUSPENDED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  CANCELLED: { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
};

function ProgressBar({ current, limit, label }: { current: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#0D9488';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: '#64748b' }}>
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [flags, setFlags] = useState<FlagOverride[]>([]);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'flags' | 'usage'>('overview');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantRes, flagsRes, usageRes, plansRes] = await Promise.allSettled([
        api.get<{ data: TenantDetail }>(`/super-admin/tenants/${tenantId}`),
        api.get<{ data: FlagOverride[] }>(`/super-admin/tenants/${tenantId}/flags`),
        api.get<{ data: UsageMetrics }>(`/super-admin/tenants/${tenantId}/usage`),
        api.get<{ data: Plan[] }>('/super-admin/plans'),
      ]);
      if (tenantRes.status === 'fulfilled') {
        setTenant(tenantRes.value.data.data);
        setSelectedPlan(tenantRes.value.data.data.subscription?.planName ?? '');
      }
      if (flagsRes.status === 'fulfilled') setFlags(flagsRes.value.data.data ?? []);
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data.data);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleChangePlan = async () => {
    setChangingPlan(true);
    try {
      await api.put(`/super-admin/tenants/${tenantId}/plan`, { planName: selectedPlan });
      setActionMsg({ type: 'success', text: 'Plan updated successfully.' });
      void fetchAll();
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to update plan.' });
    } finally {
      setChangingPlan(false);
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const handleSuspend = async () => {
    setSuspending(true);
    try {
      await api.put(`/super-admin/tenants/${tenantId}/suspend`, { reason: suspendReason });
      setSuspendModal(false);
      setSuspendReason('');
      void fetchAll();
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to suspend tenant.' });
    } finally {
      setSuspending(false);
    }
  };

  const handleReactivate = async () => {
    try {
      await api.put(`/super-admin/tenants/${tenantId}/reactivate`);
      setActionMsg({ type: 'success', text: 'Tenant reactivated.' });
      void fetchAll();
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to reactivate.' });
    } finally {
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const handleFlagToggle = async (flagKey: string, currentValue: boolean) => {
    try {
      await api.put(`/super-admin/tenants/${tenantId}/flags/${flagKey}`, {
        value: !currentValue,
      });
      setFlags((prev) =>
        prev.map((f) =>
          f.flag.key === flagKey
            ? { ...f, override: !currentValue, effectiveValue: !currentValue }
            : f
        )
      );
    } catch {
      // silently fail
    }
  };

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'flags', label: 'Feature Flags' },
    { key: 'usage', label: 'Usage' },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: '#94a3b8' }}>
        Loading...
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12" style={{ color: '#ef4444' }}>
        Tenant not found.
      </div>
    );
  }

  const statusInfo = STATUS_COLORS[tenant.status] ?? STATUS_COLORS.CANCELLED;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/super-admin/tenants')}
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: '#94a3b8' }}
      >
        <ArrowLeft size={14} /> Back to Tenants
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm font-mono" style={{ color: '#64748b' }}>
              {tenant.slug}
            </span>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
            >
              {tenant.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tenant.status !== 'SUSPENDED' && tenant.status !== 'CANCELLED' && (
            <button
              onClick={() => setSuspendModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308' }}
            >
              Suspend
            </button>
          )}
          {tenant.status === 'SUSPENDED' && (
            <button
              onClick={() => void handleReactivate()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              Reactivate
            </button>
          )}
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm"
          style={{
            backgroundColor:
              actionMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: actionMsg.type === 'success' ? '#10b981' : '#ef4444',
            border: `1px solid ${actionMsg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          {actionMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {actionMsg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: activeTab === tab.key ? '#0D9488' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #0D9488' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: '#1B2B4B' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>
                Tenant Info
              </h3>
              {[
                { label: 'Name', value: tenant.name },
                { label: 'Slug', value: tenant.slug },
                { label: 'Status', value: tenant.status },
                { label: 'Plan', value: tenant.subscription?.planName ?? 'N/A' },
                { label: 'Admin Email', value: tenant.adminUser?.email ?? 'N/A' },
                {
                  label: 'Created',
                  value: new Date(tenant.createdAt).toLocaleDateString('en-IN'),
                },
                { label: 'Max Users', value: String(tenant.maxUsers ?? 'N/A') },
                { label: 'Max Branches', value: String(tenant.maxBranches ?? 'N/A') },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-2">
                  <span className="text-xs" style={{ color: '#64748b' }}>
                    {item.label}
                  </span>
                  <span className="text-xs font-medium text-right" style={{ color: '#94a3b8' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Subscription card */}
            <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: '#1B2B4B' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748b' }}>
                Subscription
              </h3>
              {tenant.subscription ? (
                <>
                  {[
                    { label: 'Status', value: tenant.subscription.status },
                    { label: 'MRR', value: formatINR(tenant.subscription.mrr ?? 0) },
                    { label: 'Billing Cycle', value: tenant.subscription.billingCycle ?? 'N/A' },
                    {
                      label: 'Period Start',
                      value: tenant.subscription.currentPeriodStart
                        ? new Date(tenant.subscription.currentPeriodStart).toLocaleDateString('en-IN')
                        : 'N/A',
                    },
                    {
                      label: 'Period End',
                      value: tenant.subscription.currentPeriodEnd
                        ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('en-IN')
                        : 'N/A',
                    },
                    {
                      label: 'Trial Ends',
                      value: tenant.subscription.trialEndsAt
                        ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString('en-IN')
                        : 'N/A',
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-2">
                      <span className="text-xs" style={{ color: '#64748b' }}>
                        {item.label}
                      </span>
                      <span className="text-xs font-medium text-right" style={{ color: '#94a3b8' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs" style={{ color: '#64748b' }}>
                  No subscription data
                </p>
              )}
            </div>
          </div>

          {/* Plan change */}
          <div className="rounded-xl p-5" style={{ backgroundColor: '#1B2B4B' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748b' }}>
              Change Plan
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              >
                <option value="">Select plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void handleChangePlan()}
                disabled={changingPlan || !selectedPlan}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#0D9488' }}
              >
                {changingPlan ? 'Updating...' : 'Change Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Flags Tab */}
      {activeTab === 'flags' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B2B4B' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-sm font-semibold text-white">Feature Flag Overrides</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Toggle flags for this specific tenant. Overrides take precedence over defaults.
            </p>
          </div>
          {flags.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#64748b' }}>
              No feature flags configured
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {flags.map((item) => (
                <div key={item.flag.key} className="flex items-center justify-between px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{item.flag.name}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          color: '#64748b',
                        }}
                      >
                        {item.flag.category}
                      </span>
                      {item.override !== null && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(99,102,241,0.15)',
                            color: '#818cf8',
                          }}
                        >
                          Override
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>
                      {item.flag.description ?? item.flag.key}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleFlagToggle(item.flag.key, item.effectiveValue)}
                    className="relative ml-4 inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors"
                    style={{
                      backgroundColor: item.effectiveValue ? '#0D9488' : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                      style={{
                        transform: item.effectiveValue ? 'translateX(18px)' : 'translateX(2px)',
                        marginTop: '2px',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="rounded-xl p-6 space-y-5" style={{ backgroundColor: '#1B2B4B' }}>
          <h3 className="text-sm font-semibold text-white">Usage Metrics</h3>
          {!usage ? (
            <p className="text-sm" style={{ color: '#64748b' }}>
              No usage data available
            </p>
          ) : (
            <div className="space-y-4">
              {usage.users && (
                <ProgressBar current={usage.users.current} limit={usage.users.limit} label="Users" />
              )}
              {usage.branches && (
                <ProgressBar
                  current={usage.branches.current}
                  limit={usage.branches.limit}
                  label="Branches"
                />
              )}
              {usage.orders && (
                <ProgressBar
                  current={usage.orders.current}
                  limit={usage.orders.limit}
                  label="Monthly Orders"
                />
              )}
              {usage.storage && (
                <ProgressBar
                  current={usage.storage.current}
                  limit={usage.storage.limit}
                  label="Storage (GB)"
                />
              )}
              {usage.apiCalls && (
                <ProgressBar
                  current={usage.apiCalls.current}
                  limit={usage.apiCalls.limit}
                  label="API Calls (monthly)"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="rounded-xl p-6 w-full max-w-md shadow-2xl"
            style={{ backgroundColor: '#1B2B4B', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <h3 className="font-semibold text-white mb-2">Suspend Tenant</h3>
            <p className="text-sm mb-4" style={{ color: '#94a3b8' }}>
              Please provide a reason for suspending <strong>{tenant.name}</strong>.
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="Suspension reason..."
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white resize-none outline-none"
              style={{
                backgroundColor: '#0F1F3D',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
              }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSuspendModal(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSuspend()}
                disabled={suspending || !suspendReason.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#eab308' }}
              >
                {suspending ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

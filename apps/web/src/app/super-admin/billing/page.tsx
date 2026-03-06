'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Building2, Users, IndianRupee } from 'lucide-react';
import api from '@/lib/api';

interface PlatformStats {
  totalMRR: number;
  arr: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  totalTenants: number;
}

interface Tenant {
  id: string;
  name: string;
  status: string;
  subscription?: {
    planName: string;
    mrr: number;
    billingCycle: string;
    currentPeriodEnd: string;
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

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

function KPICard({
  title,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl p-5 flex items-center gap-4" style={{ backgroundColor: '#1B2B4B' }}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}20` }}
      >
        <Icon size={22} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
          {title}
        </p>
        <p className="text-xl font-bold text-white mt-0.5">{value}</p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// Group tenants by plan for breakdown
function groupByPlan(tenants: Tenant[]): Record<string, { count: number; totalMRR: number }> {
  const result: Record<string, { count: number; totalMRR: number }> = {};
  for (const t of tenants) {
    const plan = t.subscription?.planName ?? 'Unknown';
    if (!result[plan]) result[plan] = { count: 0, totalMRR: 0 };
    result[plan].count += 1;
    result[plan].totalMRR += t.subscription?.mrr ?? 0;
  }
  return result;
}

export default function PlatformBillingPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [statsRes, tenantsRes] = await Promise.allSettled([
          api.get<{ data: PlatformStats }>('/super-admin/stats'),
          api.get<{ data: TenantsResponse }>('/super-admin/tenants?status=ACTIVE&limit=100'),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data);
        if (tenantsRes.status === 'fulfilled') {
          setTenants(tenantsRes.value.data.data?.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, []);

  const planBreakdown = groupByPlan(tenants);
  const planEntries = Object.entries(planBreakdown).sort((a, b) => b[1].totalMRR - a[1].totalMRR);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Billing</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          Revenue metrics and subscription overview
        </p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl p-5 h-24 animate-pulse"
              style={{ backgroundColor: '#1B2B4B' }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            title="Total MRR"
            value={formatINR(stats?.totalMRR ?? 0)}
            icon={IndianRupee}
            accent="#0D9488"
            sub="Monthly Recurring Revenue"
          />
          <KPICard
            title="ARR"
            value={formatINR(stats?.arr ?? 0)}
            icon={TrendingUp}
            accent="#6366f1"
            sub="Annual Recurring Revenue"
          />
          <KPICard
            title="Active Subscriptions"
            value={String(stats?.activeTenants ?? 0)}
            icon={Building2}
            accent="#3b82f6"
            sub="Paying tenants"
          />
          <KPICard
            title="Trial Tenants"
            value={String(stats?.trialTenants ?? 0)}
            icon={Users}
            accent="#f59e0b"
            sub="Pending conversion"
          />
        </div>
      )}

      {/* Plan Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR by Plan */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1B2B4B' }}>
          <h2 className="text-sm font-semibold text-white mb-4">MRR by Plan</h2>
          {loading ? (
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Loading...
            </p>
          ) : planEntries.length === 0 ? (
            <p className="text-sm" style={{ color: '#64748b' }}>
              No active subscriptions
            </p>
          ) : (
            <div className="space-y-3">
              {planEntries.map(([plan, data]) => {
                const totalMRR = stats?.totalMRR ?? 1;
                const pct = totalMRR > 0 ? (data.totalMRR / totalMRR) * 100 : 0;
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                        {plan}
                        <span className="ml-2 text-xs" style={{ color: '#64748b' }}>
                          ({data.count} tenants)
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {formatINR(data.totalMRR)}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: '#0D9488' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tenant count breakdown */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1B2B4B' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Tenant Status Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Active', count: stats?.activeTenants ?? 0, color: '#10b981' },
              { label: 'Trial', count: stats?.trialTenants ?? 0, color: '#3b82f6' },
              { label: 'Suspended', count: stats?.suspendedTenants ?? 0, color: '#ef4444' },
            ].map((item) => {
              const total = stats?.totalTenants ?? 1;
              const pct = total > 0 ? (item.count / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                      {item.label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: item.color }}>
                      {item.count}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tenant billing table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B2B4B' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-sm font-semibold text-white">Active Tenant Subscriptions</h2>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            All paying tenants and their subscription details
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Tenant Name', 'Plan', 'MRR', 'Billing Cycle', 'Next Payment'].map((col) => (
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
                  <td colSpan={5} className="text-center py-10" style={{ color: '#94a3b8' }}>
                    Loading...
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10" style={{ color: '#64748b' }}>
                    No active subscriptions
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-4 py-3 font-medium text-white">{tenant.name}</td>
                    <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                      {tenant.subscription?.planName ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#0D9488' }}>
                      {formatINR(tenant.subscription?.mrr ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          color: '#94a3b8',
                        }}
                      >
                        {tenant.subscription?.billingCycle ?? 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                      {tenant.subscription?.currentPeriodEnd
                        ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString(
                            'en-IN',
                            { day: '2-digit', month: 'short', year: 'numeric' }
                          )
                        : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

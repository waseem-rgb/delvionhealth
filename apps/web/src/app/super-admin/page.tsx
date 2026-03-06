'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, Building2, TrendingUp, Users } from 'lucide-react';
import api from '@/lib/api';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  totalUsers: number;
  totalOrders: number;
  totalMRR: number;
  arr: number;
}

interface MRRTrendPoint {
  month: string;
  mrr: number;
  tenantCount: number;
}

interface HealthStatus {
  database: 'ok' | 'error';
  timestamp: string;
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
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4"
      style={{ backgroundColor: '#1B2B4B' }}
    >
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
      </div>
    </div>
  );
}

export default function SuperAdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [mrrTrend, setMrrTrend] = useState<MRRTrendPoint[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [statsRes, trendRes, healthRes] = await Promise.allSettled([
          api.get<{ data: PlatformStats }>('/super-admin/stats'),
          api.get<{ data: MRRTrendPoint[] }>('/super-admin/mrr-trend?months=12'),
          api.get<{ data: HealthStatus }>('/super-admin/health'),
        ]);

        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data.data);
        }
        if (trendRes.status === 'fulfilled') {
          setMrrTrend(trendRes.value.data.data ?? []);
        }
        if (healthRes.status === 'fulfilled') {
          setHealth(healthRes.value.data.data);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, []);

  const dbOk = health?.database === 'ok';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          Real-time platform health and revenue metrics
        </p>
      </div>

      {/* Health Banner */}
      {!loading && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: dbOk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${dbOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: dbOk ? '#10b981' : '#ef4444',
          }}
        >
          <span>
            Database: {dbOk ? 'OK ✓' : 'ERROR ✗'}
          </span>
          <span className="mx-2" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span style={{ color: dbOk ? '#10b981' : '#ef4444' }}>
            {dbOk ? 'Platform Healthy' : 'Platform Issue Detected'}
          </span>
          {health?.timestamp && (
            <>
              <span className="mx-2" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span className="text-xs" style={{ color: '#64748b' }}>
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </span>
            </>
          )}
        </div>
      )}

      {/* KPI Strip */}
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
            icon={TrendingUp}
            accent="#0D9488"
          />
          <KPICard
            title="ARR"
            value={formatINR(stats?.arr ?? 0)}
            icon={Activity}
            accent="#6366f1"
          />
          <KPICard
            title="Active Tenants"
            value={String(stats?.activeTenants ?? 0)}
            icon={Building2}
            accent="#3b82f6"
          />
          <KPICard
            title="Trial Tenants"
            value={String(stats?.trialTenants ?? 0)}
            icon={Users}
            accent="#f59e0b"
          />
        </div>
      )}

      {/* MRR Trend Chart */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#1B2B4B' }}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">MRR Trend</h2>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            Monthly Recurring Revenue — last 12 months
          </p>
        </div>
        {loading ? (
          <div className="h-[250px] flex items-center justify-center" style={{ color: '#94a3b8' }}>
            Loading...
          </div>
        ) : mrrTrend.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center" style={{ color: '#64748b' }}>
            No trend data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={mrrTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [formatINR(value), 'MRR']}
                contentStyle={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: 12,
                  color: '#fff',
                }}
              />
              <Area
                type="monotone"
                dataKey="mrr"
                stroke="#0D9488"
                strokeWidth={2}
                fill="url(#mrrGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#0D9488' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1B2B4B' }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>Total Tenants</p>
          <p className="text-2xl font-bold text-white">{stats?.totalTenants ?? 0}</p>
          <div className="mt-2 flex gap-3 text-xs" style={{ color: '#64748b' }}>
            <span style={{ color: '#ef4444' }}>{stats?.suspendedTenants ?? 0} suspended</span>
          </div>
        </div>
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1B2B4B' }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>Total Users</p>
          <p className="text-2xl font-bold text-white">
            {(stats?.totalUsers ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="mt-2 text-xs" style={{ color: '#64748b' }}>Across all tenants</p>
        </div>
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1B2B4B' }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>Total Orders</p>
          <p className="text-2xl font-bold text-white">
            {(stats?.totalOrders ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="mt-2 text-xs" style={{ color: '#64748b' }}>Platform-wide</p>
        </div>
      </div>

      {/* Recent Tenants placeholder */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#1B2B4B' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Platform Activity</h2>
        {loading ? (
          <p className="text-sm" style={{ color: '#94a3b8' }}>Loading...</p>
        ) : (
          <p className="text-sm" style={{ color: '#64748b' }}>
            Navigate to{' '}
            <a href="/super-admin/tenants" style={{ color: '#0D9488' }}>
              Tenants
            </a>{' '}
            to view and manage all tenant accounts.
          </p>
        )}
      </div>
    </div>
  );
}

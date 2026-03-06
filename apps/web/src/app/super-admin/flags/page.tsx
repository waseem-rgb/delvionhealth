'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Info } from 'lucide-react';
import api from '@/lib/api';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultValue: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  modules: 'Modules',
  ai: 'AI Features',
  integrations: 'Integrations',
  enterprise: 'Enterprise',
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchFlags = async () => {
      setLoading(true);
      try {
        const res = await api.get<{ data: FeatureFlag[] }>('/super-admin/feature-flags');
        setFlags(res.data.data ?? []);
      } catch {
        setFlags([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchFlags();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return flags;
    const q = search.toLowerCase();
    return flags.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [flags, search]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, FeatureFlag[]> = {};
    for (const flag of filtered) {
      const cat = flag.category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(flag);
    }
    return groups;
  }, [filtered]);

  const categories = Object.keys(grouped).sort();

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Feature Flags</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          Platform-wide feature flag defaults — override per tenant from the Tenant Detail page
        </p>
      </div>

      {/* Info Panel */}
      <div
        className="flex items-start gap-3 px-4 py-4 rounded-xl"
        style={{
          backgroundColor: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.25)',
        }}
      >
        <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#818cf8' }} />
        <div className="text-sm" style={{ color: '#c7d2fe' }}>
          <strong className="text-white">How flag overrides work:</strong> These are the global
          default values for all tenants. You can override individual flags per tenant from the
          Tenant Detail page under the &quot;Feature Flags&quot; tab. Tenant-level overrides always
          take precedence over these defaults.
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
        <input
          type="text"
          placeholder="Search flags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white outline-none"
          style={{
            backgroundColor: '#1B2B4B',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#ffffff',
          }}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center" style={{ color: '#94a3b8' }}>
          Loading...
        </div>
      ) : categories.length === 0 ? (
        <div className="py-12 text-center" style={{ color: '#64748b' }}>
          No flags found
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const catFlags = grouped[cat] ?? [];
            const isCollapsed = collapsed[cat];
            const label = CATEGORY_LABELS[cat] ?? cat;
            const enabledCount = catFlags.filter((f) => f.defaultValue).length;
            return (
              <div key={cat} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B2B4B' }}>
                {/* Category header */}
                <button
                  onClick={() => toggleCollapse(cat)}
                  className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
                  style={{ borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')
                  }
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight size={14} style={{ color: '#64748b' }} />
                    ) : (
                      <ChevronDown size={14} style={{ color: '#64748b' }} />
                    )}
                    <span className="font-semibold text-sm text-white">{label}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: 'rgba(13,148,136,0.15)', color: '#0D9488' }}
                    >
                      {catFlags.length} flags
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: '#64748b' }}>
                    {enabledCount} enabled by default
                  </span>
                </button>

                {/* Flags list */}
                {!isCollapsed && (
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {catFlags.map((flag) => (
                      <div key={flag.key} className="flex items-center justify-between px-5 py-3.5">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{flag.name}</span>
                            <span
                              className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                color: '#64748b',
                              }}
                            >
                              {flag.key}
                            </span>
                          </div>
                          {flag.description && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: '#64748b' }}>
                              {flag.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={
                              flag.defaultValue
                                ? {
                                    backgroundColor: 'rgba(16,185,129,0.15)',
                                    color: '#10b981',
                                  }
                                : {
                                    backgroundColor: 'rgba(239,68,68,0.15)',
                                    color: '#ef4444',
                                  }
                            }
                          >
                            {flag.defaultValue ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {!loading && flags.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: '#1B2B4B' }}>
          <div className="flex items-center gap-6 text-xs" style={{ color: '#64748b' }}>
            <span>Total: <strong className="text-white">{flags.length}</strong> flags</span>
            <span>
              Enabled by default:{' '}
              <strong style={{ color: '#10b981' }}>
                {flags.filter((f) => f.defaultValue).length}
              </strong>
            </span>
            <span>
              Disabled by default:{' '}
              <strong style={{ color: '#ef4444' }}>
                {flags.filter((f) => !f.defaultValue).length}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

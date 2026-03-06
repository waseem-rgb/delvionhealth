'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import api from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  features?: string[];
  maxUsers?: number;
  maxBranches?: number;
}

interface ProvisionForm {
  labName: string;
  adminEmail: string;
  adminName: string;
  adminPhone: string;
  city: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  maxUsers: number;
  maxBranches: number;
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export default function ProvisionPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState<ProvisionForm>({
    labName: '',
    adminEmail: '',
    adminName: '',
    adminPhone: '',
    city: '',
    planName: '',
    billingCycle: 'MONTHLY',
    maxUsers: 10,
    maxBranches: 1,
  });

  useEffect(() => {
    const fetchPlans = async () => {
      setPlansLoading(true);
      try {
        const res = await api.get<{ data: Plan[] }>('/super-admin/plans');
        setPlans(res.data.data ?? []);
      } catch {
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };
    void fetchPlans();
  }, []);

  const handlePlanSelect = (plan: Plan) => {
    setForm((prev) => ({
      ...prev,
      planName: plan.name,
      maxUsers: plan.maxUsers ?? prev.maxUsers,
      maxBranches: plan.maxBranches ?? prev.maxBranches,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.labName || !form.adminEmail || !form.adminName || !form.planName) {
      setErrorMsg('Please fill all required fields and select a plan.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      const payload = {
        labName: form.labName,
        adminEmail: form.adminEmail,
        adminName: form.adminName,
        ...(form.adminPhone ? { adminPhone: form.adminPhone } : {}),
        ...(form.city ? { city: form.city } : {}),
        planName: form.planName,
        billingCycle: form.billingCycle,
        maxUsers: form.maxUsers,
        maxBranches: form.maxBranches,
      };
      const res = await api.post<{ data: { id: string; name: string } }>(
        '/super-admin/tenants',
        payload
      );
      setSuccessResult(res.data.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        axiosErr?.response?.data?.message ?? 'Failed to provision tenant. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──
  if (successResult) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: '#1B2B4B',
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
          >
            <CheckCircle size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Tenant Provisioned!</h2>
          <p className="text-sm mb-1" style={{ color: '#94a3b8' }}>
            {successResult.name} has been created.
          </p>
          <p className="text-xs font-mono mb-6" style={{ color: '#64748b' }}>
            Tenant ID: {successResult.id}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/super-admin/tenants/${successResult.id}`)}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#0D9488' }}
            >
              View Tenant
            </button>
            <button
              onClick={() => {
                setSuccessResult(null);
                setForm({
                  labName: '',
                  adminEmail: '',
                  adminName: '',
                  adminPhone: '',
                  city: '',
                  planName: '',
                  billingCycle: 'MONTHLY',
                  maxUsers: 10,
                  maxBranches: 1,
                });
              }}
              className="px-5 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
            >
              Provision Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Provision New Tenant</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          Create a new lab account on the DELViON platform
        </p>
      </div>

      {/* Error */}
      {errorMsg && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}
        >
          <AlertCircle size={14} />
          {errorMsg}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Lab Info */}
        <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: '#1B2B4B' }}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} style={{ color: '#0D9488' }} />
            <h2 className="text-sm font-semibold text-white">Lab Information</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Lab Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.labName}
                onChange={(e) => setForm((f) => ({ ...f, labName: e.target.value }))}
                placeholder="e.g. Apollo Diagnostics Bengaluru"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none focus:ring-1"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Bengaluru"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>
        </div>

        {/* Admin Info */}
        <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: '#1B2B4B' }}>
          <h2 className="text-sm font-semibold text-white mb-2">Admin Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Admin Email <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                placeholder="admin@lab.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Admin Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                placeholder="Dr. John Smith"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Admin Phone
              </label>
              <input
                type="tel"
                value={form.adminPhone}
                onChange={(e) => setForm((f) => ({ ...f, adminPhone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="rounded-xl p-6" style={{ backgroundColor: '#1B2B4B' }}>
          <h2 className="text-sm font-semibold text-white mb-4">
            Select Plan <span style={{ color: '#ef4444' }}>*</span>
          </h2>
          {plansLoading ? (
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Loading plans...
            </p>
          ) : plans.length === 0 ? (
            <p className="text-sm" style={{ color: '#64748b' }}>
              No plans available. Enter plan name manually below.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const selected = form.planName === plan.name;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handlePlanSelect(plan)}
                    className="text-left rounded-xl p-4 transition-all"
                    style={{
                      backgroundColor: selected ? 'rgba(13,148,136,0.15)' : '#0F1F3D',
                      border: `1px solid ${selected ? '#0D9488' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    <p className="font-semibold text-sm text-white">{plan.name}</p>
                    {plan.price !== undefined && (
                      <p className="text-xs mt-0.5" style={{ color: '#0D9488' }}>
                        {formatINR(plan.price)}/mo
                      </p>
                    )}
                    {plan.features && plan.features.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {plan.features.slice(0, 3).map((f, i) => (
                          <li key={i} className="text-xs" style={{ color: '#64748b' }}>
                            • {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Manual plan entry if no plans from API */}
          {plans.length === 0 && (
            <div className="mt-3">
              <input
                type="text"
                value={form.planName}
                onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))}
                placeholder="Plan name (e.g. STARTER, PROFESSIONAL, ENTERPRISE)"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
          )}
        </div>

        {/* Billing & Limits */}
        <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: '#1B2B4B' }}>
          <h2 className="text-sm font-semibold text-white mb-2">Billing & Limits</h2>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>
              Billing Cycle
            </label>
            <div className="flex gap-3">
              {(['MONTHLY', 'ANNUAL'] as const).map((cycle) => (
                <label key={cycle} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={cycle}
                    checked={form.billingCycle === cycle}
                    onChange={() => setForm((f) => ({ ...f, billingCycle: cycle }))}
                    style={{ accentColor: '#0D9488' }}
                  />
                  <span className="text-sm" style={{ color: '#94a3b8' }}>
                    {cycle === 'MONTHLY' ? 'Monthly' : 'Annual (save 20%)'}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Max Users
              </label>
              <input
                type="number"
                min={1}
                value={form.maxUsers}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxUsers: parseInt(e.target.value) || 1 }))
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Max Branches
              </label>
              <input
                type="number"
                min={1}
                value={form.maxBranches}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxBranches: parseInt(e.target.value) || 1 }))
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#0F1F3D',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#0D9488' }}
          >
            {submitting ? 'Provisioning...' : 'Provision Tenant'}
          </button>
        </div>
      </form>
    </div>
  );
}

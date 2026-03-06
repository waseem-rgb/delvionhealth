import type { Metadata } from "next";

export const metadata: Metadata = { title: "Insurance Claims" };

export default function InsurancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Insurance Claims</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
        Insurance claim submission, tracking, and settlement management
      </div>
    </div>
  );
}

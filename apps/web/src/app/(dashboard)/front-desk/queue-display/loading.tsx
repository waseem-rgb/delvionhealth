export default function Loading() {
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-900/40 text-sm">Loading queue display…</p>
      </div>
    </div>
  );
}

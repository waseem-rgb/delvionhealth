export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="w-10 h-10 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
          <div className="h-48 bg-slate-100 rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="h-5 w-28 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-3 w-3/4 bg-slate-200 rounded mb-1" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="h-5 w-28 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-6 w-16 bg-slate-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

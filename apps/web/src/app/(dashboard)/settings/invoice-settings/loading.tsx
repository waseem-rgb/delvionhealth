export default function Loading() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded" />
      <div className="h-4 w-72 bg-slate-100 rounded" />
      <div className="h-48 bg-slate-100 rounded-xl" />
      <div className="h-48 bg-slate-100 rounded-xl" />
    </div>
  );
}

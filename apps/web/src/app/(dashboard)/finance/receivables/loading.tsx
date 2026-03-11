export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-red-500 font-medium">Something went wrong</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

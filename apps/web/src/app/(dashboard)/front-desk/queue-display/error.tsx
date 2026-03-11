"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-red-400 text-lg font-semibold">Queue display error</p>
        <p className="text-slate-900/40 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-teal-600 text-slate-900 rounded-lg text-sm hover:bg-teal-500"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

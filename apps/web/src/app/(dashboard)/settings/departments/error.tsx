"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center space-y-4">
        <p className="text-red-500 font-semibold">Failed to load departments</p>
        <p className="text-slate-400 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-500"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

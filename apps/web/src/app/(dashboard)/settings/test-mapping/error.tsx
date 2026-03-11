"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="p-6 text-center">
      <p className="text-slate-500 mb-4">Failed to load Test Mapping.</p>
      <button onClick={reset} className="px-4 py-2 bg-[#0D7E8A] text-white rounded-lg text-sm">
        Try again
      </button>
    </div>
  );
}

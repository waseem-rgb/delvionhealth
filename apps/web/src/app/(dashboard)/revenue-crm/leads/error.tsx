"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-400">{error.message || "Something went wrong"}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm"
      >
        Try again
      </button>
    </div>
  );
}

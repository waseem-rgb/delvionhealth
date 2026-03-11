"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <p className="text-sm text-slate-500">
        {error.message || "Something went wrong loading Bill Settings."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#0D7E8A] text-white text-sm rounded-lg hover:bg-[#0B6B75]"
      >
        Try again
      </button>
    </div>
  );
}

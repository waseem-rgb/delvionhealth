"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <p className="text-red-400 text-sm">{error.message || "Something went wrong"}</p>
      <button onClick={reset} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg">
        Try Again
      </button>
    </div>
  );
}


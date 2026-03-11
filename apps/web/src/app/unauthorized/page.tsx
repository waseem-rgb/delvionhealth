export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">403</h1>
        <p className="text-slate-400 mb-6">You don&apos;t have permission to access this page.</p>
        <a href="/dashboard" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — dark branding */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-[#0F1923] via-[#1a3a5c] to-[#0D7E8A]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#0D7E8A]/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#1B4F8A]/30 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-xl backdrop-blur-sm">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 8v8c0 7.73 5.16 14.97 12 16.93C22.84 30.97 28 23.73 28 16V8L16 2z" fill="#0D7E8A" />
              <path d="M12 16l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">DELViON</p>
            <p className="text-[#0D7E8A] text-xs font-medium">Health</p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/80 font-medium">Global Diagnostic Platform</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Precision diagnostics,
            <br />
            <span className="text-[#0D7E8A]">powered by AI</span>
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            DELViON Health empowers diagnostic labs with real-time intelligence,
            seamless workflows, and clinical-grade reporting.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["LIMS", "AI Results", "Multi-tenant", "HL7/FHIR", "Patient Portal"].map((feat) => (
              <span key={feat} className="px-3 py-1 text-xs rounded-full bg-white/10 border border-white/15 text-white/70">
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex -space-x-2">
              {["RS", "PS", "RM"].map((init) => (
                <div key={init} className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D7E8A] to-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold border-2 border-[#0F1923]">
                  {init}
                </div>
              ))}
            </div>
            <div>
              <p className="text-white text-xs font-medium">Trusted by 500+ labs</p>
              <p className="text-white/50 text-xs">across 12 countries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — white form area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-[#0D7E8A]/10 rounded-xl">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 8v8c0 7.73 5.16 14.97 12 16.93C22.84 30.97 28 23.73 28 16V8L16 2z" fill="#0D7E8A" />
              <path d="M12 16l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-gray-900 font-bold text-lg leading-none">DELViON</p>
            <p className="text-[#0D7E8A] text-xs font-medium">Health</p>
          </div>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 shadow-sm h-16 flex items-center sticky top-0 z-50">
        <div className="max-w-5xl mx-auto w-full px-4 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1B4F8A] rounded-lg flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">DELViON Health</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Patient Portal</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/portal" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/portal/book" className="hover:text-slate-900 transition-colors">Book Test</Link>
            <Link href="/portal/reports" className="hover:text-slate-900 transition-colors">My Reports</Link>
            <Link href="/portal/track" className="hover:text-slate-900 transition-colors">Track</Link>
            <Link href="/portal/insights" className="hover:text-slate-900 transition-colors">Health Insights</Link>
            <Link href="/portal/family" className="hover:text-slate-900 transition-colors">Family</Link>
            <Link href="/portal/profile" className="hover:text-slate-900 transition-colors">Profile</Link>
          </nav>
        </div>
      </header>
      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>
      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 bg-white">
        © 2025 DELViON Health. All rights reserved. &nbsp;|&nbsp;
        <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span> &nbsp;|&nbsp;
        <span className="hover:text-slate-600 cursor-pointer">Terms</span> &nbsp;|&nbsp;
        <span className="hover:text-slate-600 cursor-pointer">Contact Us</span>
      </footer>
    </div>
  );
}

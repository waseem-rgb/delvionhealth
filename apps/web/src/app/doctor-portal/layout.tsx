import Link from "next/link";
import { Stethoscope } from "lucide-react";

export default function DoctorPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 shadow-sm h-16 flex items-center sticky top-0 z-50">
        <div className="max-w-6xl mx-auto w-full px-4 flex items-center justify-between">
          <Link href="/doctor-portal" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0D7E8A] rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">DELViON Health</span>
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Doctor Portal</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/doctor-portal" className="hover:text-slate-900 transition-colors">Dashboard</Link>
            <Link href="/doctor-portal/patients" className="hover:text-slate-900 transition-colors">My Patients</Link>
            <Link href="/doctor-portal/reports" className="hover:text-slate-900 transition-colors">Reports</Link>
            <Link href="/doctor-portal/referrals" className="hover:text-slate-900 transition-colors">Referrals</Link>
            <Link href="/doctor-portal/profile" className="hover:text-slate-900 transition-colors">Profile</Link>
          </nav>
        </div>
      </header>
      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 bg-white">
        © 2025 DELViON Health. All rights reserved. &nbsp;|&nbsp;
        <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span> &nbsp;|&nbsp;
        <span className="hover:text-slate-600 cursor-pointer">Terms</span>
      </footer>
    </div>
  );
}

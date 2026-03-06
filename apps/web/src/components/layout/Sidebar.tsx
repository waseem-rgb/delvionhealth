"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials, getAvatarColor } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Role } from "@delvion/types";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  FlaskConical,
  Microscope,
  BarChart3,
  Cpu,
  FileText,
  TrendingUp,
  Stethoscope,
  Megaphone,
  Map,
  Receipt,
  Shield,
  BookOpen,
  ShoppingCart,
  UserCheck,
  Clock,
  Banknote,
  CalendarDays,
  CalendarCheck2,
  Plug,
  Key,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Coins,
  Target,
  HeartPulse,
  CheckSquare,
  Send,
  Upload,
  Building2,
  FileSpreadsheet,
  GitMerge,
  Percent,
  ClipboardCheck,
  ScrollText,
  ExternalLink,
  ClipboardPen,
  ScanBarcode,
  Cog,
  ShieldCheck,
  LayoutGrid,
  ClipboardPlus,
  TestTubes,
  Handshake,
  DollarSign,
  Wallet,
  BookOpenCheck,
  Award,
  Tent,
  HeartHandshake,
  Scale,
  Truck,
  GraduationCap,
  Bot,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavGroup {
  label: string;
  roles?: Role[];
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Front Desk",
    roles: [Role.FRONT_DESK, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Registration & Billing", href: "/registration", icon: ClipboardPlus },
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Appointments", href: "/appointments", icon: Calendar },
      { label: "Orders", href: "/orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Lab Operations",
    roles: [Role.FRONT_DESK, Role.LAB_TECHNICIAN, Role.PATHOLOGIST, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Accession", href: "/accession", icon: ScanBarcode },
      { label: "Samples", href: "/samples", icon: TestTubes },
      { label: "Results", href: "/results", icon: FlaskConical },
      { label: "Instruments", href: "/instruments", icon: Cpu },
      { label: "Approvals", href: "/approvals", icon: CheckSquare },
      { label: "Operations", href: "/operations", icon: Cog },
      { label: "Outsourcing", href: "/outsourcing", icon: ExternalLink },
    ],
  },
  {
    label: "Reports & Billing",
    roles: [Role.PATHOLOGIST, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE, Role.FIELD_SALES_REP, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Reports", href: "/reports", icon: FileText },
      { label: "MIS Reports", href: "/reports/mis", icon: FileSpreadsheet },
      { label: "Invoices & Payments", href: "/billing", icon: Receipt },
      { label: "Insurance", href: "/billing/insurance", icon: Shield },
    ],
  },
  {
    label: "Revenue CRM",
    roles: [Role.FIELD_SALES_REP, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "B2B Organisations", href: "/organisations", icon: Building2 },
      { label: "Revenue Dashboard", href: "/crm/revenue", icon: DollarSign },
      { label: "Clinics & Doctors", href: "/crm/doctors", icon: Stethoscope },
      { label: "Leads", href: "/crm/leads", icon: Handshake },
      { label: "Campaigns", href: "/crm/campaigns", icon: Megaphone },
      { label: "Targets", href: "/crm/targets", icon: Target },
      { label: "Commissions", href: "/crm/commissions", icon: Percent },
    ],
  },
  {
    label: "Finance",
    roles: [Role.FINANCE_EXECUTIVE, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Finance Overview", href: "/finance", icon: Wallet },
      { label: "Receivables", href: "/finance/receivables", icon: Coins },
      { label: "GST Reports", href: "/finance/gst", icon: Scale },
      { label: "Procurement", href: "/procurement", icon: Truck },
    ],
  },
  {
    label: "HR & Admin",
    roles: [Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Employees", href: "/hr/employees", icon: Users },
      { label: "Attendance", href: "/hr/attendance", icon: CalendarCheck2 },
      { label: "Shifts", href: "/hr/shifts", icon: Clock },
      { label: "Leave", href: "/hr/leave", icon: CalendarDays },
      { label: "Payroll", href: "/hr/payroll", icon: Banknote },
      { label: "Certifications", href: "/hr/certifications", icon: GraduationCap },
    ],
  },
  {
    label: "Quality & Compliance",
    roles: [Role.LAB_MANAGER, Role.PATHOLOGIST, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "QC Dashboard", href: "/qc", icon: ShieldCheck },
      { label: "CAPA", href: "/qc/capa", icon: ClipboardCheck },
      { label: "SOPs & Documents", href: "/qc/documents", icon: BookOpenCheck },
      { label: "Audit Logs", href: "/settings/audit-logs", icon: ScrollText },
    ],
  },
  {
    label: "Corporate & Wellness",
    roles: [Role.FIELD_SALES_REP, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Camp Management", href: "/corporate/camps", icon: Tent },
      { label: "Wellness Dashboard", href: "/corporate/wellness", icon: HeartHandshake },
    ],
  },
  {
    label: "Settings",
    roles: [Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.IT_ADMIN],
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Doctors", href: "/settings/doctors", icon: Stethoscope },
      { label: "Report Settings", href: "/settings/report-settings", icon: FileText },
      { label: "Rate Lists", href: "/settings/rate-lists", icon: FileSpreadsheet },
      { label: "Report Templates", href: "/settings/report-templates", icon: ScrollText },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "API Keys", href: "/integrations/api-keys", icon: Key },
      { label: "FHIR Explorer", href: "/integrations/fhir", icon: HeartPulse },
      { label: "Voice Agent", href: "/settings/voice-agent", icon: Bot },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const stored = localStorage.getItem("delvion_sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("delvion_sidebar_collapsed", String(next));
  };

  const userRole = user?.role as Role | undefined;
  const visibleGroups = NAV_GROUPS.filter((group) => {
    if (!group.roles) return true;
    if (!userRole) return false;
    return group.roles.includes(userRole);
  });

  const fullName = user ? `${user.firstName} ${user.lastName}` : "";
  const initials = user ? getInitials(user.firstName, user.lastName) : "?";
  const avatarBg = getAvatarColor(fullName);

  return (
    <aside
      className={cn(
        "flex flex-col bg-[#0F1923] border-r border-white/5 transition-all duration-200 ease-in-out relative z-30 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 border-b border-white/5 shrink-0", collapsed ? "px-4 py-5 justify-center" : "px-5 py-5")}>
        <div className="flex-shrink-0 w-8 h-8 bg-[#0D7E8A] rounded-lg flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 8v8c0 7.73 5.16 14.97 12 16.93C22.84 30.97 28 23.73 28 16V8L16 2z" fill="white" fillOpacity="0.9" />
            <path d="M12 16l3 3 5-6" stroke="#0D7E8A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight">DELViON</p>
            <p className="text-[#0D7E8A] text-xs font-medium">Health Platform</p>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-[60px] w-6 h-6 bg-[#0F1923] border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors z-40"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 mb-1">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group",
                      collapsed ? "justify-center" : "",
                      isActive
                        ? "bg-[#0D7E8A]/15 text-white border-l-[3px] border-[#0D7E8A] pl-[9px]"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon size={18} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium truncate flex-1">{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className="ml-auto bg-[#0D7E8A] text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className={cn("border-t border-white/5 shrink-0", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              style={{ backgroundColor: avatarBg }}
              title={`${fullName} · ${userRole}`}
            >
              {initials}
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: avatarBg }}
            >
              {initials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{fullName}</p>
              <p className="text-slate-500 text-[10px] truncate">{userRole?.replace("_", " ")}</p>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

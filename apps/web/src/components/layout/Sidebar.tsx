"use client";

import { useEffect, useState, useCallback } from "react";
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
  BarChart3,
  Cpu,
  FileText,
  TrendingUp,
  Stethoscope,
  Megaphone,
  Receipt,
  Shield,
  BookOpen,
  ShoppingCart,
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
  ChevronDown,
  LogOut,
  Coins,
  HeartPulse,
  CheckSquare,
  FileSpreadsheet,
  GitMerge,
  ClipboardCheck,
  ScrollText,
  ExternalLink,
  ScanBarcode,
  Cog,
  ShieldCheck,
  ClipboardPlus,
  TestTubes,
  BookOpenCheck,
  Tent,
  HeartHandshake,
  Scale,
  Truck,
  GraduationCap,
  Bot,
  Home,
  Hash,
  FileOutput,
  Syringe,
  Search,
  Monitor,
  PieChart,
  Hospital,
  Microscope,
  Radio,
  Dna,
  Briefcase,
  Landmark,
  Smartphone,
  GitBranch,
  BadgeDollarSign,
  BarChart,
  Palette,
  RotateCcw,
  Filter,
  Upload,
  ArrowLeftRight,
  Building2,
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

const SECTION_COLORS: Record<string, string> = {
  Overview: "text-sky-400",
  "Front Desk": "text-teal-400",
  "Lab Operations": "text-blue-400",
  "Reports & Billing": "text-violet-400",
  "Revenue CRM": "text-emerald-400",
  B2C: "text-slate-400",
  B2B: "text-slate-400",
  Finance: "text-orange-400",
  Instruments: "text-cyan-400",
  "HR & Admin": "text-pink-400",
  "Quality & Compliance": "text-lime-400",
  "Corporate & Wellness": "text-green-400",
  "Imaging & Investigations": "text-purple-400",
  Settings: "text-indigo-400",
};

// These appear as sub-labels under Revenue CRM, not independent section headings
const SUB_SECTIONS = new Set(["B2C", "B2B"]);

function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case "SUPER_ADMIN": return "Lab Director";
    case "TENANT_ADMIN": return "Admin";
    case "FRONT_DESK": return "Front Desk";
    case "LAB_TECHNICIAN": return "Lab Tech";
    case "PHLEBOTOMIST": return "Phlebotomist";
    case "PATHOLOGIST": return "Pathologist";
    case "LAB_MANAGER": return "Lab Manager";
    case "FINANCE_EXECUTIVE": return "Finance";
    case "FIELD_SALES_REP": return "Sales Rep";
    case "IT_ADMIN": return "IT Admin";
    case "CORPORATE_CLIENT": return "Corporate";
    default: return role?.replace(/_/g, " ") ?? "";
  }
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
      { label: "Dashboard", href: "/front-desk", icon: Monitor },
      { label: "Registration & Billing", href: "/registration", icon: ClipboardPlus },
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Appointments", href: "/appointments", icon: Calendar },
      { label: "Home Collection", href: "/front-desk/home-collection", icon: Home },
      { label: "Queue & Tokens", href: "/front-desk/queue", icon: Hash },
      { label: "Queue Display", href: "/front-desk/queue-display", icon: Monitor },
      { label: "Orders", href: "/orders", icon: ShoppingCart },
      { label: "Reports Delivery", href: "/front-desk/reports", icon: FileOutput },
      { label: "Phleb Schedule", href: "/front-desk/phleb-schedule", icon: Syringe },
      { label: "Price Enquiry & Package", href: "/front-desk/price-enquiry", icon: Search },
    ],
  },
  {
    label: "Lab Operations",
    roles: [Role.FRONT_DESK, Role.LAB_TECHNICIAN, Role.PATHOLOGIST, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Worklist", href: "/accession", icon: ScanBarcode },
      { label: "Samples", href: "/samples", icon: TestTubes },
      { label: "Operations", href: "/operations", icon: Cog },
      { label: "Approval", href: "/approvals", icon: CheckSquare },
      { label: "Results", href: "/results", icon: FlaskConical },
      { label: "Outsourcing", href: "/outsourcing", icon: ExternalLink },
    ],
  },
  {
    label: "Imaging & Investigations",
    roles: [Role.LAB_TECHNICIAN, Role.PATHOLOGIST, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Overview", href: "/imaging", icon: PieChart },
      { label: "X-Ray Worklist", href: "/imaging/xray", icon: Activity },
      { label: "CT Scan Worklist", href: "/imaging/ct", icon: Microscope },
      { label: "MRI Worklist", href: "/imaging/mri", icon: Radio },
      { label: "Ultrasound Worklist", href: "/imaging/usg", icon: HeartPulse },
      { label: "Doppler Worklist", href: "/imaging/doppler", icon: BarChart },
      { label: "Molecular Reports", href: "/imaging/molecular", icon: FlaskConical },
      { label: "Genetics Reports", href: "/imaging/genetics", icon: Dna },
      { label: "Report Templates", href: "/imaging/templates", icon: BookOpenCheck },
      { label: "Verify Queue", href: "/imaging/verify", icon: ShieldCheck },
    ],
  },
  {
    label: "Reports & Billing",
    roles: [Role.PATHOLOGIST, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE, Role.FIELD_SALES_REP, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "MIS Reports", href: "/reports/mis", icon: FileSpreadsheet },
      { label: "Invoices & Payments", href: "/billing", icon: Receipt },
      { label: "Insurance", href: "/billing/insurance", icon: Shield },
    ],
  },
  {
    label: "Revenue CRM",
    roles: [Role.FIELD_SALES_REP, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Command Center", href: "/revenue-crm", icon: PieChart },
    ],
  },
  {
    label: "B2C",
    roles: [Role.FIELD_SALES_REP, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Campaigns", href: "/revenue-crm/campaigns", icon: Megaphone },
      { label: "Content Studio", href: "/revenue-crm/content-studio", icon: Palette },
      { label: "Lead Management", href: "/revenue-crm/leads", icon: Users },
      { label: "Repeat Analytics", href: "/revenue-crm/repeat-analytics", icon: RotateCcw },
      { label: "Patient Segments", href: "/revenue-crm/segments", icon: Filter },
      { label: "Health Camps", href: "/revenue-crm/camps", icon: Tent },
      { label: "ROI Dashboard", href: "/revenue-crm/roi", icon: TrendingUp },
    ],
  },
  {
    label: "B2B",
    roles: [Role.FIELD_SALES_REP, Role.LAB_MANAGER, Role.FINANCE_EXECUTIVE, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Organisations", href: "/organisations", icon: Building2 },
      { label: "Sales Team", href: "/revenue-crm/sales-team", icon: Users },
      { label: "Doctors & Clinics", href: "/revenue-crm/doctors", icon: Stethoscope },
      { label: "Hospitals & Labs", href: "/revenue-crm/b2b-accounts", icon: Hospital },
      { label: "Corporates & AHC", href: "/revenue-crm/contracts", icon: Briefcase },
      { label: "TPA & Insurance", href: "/revenue-crm/tpa", icon: Landmark },
      { label: "Aggregators", href: "/revenue-crm/aggregators", icon: Smartphone },
      { label: "Sales Pipeline", href: "/revenue-crm/pipeline", icon: GitBranch },
      { label: "Rev Share", href: "/revenue-crm/revshare", icon: BadgeDollarSign },
      { label: "B2B Revenue", href: "/revenue-crm/b2b-roi", icon: BarChart },
    ],
  },
  {
    label: "Finance",
    roles: [Role.FINANCE_EXECUTIVE, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Finance Overview", href: "/finance", icon: LayoutDashboard },
      { label: "Upload Statement", href: "/finance/accounting/upload", icon: Upload },
      { label: "Transactions", href: "/finance/accounting/transactions", icon: ArrowLeftRight },
      { label: "Ledgers", href: "/finance/accounting/ledgers", icon: BookOpenCheck },
      { label: "Journal Entries", href: "/finance/accounting/journals", icon: ScrollText },
      { label: "Receivables", href: "/finance/receivables", icon: Coins },
      { label: "Procurement", href: "/finance/procurement", icon: Truck },
      { label: "Statutory & Payroll", href: "/finance/statutory", icon: Shield },
      { label: "Reports", href: "/finance/reports", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Instruments",
    roles: [Role.LAB_TECHNICIAN, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN],
    items: [
      { label: "Overview", href: "/instruments", icon: Cpu },
      { label: "Interfaces", href: "/instruments/interfaces", icon: Plug },
      { label: "CPT Codes", href: "/instruments/cpt-codes", icon: Hash },
      { label: "Status Monitor", href: "/instruments/status", icon: Activity },
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
      { label: "QC Dashboard", href: "/quality", icon: ShieldCheck },
      { label: "CAPA", href: "/quality/capa", icon: ClipboardCheck },
      { label: "SOPs & Documents", href: "/quality/sops", icon: BookOpen },
      { label: "Audit Logs", href: "/quality/audit-logs", icon: ScrollText },
      { label: "Compliance Dashboard", href: "/quality/compliance", icon: Scale },
      { label: "Document Vault", href: "/quality/vault", icon: Shield },
      { label: "Quality Forms", href: "/quality/forms", icon: ClipboardList },
      { label: "IQC & EQAS", href: "/quality/iqc", icon: FlaskConical },
    ],
  },
  {
    label: "Corporate & Wellness",
    roles: [Role.FIELD_SALES_REP, Role.LAB_MANAGER, Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.CORPORATE_CLIENT],
    items: [
      { label: "Dashboard", href: "/corporate/dashboard", icon: LayoutDashboard },
      { label: "Corporates", href: "/corporate/corporates", icon: Building2 },
      { label: "Members", href: "/corporate/members", icon: Users },
      { label: "Packages", href: "/corporate/packages", icon: ClipboardList },
      { label: "Camp Management", href: "/corporate/camps", icon: Tent },
      { label: "Wellness Dashboard", href: "/corporate/wellness", icon: HeartHandshake },
      { label: "Invoices", href: "/corporate/invoices", icon: FileText },
      { label: "Feedback", href: "/corporate/feedback", icon: FileSpreadsheet },
      { label: "Settings", href: "/corporate/settings", icon: Cog },
    ],
  },
  {
    label: "Settings",
    roles: [Role.TENANT_ADMIN, Role.SUPER_ADMIN, Role.IT_ADMIN],
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Organisation Settings", href: "/organisations", icon: Building2 },
      { label: "Departments", href: "/settings/departments", icon: Hospital },
      { label: "Doctors", href: "/settings/doctors", icon: Stethoscope },
      { label: "Report Settings", href: "/settings/report-settings", icon: FileText },
      { label: "Bill Settings", href: "/settings/bill-settings", icon: Receipt },
      { label: "Invoice Settings", href: "/settings/invoice-settings", icon: ScrollText },
      { label: "Test Mapping", href: "/settings/test-mapping", icon: GitMerge },
      { label: "Rate Lists", href: "/settings/rate-lists", icon: FileSpreadsheet },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "API Keys", href: "/integrations/api-keys", icon: Key },
      { label: "FHIR Explorer", href: "/integrations/fhir", icon: HeartPulse },
      { label: "Voice Agent", href: "/settings/voice-agent", icon: Bot },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const userRole = user?.role as Role | undefined;
  const visibleGroups = NAV_GROUPS.filter((group) => {
    if (!group.roles) return true;
    if (!userRole) return false;
    return group.roles.includes(userRole);
  });

  // Determine which group contains the active route
  const activeGroupLabel = visibleGroups.find((group) =>
    group.items.some((item) => {
      const exactMatchPaths = new Set(["/dashboard", "/finance", "/instruments"]);
      return exactMatchPaths.has(item.href)
        ? pathname === item.href
        : pathname.startsWith(item.href);
    })
  )?.label;

  // On mount: restore sidebar collapsed state; always start with only active section open
  useEffect(() => {
    const stored = localStorage.getItem("delvion_sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
    // Remove stale stored expansion state — always derive from active route
    localStorage.removeItem("delvion_sidebar_expanded_sections");
    setExpandedSections(activeGroupLabel ? new Set([activeGroupLabel]) : new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand the section of the active route when pathname changes
  useEffect(() => {
    if (activeGroupLabel) {
      setExpandedSections((prev) => {
        if (prev.has(activeGroupLabel)) return prev;
        const next = new Set(prev);
        next.add(activeGroupLabel);
        return next;
      });
    }
  }, [activeGroupLabel]);

  const toggleSection = useCallback((label: string) => {
    setExpandedSections((prev) => {
      if (prev.has(label)) {
        const next = new Set(prev);
        next.delete(label);
        return next;
      }
      return new Set([label]); // accordion: close all others
    });
  }, []);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("delvion_sidebar_collapsed", String(next));
  };

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
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleGroups.map((group, idx) => {
          const isSubSection = SUB_SECTIONS.has(group.label);
          const parentLabel = isSubSection ? "Revenue CRM" : group.label;
          const isExpanded = collapsed || expandedSections.has(parentLabel);
          const hasActive = group.items.some((item) => {
            const exactMatchPaths = new Set(["/dashboard", "/finance", "/instruments"]);
            return exactMatchPaths.has(item.href)
              ? pathname === item.href
              : pathname.startsWith(item.href);
          });

          return (
            <div key={group.label}>
              {!collapsed && (
                <>
                  {/* Separator before sections (not sub-sections, not first) */}
                  {idx > 0 && !isSubSection && (
                    <div className="mx-3 mb-1 mt-2 border-t border-white/[0.08]" />
                  )}

                  {isSubSection ? (
                    /* Sub-section pill label (B2C / B2B) — always visible within Revenue CRM */
                    <div className="px-4 mt-3 mb-1">
                      <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                        {group.label}
                      </span>
                    </div>
                  ) : (
                    /* Clickable section heading */
                    <button
                      onClick={() => toggleSection(group.label)}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-1.5 rounded-lg transition-colors group",
                        "hover:bg-white/[0.04]",
                      )}
                    >
                      <span className={cn(
                        "text-[11px] font-extrabold tracking-[0.18em] uppercase flex-1 text-left",
                        SECTION_COLORS[group.label] ?? "text-sky-400",
                        !hasActive && "opacity-60",
                      )}>
                        {group.label}
                      </span>
                      <ChevronDown
                        size={11}
                        className={cn(
                          "text-slate-600 group-hover:text-slate-400 transition-transform duration-200 flex-shrink-0",
                          isExpanded ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </button>
                  )}
                </>
              )}

              {/* Items — hidden when collapsed (per section) unless sidebar itself is icon-mode */}
              {isExpanded && (
                <div className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const exactMatchPaths = new Set(["/dashboard", "/finance", "/instruments"]);
                    const isActive = exactMatchPaths.has(item.href)
                      ? pathname === item.href
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
              )}
            </div>
          );
        })}
      </nav>

      {/* User area */}
      <div className={cn("border-t border-white/5 shrink-0", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              style={{ backgroundColor: avatarBg }}
              title={`${fullName} · ${getRoleLabel(userRole)}`}
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
              <p className="text-slate-500 text-[10px] truncate">{getRoleLabel(userRole)}</p>
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

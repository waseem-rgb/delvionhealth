"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Settings,
  LogOut,
  Check,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuthStore } from "@/store/authStore";
import { useTenantStore } from "@/store/tenantStore";
import { CommandPalette } from "./CommandPalette";
import { NotificationDrawer } from "./NotificationDrawer";
import { cn, getInitials, getAvatarColor, truncate } from "@/lib/utils";

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: seg
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  if (crumbs.length === 0) return null;

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm text-slate-400">
      <Link href="/dashboard" className="hover:text-slate-600 transition-colors">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight size={13} className="text-slate-300" />
          {i === crumbs.length - 1 ? (
            <span className="text-slate-700 font-medium">{truncate(crumb.label, 20)}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-slate-600 transition-colors">
              {truncate(crumb.label, 20)}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function TopBar() {
  const { user, logout } = useAuthStore();
  const { activeBranch, activeTenant, setActiveBranch } = useTenantStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount] = useState(3);

  const fullName = user ? `${user.firstName} ${user.lastName}` : "";
  const initials = user ? getInitials(user.firstName, user.lastName) : "?";
  const avatarBg = getAvatarColor(fullName);

  // Keyboard shortcut for command palette — in useEffect so it only mounts once
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4 z-40 sticky top-0">
        {/* Breadcrumbs (left) */}
        <Breadcrumbs />

        {/* Search trigger (center, flex-grow) */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm transition-colors flex-1 max-w-md mx-auto"
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 text-left">Search patients, orders, tests…</span>
          <span className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-400 shrink-0">
            ⌘K
          </span>
        </button>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Branch selector */}
          {activeTenant && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <Building2 size={14} className="text-slate-400" />
                  <span className="font-medium">{activeBranch ? truncate(activeBranch.name, 15) : "All Branches"}</span>
                  <ChevronDown size={12} className="text-slate-400" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[200px] bg-white rounded-xl shadow-xl border border-slate-100 py-1 mt-1"
                  align="end"
                >
                  <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Switch Branch
                  </DropdownMenu.Label>
                  {[
                    { id: "all", name: "All Branches" },
                    ...(activeTenant ? [{ id: "main", name: "Main Branch - Bengaluru" }] : []),
                  ].map((branch) => (
                    <DropdownMenu.Item
                      key={branch.id}
                      onSelect={() => branch.id !== "all" && setActiveBranch({ id: branch.id, name: branch.name })}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer outline-none transition-colors",
                        activeBranch?.id === branch.id || (!activeBranch && branch.id === "all")
                          ? "text-[#0D7E8A] bg-teal-50"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {(activeBranch?.id === branch.id || (!activeBranch && branch.id === "all")) && (
                        <Check size={12} />
                      )}
                      <span>{branch.name}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white px-0.5">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* User menu */}
          {user && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 transition-colors">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: avatarBg }}
                  >
                    {initials}
                  </div>
                  <ChevronDown size={12} className="text-slate-400 hidden sm:block" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[220px] bg-white rounded-xl shadow-xl border border-slate-100 py-1 mt-1"
                  align="end"
                >
                  {/* User info header */}
                  <div className="px-3 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900">{fullName}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full">
                      {user.role?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <DropdownMenu.Item asChild>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none transition-colors"
                    >
                      <User size={15} className="text-slate-400" />
                      My Profile
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none transition-colors"
                    >
                      <Settings size={15} className="text-slate-400" />
                      Settings
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />

                  <DropdownMenu.Item
                    onSelect={() => void logout()}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none transition-colors"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}

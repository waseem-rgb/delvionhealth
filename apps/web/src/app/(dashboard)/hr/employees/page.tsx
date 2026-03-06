"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, Banknote, TrendingUp, Plus, Search } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

interface Employee {
  id: string;
  employeeId: string;
  department: string | null;
  designation: string | null;
  salary: number | null;
  joiningDate: string;
  isActive: boolean;
  user: { firstName: string; lastName: string; email: string; role: string; isActive: boolean };
  branch: { name: string };
}

export default function EmployeesPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () =>
      api.get("/hr/employees").then((r) => (r.data as { data: Employee[] }).data),
  });

  const employees = (data ?? []).filter((emp) => {
    const fullName = `${emp.user.firstName} ${emp.user.lastName}`.toLowerCase();
    return !search || fullName.includes(search.toLowerCase()) || (emp.employeeId ?? "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Employee records, roles, departments, and onboarding
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* HR module quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Attendance", href: "/hr/attendance", icon: Clock, color: "bg-blue-50 text-blue-700 border-blue-100" },
          { label: "Payroll", href: "/hr/payroll", icon: Banknote, color: "bg-green-50 text-green-700 border-green-100" },
          { label: "Performance", href: "#", icon: TrendingUp, color: "bg-purple-50 text-purple-700 border-purple-100" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl border p-4 hover:shadow-sm transition-shadow ${item.color}`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Employee table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No employees found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Department</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Branch</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Since</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const fullName = `${emp.user.firstName} ${emp.user.lastName}`;
                const initials = [emp.user.firstName[0], emp.user.lastName[0]].join("").toUpperCase();
                const joinDate = new Date(emp.joiningDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
                return (
                  <tr key={emp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{fullName}</div>
                          <div className="text-xs text-slate-400">{emp.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.designation ?? emp.user.role.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-500">{emp.department ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{emp.branch.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{joinDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

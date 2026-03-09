"use client";

export default function DashboardPage() {
  if (typeof window !== "undefined") {
    window.location.href = "/dashboard";
  }
  return null;
}

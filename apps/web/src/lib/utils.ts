import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatDistanceToNow,
  format as dateFnsFormat,
  isToday,
  isYesterday,
} from "date-fns";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return dateFnsFormat(d, "dd MMM yyyy");
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return dateFnsFormat(d, "dd MMM yyyy, hh:mm a");
}

export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  if (isYesterday(d)) {
    return `Yesterday at ${dateFnsFormat(d, "hh:mm a")}`;
  }
  return formatDate(d);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Accepts either (firstName, lastName) or a full "First Last" string */
export function getInitials(firstOrFull: string, last?: string): string {
  if (last !== undefined) {
    return `${firstOrFull.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  const parts = firstOrFull.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  "#0D7E8A", // teal
  "#1B4F8A", // blue
  "#7C3AED", // purple
  "#059669", // green
  "#D97706", // orange
  "#E11D48", // rose
  "#4F46E5", // indigo
  "#B45309", // amber
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function generateMRN(sequence: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `DH-${y}-${String(sequence).padStart(6, "0")}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

export function isValidPhone(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function formatTAT(fromDate: string | Date): string {
  const diffMs = Date.now() - new Date(fromDate).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function getTATColor(fromDate: string | Date): "green" | "amber" | "red" {
  const hours = (Date.now() - new Date(fromDate).getTime()) / (1000 * 60 * 60);
  if (hours < 4) return "green";
  if (hours < 8) return "amber";
  return "red";
}

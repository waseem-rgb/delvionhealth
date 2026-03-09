import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "delvion_auth";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/patients",
  "/orders",
  "/samples",
  "/results",
  "/reports",
  "/billing",
  "/crm",
  "/settings",
  "/analytics",
  "/appointments",
  "/instruments",
  "/hr",
  "/finance",
  "/procurement",
  "/integrations",
  "/notifications",
  "/qc",
  "/super-admin",
  "/registration",
  "/accession",
  "/operations",
  "/approvals",
  "/outsourcing",
  "/organisations",
  "/corporate",
  "/doctor-portal",
];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has(AUTH_COOKIE);

  // Root redirect to dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};

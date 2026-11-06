import { NextResponse, type NextRequest } from "next/server";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH, verifyAdminAccess } from "./auth-model";
import { privateHeaders } from "./http-security";

export async function protectAdminRequest(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Auth handlers perform their own method, origin and authorization checks.
  if (["/admin/login", "/admin/auth/login", "/admin/auth/logout"].includes(path)) {
    return NextResponse.next({ headers: privateHeaders() });
  }
  let status: "anonymous" | "denied" | "unavailable" = "unavailable";
  try {
    const config = readPublicSupabaseConfig();
    if (config) {
      const access = await verifyAdminAccess(config, request.cookies.get(ADMIN_COOKIE)?.value);
      if (access.status === "authorized") return NextResponse.next({ headers: privateHeaders() });
      status = access.status;
    }
  } catch { /* Fail closed without leaking credentials or upstream errors. */ }
  const destination = new URL(`/admin/login?status=${status === "unavailable" ? "unavailable" : "required"}`, request.url);
  const response = NextResponse.redirect(destination, 303);
  for (const [name, value] of Object.entries(privateHeaders())) response.headers.set(name, value);
  if (status !== "unavailable") response.cookies.set(ADMIN_COOKIE, "", { path: ADMIN_COOKIE_PATH, maxAge: 0, httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
  return response;
}

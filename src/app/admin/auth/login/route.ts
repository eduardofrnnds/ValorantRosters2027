import { NextResponse, type NextRequest } from "next/server";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH, loginAdmin } from "@/features/admin/auth-model";
import { isSameOriginPost, privateHeaders, readLoginForm } from "@/features/admin/http-security";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let result: Awaited<ReturnType<typeof loginAdmin>> = { status: "unavailable" };
  try {
    const config = readPublicSupabaseConfig();
    if (config) result = await loginAdmin(config, await readLoginForm(request));
  } catch { /* No passwords, tokens or raw errors in responses/logs. */ }
  const response = new NextResponse(null, { status: 303, headers: {
    ...privateHeaders(), Location: result.status === "authorized" ? "/admin" : `/admin/login?status=${result.status}`,
  } });
  response.cookies.set(ADMIN_COOKIE, result.status === "authorized" ? result.token : "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: ADMIN_COOKIE_PATH, maxAge: result.status === "authorized" ? result.maxAge : 0,
  });
  return response;
}

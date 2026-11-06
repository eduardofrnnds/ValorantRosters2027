import { NextResponse, type NextRequest } from "next/server";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH, logoutAdmin } from "@/features/admin/auth-model";
import { isSameOriginPost, privateHeaders } from "@/features/admin/http-security";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let revoked = true;
  try {
    const config = readPublicSupabaseConfig();
    if (config) revoked = await logoutAdmin(config, request.cookies.get(ADMIN_COOKIE)?.value);
  } catch { revoked = false; }
  const response = new NextResponse(null, { status: 303, headers: {
    ...privateHeaders(), Location: `/admin/login?status=${revoked ? "signed-out" : "local-signout"}`,
  } });
  // Clear the local session even if Auth is unreachable or the permission was revoked.
  response.cookies.set(ADMIN_COOKIE, "", { path: ADMIN_COOKIE_PATH, maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
  return response;
}

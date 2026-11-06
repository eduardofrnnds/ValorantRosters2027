import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, runAdminOperation, verifyAdminAccess, type AdminAccess, type createAdminAuthClient } from "./auth-model";

export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const cookieStore = await cookies();
  try {
    const config = readPublicSupabaseConfig();
    return config ? await verifyAdminAccess(config, cookieStore.get(ADMIN_COOKIE)?.value) : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
});

export async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status !== "authorized") redirect(`/admin/login?status=${access.status === "unavailable" ? "unavailable" : "required"}`);
  return { userId: access.userId };
}

/** Future Server Actions/handlers must use this boundary, even under the protected layout. */
export async function withAdminMutation<T>(operation: (context: { userId: string; client: ReturnType<typeof createAdminAuthClient> }) => Promise<T>) {
  const config = readPublicSupabaseConfig();
  const cookieStore = await cookies();
  if (!config) throw new Error("Acesso administrativo indisponível.");
  return runAdminOperation(config, cookieStore.get(ADMIN_COOKIE)?.value, operation);
}

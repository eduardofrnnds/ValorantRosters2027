import "server-only";
import { cookies } from "next/headers";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, runAdminOperation, verifyAdminAccess } from "./auth-model";
import { requireAdmin } from "./server";
import { readRosterData } from "./roster-draft-data";

export async function getRosterData() {
  await requireAdmin();
  try {
    const config = readPublicSupabaseConfig();
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!config) return null;
    const data = await runAdminOperation(config, token, ({ client }) => readRosterData(client));
    return (await verifyAdminAccess(config, token)).status === "authorized" ? data : null;
  } catch { return null; }
}

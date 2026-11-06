import "server-only";
import { cookies } from "next/headers";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { ADMIN_COOKIE, runAdminOperation, verifyAdminAccess } from "./auth-model";
import { requireAdmin } from "./server";
import { readAdminPlayers, readPlayerAliases } from "./player-data";

export async function getAdminPlayers(id?: string) {
  await requireAdmin();
  try {
    const config = readPublicSupabaseConfig();
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!config) return null;
    const data = await runAdminOperation(config, token, async ({ client }) => ({
      players: await readAdminPlayers(client), aliases: id ? await readPlayerAliases(client, id) : [],
    }));
    return (await verifyAdminAccess(config, token)).status === "authorized" ? data : null;
  } catch { return null; }
}

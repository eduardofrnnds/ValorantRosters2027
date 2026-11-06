import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createServerPublicClient } from "@/lib/supabase/server";
import { resolvePublicPlayer, readPublicPlayerProfile } from "./public-player-reader";
import { localPlayers, localPlayerMemberships } from "./data/local-players";
import { vct2027 } from "@/features/organizations/data/vct-2027";
import { getPlayerProfile, type PlayerProfileData } from "./player-profile-model";

type Result = { status: "ready"; profile: PlayerProfileData } | { status: "redirect"; slug: string } | { status: "missing" } | { status: "unavailable" };
export const getPublicPlayer = cache(async (slug: string): Promise<Result> => {
  await connection();
  try {
    const client = createServerPublicClient();
    if (!client) {
      const profile = getPlayerProfile(localPlayers, localPlayerMemberships, vct2027, slug, new Date().toISOString().slice(0, 10));
      return profile ? { status: "ready", profile } : { status: "missing" };
    }
    const row = await resolvePublicPlayer(client, slug);
    if (!row) return { status: "missing" };
    if (row.slug !== slug) return { status: "redirect", slug: row.slug };
    return { status: "ready", profile: await readPublicPlayerProfile(client, row) };
  } catch { return { status: "unavailable" }; }
});

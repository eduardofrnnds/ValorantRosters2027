import { NextResponse, type NextRequest } from "next/server";
import { localPlayers } from "@/features/players/data/local-players";
import { getPublishedPlayer } from "@/features/players/player-profile-model";
import { vct2027 } from "@/features/organizations/data/vct-2027";
import { createServerPublicClient } from "@/lib/supabase/server";
import { hasPublicOrganization } from "@/lib/supabase/catalog-reader";
import { protectAdminRequest } from "@/features/admin/proxy";
import { resolvePublicPlayer } from "@/features/players/public-player-reader";

// Set status before rendering the fallback. In this Next version, throwing
// notFound() in a dynamic page yields an error shell requiring JS. Team existence
// uses the same anonymous source as the page. Public-only player aliases redirect.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) return protectAdminRequest(request);
  let slug: string;
  try {
    slug = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  } catch {
    return NextResponse.next({ status: 404 });
  }
  if (request.nextUrl.pathname.startsWith("/team/")) {
    try {
      const client = createServerPublicClient();
      const exists = client ? await hasPublicOrganization(client, slug)
        : vct2027.organizations.some((organization) => organization.slug === slug);
      return NextResponse.next({ status: exists ? 200 : 404 });
    } catch {
      return NextResponse.next({ status: 503 });
    }
  }
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const client = createServerPublicClient();
    const player = client ? await resolvePublicPlayer(client, slug) : getPublishedPlayer(localPlayers, slug);
    if (player && player.slug !== slug) return NextResponse.redirect(new URL(`/player/${player.slug}`, request.url), { status: 307, headers });
    return NextResponse.next({ status: player ? 200 : 404, headers });
  } catch { return NextResponse.next({ status: 503, headers }); }
}

export const config = { matcher: ["/player/:slug", "/team/:slug", "/admin/:path*"] };

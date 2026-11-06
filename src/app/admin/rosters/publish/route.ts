import { revalidatePath } from "next/cache";
import { withAdminMutation } from "@/features/admin/server";
import { privateHeaders, isSameOriginPost, readAdminForm } from "@/features/admin/http-security";
import { publishRosterDraft } from "@/features/admin/roster-draft-data";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let result: Awaited<ReturnType<typeof publishRosterDraft>> = { status: "unavailable" };
  try {
    result = await withAdminMutation(async ({ client }) => publishRosterDraft(client, await readAdminForm(request)));
  } catch { /* Never disclose private errors or claim success without a confirmed RPC. */ }
  let cachePending = false;
  if (result.status === "saved" && result.publication) {
    try {
      // Runs only after commit (including a confirmed retry of the same publication).
      revalidatePath("/", "layout");
    } catch { cachePending = true; /* The transaction already committed. */ }
  }
  const publication = result.publication;
  const status = cachePending ? "published-cache-pending" : publication?.already_published ? "already-published" : "published";
  const destination = publication ? `/admin/rosters/${publication.team_season_id}?draft=${publication.id}&status=${status}` : `/admin/rosters?status=publish-${result.status}#rascunhos`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status: result.status, destination }, { status: result.status === "saved" ? 200 : 422, headers: privateHeaders() });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

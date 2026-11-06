import { revalidatePath } from "next/cache";
import { withAdminMutation } from "@/features/admin/server";
import { privateHeaders, isSameOriginPost, readAdminForm } from "@/features/admin/http-security";
import { archiveRosterDraft } from "@/features/admin/roster-draft-data";
import type { EditorStatus } from "@/features/admin/organization-model";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let status: EditorStatus = "unavailable";
  try {
    const result = await withAdminMutation(async ({ client }) => archiveRosterDraft(client, await readAdminForm(request)));
    status = result.status;
    if (status === "saved") revalidatePath("/admin", "layout");
  } catch { /* Private errors stay private. */ }
  const destination = `/admin/rosters?status=${status === "saved" ? "archived" : status}#rascunhos`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status, destination }, { status: status === "saved" ? 200 : 422, headers: privateHeaders() });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

import { revalidatePath } from "next/cache";
import { withAdminMutation } from "@/features/admin/server";
import { isSameOriginPost, privateHeaders, readAdminForm } from "@/features/admin/http-security";
import { savePlayerRecord } from "@/features/admin/player-data";
import type { EditorStatus } from "@/features/admin/organization-model";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let status: EditorStatus = "unavailable";
  let destination = "/admin/players";
  try {
    const result = await withAdminMutation(async ({ client }) => {
      const form = await readAdminForm(request);
      if (form?.id && /^[0-9a-f-]{36}$/i.test(form.id)) destination = form.expected_updated_at ? `/admin/players/${form.id}` : "/admin/players/new";
      return savePlayerRecord(client, form);
    });
    status = result.status;
    if (status === "saved") {
      destination = `/admin/players/${result.id}`;
      revalidatePath("/admin", "layout");
      revalidatePath("/player/[slug]", "page");
    }
  } catch { /* Never expose provider errors. */ }
  destination += `?status=${status}`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status, destination }, { status: status === "saved" ? 200 : 422, headers: privateHeaders() });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

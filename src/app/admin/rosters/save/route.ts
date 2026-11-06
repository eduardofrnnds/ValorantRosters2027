import { revalidatePath } from "next/cache";
import { withAdminMutation } from "@/features/admin/server";
import { privateHeaders, isSameOriginPost, readBoundedBody } from "@/features/admin/http-security";
import { saveRosterDraft } from "@/features/admin/roster-draft-data";
import type { EditorStatus } from "@/features/admin/organization-model";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return Response.json({ status: "denied" }, { status: 403, headers: privateHeaders() });
  let result: { status: EditorStatus; id?: string } = { status: "unavailable" };
  try {
    result = await withAdminMutation(async ({ client }) => {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return { status: "invalid" };
      const bytes = await readBoundedBody(request, 131_072);
      if (!bytes) return { status: "invalid" };
      let input: unknown;
      try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { status: "invalid" }; }
      return saveRosterDraft(client, input);
    });
    if (result.status === "saved") revalidatePath("/admin", "layout");
  } catch { /* Authorization/provider failures never imply saved data. */ }
  return Response.json(result, { status: result.status === "saved" ? 200 : 422, headers: privateHeaders() });
}

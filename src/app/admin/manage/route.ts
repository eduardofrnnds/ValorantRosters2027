import { withAdminMutation } from "@/features/admin/server";
import { isSameOriginPost, privateHeaders, readAdminForm } from "@/features/admin/http-security";
import { saveOrganizationRecord } from "@/features/admin/organization-data";
import type { EditorStatus } from "@/features/admin/organization-model";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let destination = "/admin/organizations";
  let status: EditorStatus = "unavailable";
  try {
    const result = await withAdminMutation(async ({ client }) => {
      const form = await readAdminForm(request);
      if (!form) return { status: "invalid" as const };
      if (form.kind === "season") destination = "/admin/organizations/seasons";
      else {
        const id = form.kind === "participation" ? form.organization_id : form.id;
        if (id && /^[0-9a-f-]{36}$/i.test(id)) destination += `/${id}`;
        else if (form.kind === "organization") destination += "/new";
      }
      const saved = await saveOrganizationRecord(client, form.kind, form);
      if (saved.status === "saved" && form.kind === "organization") destination = `/admin/organizations/${saved.id}`;
      return saved;
    });
    status = result.status;
    if (status === "saved") {
      revalidatePath("/admin", "layout");
      revalidatePath("/");
      revalidatePath("/[region]", "page");
      revalidatePath("/team/[slug]", "page");
    }
  } catch { /* No raw provider errors or tokens in the response. */ }
  destination = `${destination}?status=${status}`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status, destination }, { headers: privateHeaders(), status: status === "saved" ? 200 : 422 });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

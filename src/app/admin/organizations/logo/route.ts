import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAdminMutation } from "@/features/admin/server";
import { isSameOriginPost, privateHeaders, readBoundedBody } from "@/features/admin/http-security";
import { LOGO_BUCKET, LOGO_MAX_BYTES, logoFileType } from "@/features/admin/organization-logo";
import { saveOrganizationRecord } from "@/features/admin/organization-data";
import type { EditorStatus } from "@/features/admin/organization-model";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let destination = "/admin/organizations";
  let status: EditorStatus = "unavailable";
  try {
    status = await withAdminMutation(async ({ client, userId }): Promise<EditorStatus> => {
      if (process.env.SUPABASE_ORGANIZATION_LOGOS_BUCKET !== LOGO_BUCKET) return "upload";
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.startsWith("multipart/form-data;")) return "upload";
      const bytes = await readBoundedBody(request, LOGO_MAX_BYTES + 16_384);
      if (!bytes) return "upload";
      const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
      if ([...form.keys()].some((key) => !["id", "expected_updated_at", "logo"].includes(key) || form.getAll(key).length !== 1)) return "invalid";
      const id = form.get("id");
      const expected = form.get("expected_updated_at");
      const file = form.get("logo");
      if (!z.uuid().safeParse(id).success || typeof id !== "string" || typeof expected !== "string" || !(file instanceof File)) return "invalid";
      destination += `/${id}`;
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const extension = logoFileType(fileBytes, file.type);
      if (!extension) return "upload";
      const { data: row, error } = await client.from("organizations").select("id,name,slug,short_name,logo_url,publication_status,updated_at").eq("id", id).maybeSingle();
      if (error) return "unavailable";
      if (!row || row.updated_at !== expected) return "conflict";
      const path = `${userId}/${id}/${randomUUID()}.${extension}`;
      const storage = client.storage.from(LOGO_BUCKET);
      const uploaded = await storage.upload(path, fileBytes, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (uploaded.error) return "upload";
      const { data: { publicUrl } } = storage.getPublicUrl(path);
      const saved = await saveOrganizationRecord(client, "organization", {
        ...row, expected_updated_at: expected, short_name: row.short_name ?? "", logo_url: publicUrl,
      });
      // An unknown network outcome may already have committed. Never delete an asset in that case.
      if (saved.status !== "saved" && saved.status !== "unavailable") await storage.remove([path]);
      return saved.status;
    });
    if (status === "saved") {
      revalidatePath("/admin", "layout");
      revalidatePath("/[region]", "page");
      revalidatePath("/team/[slug]", "page");
    }
  } catch { /* Unknown outcome: no invented success and no upstream detail in the response. */ }
  destination += `?status=${status}`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status, destination }, { status: status === "saved" ? 200 : 422, headers: privateHeaders() });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

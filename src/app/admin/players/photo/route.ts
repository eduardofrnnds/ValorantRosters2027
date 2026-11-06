import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withAdminMutation } from "@/features/admin/server";
import { isSameOriginPost, privateHeaders, readBoundedBody } from "@/features/admin/http-security";
import { LOGO_MAX_BYTES as IMAGE_MAX_BYTES, logoFileType as imageFileType } from "@/features/admin/organization-logo";
import { playerColumns, savePlayerRecord } from "@/features/admin/player-data";
import { playerFormValues } from "@/features/admin/player-model";
import type { EditorStatus } from "@/features/admin/organization-model";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let destination = "/admin/players";
  let status: EditorStatus = "unavailable";
  try {
    status = await withAdminMutation(async ({ client, userId }): Promise<EditorStatus> => {
      if (process.env.SUPABASE_PLAYER_PHOTOS_BUCKET !== "player-photos") return "upload";
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.startsWith("multipart/form-data;")) return "upload";
      const bytes = await readBoundedBody(request, IMAGE_MAX_BYTES + 16_384);
      if (!bytes) return "upload";
      const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
      if ([...form.keys()].some((key) => !["id", "expected_updated_at", "photo"].includes(key) || form.getAll(key).length !== 1)) return "invalid";
      const id = form.get("id"), expected = form.get("expected_updated_at"), file = form.get("photo");
      if (typeof id !== "string" || !z.uuid().safeParse(id).success || typeof expected !== "string" || !(file instanceof File)) return "invalid";
      destination += `/${id}`;
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const extension = imageFileType(fileBytes, file.type);
      if (!extension) return "upload";
      const { data: row, error } = await client.from("players").select(playerColumns).eq("id", id).maybeSingle();
      if (error) return "unavailable";
      if (!row || row.updated_at !== expected) return "conflict";
      const path = `${userId}/${id}/${randomUUID()}.${extension}`;
      const storage = client.storage.from("player-photos");
      const uploaded = await storage.upload(path, fileBytes, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (uploaded.error) return "upload";
      const { data: { publicUrl } } = storage.getPublicUrl(path);
      const saved = await savePlayerRecord(client, { ...playerFormValues(row), photo_url: publicUrl });
      if (saved.status !== "saved" && saved.status !== "unavailable") await storage.remove([path]);
      return saved.status;
    });
    if (status === "saved") { revalidatePath("/admin", "layout"); revalidatePath("/player/[slug]", "page"); }
  } catch { /* Unknown write outcome never becomes success. */ }
  destination += `?status=${status}`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status, destination }, { status: status === "saved" ? 200 : 422, headers: privateHeaders() });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

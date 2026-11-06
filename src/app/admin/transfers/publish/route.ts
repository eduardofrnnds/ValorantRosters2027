import { revalidatePath } from "next/cache";
import { withAdminMutation } from "@/features/admin/server";
import { privateHeaders, isSameOriginPost, readAdminForm } from "@/features/admin/http-security";
import { transferPlayer } from "@/features/admin/transfer-data";

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return new Response("Origem não autorizada.", { status: 403, headers: privateHeaders() });
  let result: Awaited<ReturnType<typeof transferPlayer>> = { status: "unavailable" };
  try { result = await withAdminMutation(async ({ client }) => transferPlayer(client, await readAdminForm(request))); }
  catch { /* Private error details never leave the handler. */ }
  let cachePending = false;
  if (result.status === "saved" && result.transfer) {
    try { revalidatePath("/", "layout"); }
    catch { cachePending = true; /* A committed transfer cannot be rolled back here. */ }
  }
  const status = cachePending ? "cache-pending" : result.transfer?.already_published ? "already-published" : result.status;
  const destination = `/admin/transfers?status=${status}`;
  if (request.headers.get("accept") === "application/json") return Response.json({ status: result.status, destination }, { status: result.status === "saved" ? 200 : 422, headers: privateHeaders() });
  return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: destination } });
}

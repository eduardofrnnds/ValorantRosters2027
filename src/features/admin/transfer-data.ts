import type { createAdminAuthClient } from "./auth-model";
import { mutationError, type EditorStatus } from "./organization-model.ts";
import { transferSchema, transferResultSchema } from "./transfer-model.ts";
import type { z } from "zod";

export async function transferPlayer(client: ReturnType<typeof createAdminAuthClient>, input: unknown): Promise<{ status: EditorStatus; transfer?: z.infer<typeof transferResultSchema> }> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const { data, error } = await client.rpc("admin_transfer_player", { input: parsed.data });
    if (error) return { status: mutationError(error.code) };
    const result = transferResultSchema.safeParse(data);
    return result.success && result.data.id === parsed.data.id ? { status: "saved", transfer: result.data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}

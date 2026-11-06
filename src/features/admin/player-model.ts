import { z } from "zod";
import { editorMessages, logoUrlSchema } from "./organization-model.ts";

export const playerRoles = ["duelist", "initiator", "controller", "sentinel", "flex", "coach"] as const;
export const playerLinkLabels = { website: "Site", x: "X", twitch: "Twitch", vlr: "VLR" } as const;
export const externalLinkSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Use uma URL HTTPS sem credenciais.");
export const playerSchema = z.object({
  // A UUID generated with the new form makes replay unable to create a second player.
  id: z.uuid(), expected_updated_at: z.union([z.iso.datetime({ offset: true }), z.literal("")]).default(""),
  nickname: z.string().trim().min(1).max(80), name: z.string().trim().max(160).default(""),
  slug: z.union([z.string().trim().max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), z.literal("")]).default(""),
  nationality: z.string().trim().max(80).default(""), role: z.enum(["", ...playerRoles]).default(""),
  photo_url: logoUrlSchema.default(""), publication_status: z.enum(["draft", "published"]),
  website: externalLinkSchema.default(""), x: externalLinkSchema.default(""),
  twitch: externalLinkSchema.default(""), vlr: externalLinkSchema.default(""),
}).refine((value) => !value.expected_updated_at || Boolean(value.slug), "O slug não pode ficar vazio na edição.");
export type PlayerInput = z.infer<typeof playerSchema>;
export type PlayerRow = Pick<PlayerInput, "id" | "nickname" | "slug" | "publication_status"> & {
  name: string | null; nationality: string | null; role: typeof playerRoles[number] | null;
  photo_url: string | null; links: Partial<Record<keyof typeof playerLinkLabels, string>>; updated_at: string;
};
export type PlayerPayload = Omit<PlayerInput, keyof typeof playerLinkLabels> & { slug_base: string; links: PlayerRow["links"] };
export type PlayerAlias = { id: string; player_id: string; slug: string; was_published: boolean; retired_at: string | null };
export const playerMessages = {
  ...editorMessages,
  invalid: "Revise o nickname, slug, país, função e URLs. Use links HTTPS e os limites indicados.",
  duplicate: "Este cadastro ou slug já existe. Consulte a listagem ou escolha outro slug; o histórico também reserva endereços antigos.",
  upload: "Envie uma foto PNG, JPEG ou WebP de até 2 MB, com o Storage configurado.",
};
export function slugFromNickname(nickname: string) {
  return nickname.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "") || "jogador";
}
export function playerPayload(input: PlayerInput): PlayerPayload {
  const { website, x, twitch, vlr, ...values } = input;
  return { ...values, slug_base: slugFromNickname(input.nickname), links: Object.fromEntries(Object.entries({ website, x, twitch, vlr }).filter(([, value]) => value)) };
}
export function playerFormValues(row: PlayerRow) {
  return { ...row, expected_updated_at: row.updated_at, name: row.name ?? "", nationality: row.nationality ?? "", role: row.role ?? "", photo_url: row.photo_url ?? "", ...row.links };
}
export function filterPlayers(rows: PlayerRow[], query: string) {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const term = normalize(query.trim());
  return rows.filter((row) => normalize(`${row.nickname} ${row.name ?? ""} ${row.slug} ${row.nationality ?? ""}`).includes(term))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "pt-BR") || a.id.localeCompare(b.id));
}

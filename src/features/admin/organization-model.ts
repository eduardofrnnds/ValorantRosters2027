import { z } from "zod";

const optionalId = z.union([z.uuid(), z.literal("")]).default("");
const version = z.union([z.iso.datetime({ offset: true }), z.literal("")]).default("");
const name = z.string().trim().min(1, "Informe o nome.").max(160);
export const publicationSchema = z.enum(["draft", "published"]);
export const logoUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  // Local files and HTTPS images only; no protocol-relative URLs or credentials.
  if (/^\/(?!\/)[A-Za-z0-9/_.,%~-]+$/.test(value) && !value.includes("..")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Use um caminho local ou uma URL HTTPS de imagem.");
const identity = { id: optionalId, expected_updated_at: version };
const participation = {
  season_id: z.uuid(), region_id: z.uuid(), partner_status: z.enum(["partner", "qualifier", "visitor"]),
};
export const organizationSchema = z.object({
  ...identity, name, slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  short_name: z.string().trim().max(24).default(""), logo_url: logoUrlSchema.default(""),
  publication_status: publicationSchema,
  season_id: optionalId, region_id: optionalId,
  partner_status: z.enum(["partner", "qualifier", "visitor"]).default("partner"),
}).refine((value) => value.id ? Boolean(value.expected_updated_at) : Boolean(value.season_id && value.region_id), {
  message: "Informe temporada e região para criar, ou recarregue a edição.",
});
export const teamSeasonSchema = z.object({
  ...identity, organization_id: z.uuid(), ...participation,
  state: z.enum(["draft", "published", "archived"]),
}).refine((value) => !value.id || Boolean(value.expected_updated_at), "Recarregue a participação antes de editar.");
export const seasonSchema = z.object({
  ...identity, name, year: z.coerce.number().int().min(2000).max(9999), publication_status: publicationSchema,
}).refine((value) => !value.id || Boolean(value.expected_updated_at), "Recarregue a temporada antes de editar.");

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type TeamSeasonInput = z.infer<typeof teamSeasonSchema>;
export type SeasonInput = z.infer<typeof seasonSchema>;
export type OrganizationRow = Pick<OrganizationInput, "name" | "slug" | "publication_status"> & {
  id: string; short_name: string | null; logo_url: string | null; updated_at: string;
};
export type SeasonRow = Pick<SeasonInput, "name" | "year" | "publication_status"> & { id: string; updated_at: string };
export type RegionRow = { id: string; name: string; publication_status: "draft" | "published" };
export type TeamSeasonRow = Pick<TeamSeasonInput, "organization_id" | "season_id" | "region_id" | "partner_status"> & {
  id: string; publication_status: "draft" | "published"; archived_at: string | null; updated_at: string; roster_revision: number;
};
export type OrganizationData = { organizations: OrganizationRow[]; seasons: SeasonRow[]; regions: RegionRow[]; team_seasons: TeamSeasonRow[] };

export const editorMessages = {
  saved: "Alterações salvas.",
  invalid: "Revise os campos. Nome, slug, região e temporada precisam ser válidos.",
  conflict: "Este registro mudou desde que você abriu a página. Recarregue antes de editar novamente.",
  duplicate: "O slug, ano ou participação já está cadastrado. Edite o registro existente.",
  reference: "A região, temporada ou organização não está disponível. Para publicar, as referências também precisam estar publicadas.",
  denied: "Sua sessão não permite esta operação. Entre novamente.",
  unavailable: "Não foi possível confirmar a gravação. Consulte o cadastro antes de tentar novamente.",
  upload: "Envie uma imagem PNG, JPEG ou WebP de até 2 MB, com o Storage configurado.",
} as const;
export type EditorStatus = keyof typeof editorMessages;
export function mutationError(code?: string): EditorStatus {
  if (code === "23505") return "duplicate";
  if (code === "40001" || code === "P0002") return "conflict";
  if (code === "23503" || code === "P0001") return "reference";
  if (code === "42501") return "denied";
  if (code === "23514" || code === "22P02" || code === "22023") return "invalid";
  return "unavailable";
}

export function filterOrganizations(rows: OrganizationRow[], query: string) {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const term = normalize(query.trim());
  return rows.filter((row) => normalize(`${row.name} ${row.short_name ?? ""} ${row.slug}`).includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
}

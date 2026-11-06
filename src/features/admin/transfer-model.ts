import { z } from "zod";
import { rosterStatuses } from "./roster-draft-model.ts";
import { publishDraftSchema, publicationMessages } from "./roster-publication-model.ts";

export const transferSchema = z.object({
  id: z.uuid(), from_membership_id: z.uuid(), to_team_season_id: z.uuid(),
  expected_membership_updated_at: z.iso.datetime({ offset: true }),
  expected_from_revision: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  expected_to_revision: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  effective_on: z.iso.date(), status: z.enum(rosterStatuses),
  note: z.string().trim().max(1000), source_url: publishDraftSchema.shape.source_url,
  confirm: z.literal("transfer"),
}).strict();
export type TransferInput = z.infer<typeof transferSchema>;
export const transferResultSchema = z.object({ id: z.uuid(), change_id: z.uuid(), already_published: z.boolean() });
export const transferMessages = {
  ...publicationMessages,
  saved: "Transferência publicada. Origem, destino e histórico foram atualizados juntos.",
  invalid: "Revise a data, o status, a observação, a fonte HTTPS e a confirmação.",
  conflict: "O vínculo ou um dos elencos mudou desde a revisão. Recarregue e confira a transferência novamente.",
  duplicate: "Este pedido já foi registrado. Confira o histórico antes de preparar outra transferência.",
  reference: "Transferência bloqueada. Confira participações e jogador publicados, mesma temporada, data e disponibilidade. Resolva rascunhos abertos nas duas equipes e conflitos de titular antes de continuar.",
  unavailable: "Não foi possível confirmar o resultado. Consulte os elencos e o histórico antes de tentar novamente.",
};

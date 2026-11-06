import { z } from "zod";
import { draftMessages } from "./roster-draft-model.ts";

export const publishDraftSchema = z.object({
  id: z.uuid(), expected_updated_at: z.iso.datetime({ offset: true }), confirm: z.literal("publish"),
  source_url: z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(2048).refine((value) => {
    const url = new URL(value); return !url.username && !url.password && !/\s/.test(value);
  })]),
}).strict();
export type PublishDraftInput = z.infer<typeof publishDraftSchema>;
export const publicationResultSchema = z.object({ id: z.uuid(), team_season_id: z.uuid(), already_published: z.boolean() });
export const publicationMessages = {
  ...draftMessages,
  saved: "Elenco publicado com histórico preservado.",
  invalid: "Confirme a publicação, revise a fonte HTTPS e verifique se há mudanças para publicar.",
  reference: "Publicação bloqueada: confira perfis e participação publicados, conflitos de titular e datas. Um vínculo alterado deve começar antes da data de vigência; períodos não podem se sobrepor.",
  unavailable: "Não foi possível confirmar a publicação. Recarregue o rascunho para verificar o resultado antes de tentar novamente.",
};

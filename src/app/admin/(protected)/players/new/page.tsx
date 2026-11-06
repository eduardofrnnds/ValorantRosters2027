import { randomUUID } from "node:crypto";
import { getAdminPlayers } from "@/features/admin/player-server";
import { PlayerHeading, PlayerForm, PlayerEditorNotice, PlayersUnavailable } from "@/features/admin/player-forms";

export const metadata = { title: "Novo jogador | Administração" };
export default async function NewPlayerPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const data = await getAdminPlayers();
  const { status } = await searchParams;
  return <><PlayerHeading title="Novo jogador" description="Cadastre uma identidade independente de equipe. Deixe campos desconhecidos em branco." /><PlayerEditorNotice status={status} />{data ? <section className="rounded-lg border border-border bg-card p-5 sm:p-6"><PlayerForm id={randomUUID()} /></section> : <PlayersUnavailable />}</>;
}

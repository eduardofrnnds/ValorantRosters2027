import Link from "next/link";
import { z } from "zod";
import { getAdminPlayers } from "@/features/admin/player-server";
import { PlayerHeading, PlayerForm, PlayerEditorNotice, PlayerPhotoUpload, PlayersUnavailable } from "@/features/admin/player-forms";

export const metadata = { title: "Editar jogador | Administração" };
export default async function EditPlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const { status } = await searchParams;
  const data = await getAdminPlayers(z.uuid().safeParse(id).success ? id : undefined);
  if (!data) return <PlayersUnavailable />;
  const row = data.players.find((player) => player.id === id);
  if (!row) return <PlayerHeading title="Jogador não encontrado" description="O registro não existe ou não está disponível para esta sessão." />;
  return <><PlayerHeading title={row.nickname} description="Nome, foto e slug podem mudar; a identidade e os vínculos permanecem." /><PlayerEditorNotice status={status} />
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6"><PlayerForm id={id} row={row} />{row.publication_status === "published" && <Link className="mt-4 inline-flex min-h-12 items-center text-sm underline" href={`/player/${row.slug}`}>Abrir perfil público</Link>}</section>
    <PlayerPhotoUpload row={row} enabled={process.env.SUPABASE_PLAYER_PHOTOS_BUCKET === "player-photos"} />
    <section className="mt-8"><h2 className="text-xl font-semibold">Endereços reservados</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Endereços que já foram públicos redirecionam enquanto o perfil estiver publicado. Slugs usados somente em rascunhos permanecem privados.</p><ul className="mt-4 space-y-2">{data.aliases.map((alias) => <li key={alias.id} className="break-all rounded-md border border-border p-3 text-sm">/{alias.slug} · {alias.slug === row.slug ? "Atual" : alias.was_published ? "Anterior público" : "Anterior privado"}</li>)}</ul><p className="mt-4 break-all font-mono text-xs text-muted-foreground">ID: {row.id}</p></section>
  </>;
}

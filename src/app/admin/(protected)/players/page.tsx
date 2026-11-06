import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/features/admin/organization-forms";
import { PlayerEditorNotice, PlayersUnavailable } from "@/features/admin/player-forms";
import { getAdminPlayers } from "@/features/admin/player-server";
import { filterPlayers } from "@/features/admin/player-model";

export const metadata = { title: "Jogadores | Administração" };
export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const data = await getAdminPlayers();
  const query = typeof params.q === "string" ? params.q.slice(0, 160) : "";
  const rows = data ? filterPlayers(data.players, query) : [];
  return <><header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold sm:text-3xl">Jogadores</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Perfis de jogadores e técnicos, com identidade e histórico preservados.</p></div><Button asChild><Link href="/admin/players/new">Novo jogador</Link></Button></header><PlayerEditorNotice status={params.status} />
    {!data ? <PlayersUnavailable /> : <>
      <form method="get" action="/admin/players" className="mb-6 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label="Buscar por nickname, nome, país ou slug" name="q" type="search" defaultValue={query} maxLength={160} /></div><Button type="submit" variant="secondary">Buscar</Button>{query && <Link href="/admin/players" className="inline-flex min-h-12 items-center text-sm underline">Limpar</Link>}</form>
      <p className="mb-4 text-sm text-muted-foreground">{rows.length} perfis encontrados · {data.players.length} no cadastro</p>
      {rows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">{query ? "Nenhum jogador corresponde à busca." : "Sem dados. Nenhum jogador cadastrado."}</p> : <ul className="space-y-3">{rows.map((row) => <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5"><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{row.nickname}</h2>{row.name && <p className="mt-1 break-words text-sm text-muted-foreground">{row.name}</p>}<p className="mt-2 break-all text-xs text-muted-foreground">/{row.slug} · {row.publication_status === "published" ? "Publicado" : "Rascunho"}</p></div><Button asChild variant="outline"><Link href={`/admin/players/${row.id}`} aria-label={`Editar ${row.nickname} (${row.slug})`}>Editar</Link></Button></li>)}</ul>}
    </>}
  </>;
}

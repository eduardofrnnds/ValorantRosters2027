import Link from "next/link";
import { changeLabels, type TimelineResult } from "./timeline-model";
import { formatCareerDate, membershipStatusLabels, playerRoleLabels } from "../players/player-profile-model";

export function Timeline({ result, empty = "Nenhum registro publicado no histórico." }: { result: TimelineResult; empty?: string }) {
  if (result.status === "unavailable") return <p role="alert" className="rounded-lg border border-border bg-card p-6 text-sm">Histórico indisponível. Tente novamente em instantes.</p>;
  if (!result.data.events.length) return <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">{empty}</p>;
  const today = new Date().toISOString().slice(0, 10);
  return <ol className="space-y-4">{result.data.events.map((event) => <li id={`change-${event.id}`} key={event.id} className="scroll-mt-8 rounded-xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{changeLabels[event.type]}</span><time dateTime={event.date}>{formatCareerDate(event.date)}</time>{event.date > today && <span className="rounded-full border border-border px-2 py-1">Vigência futura</span>}</div>
    <h3 className="mt-2 break-words text-lg font-semibold"><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/player/${event.player.slug}`}>{event.player.nickname}</Link></h3>
    <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">{(["from", "to"] as const).map((key) => {
      const side = event[key];
      return side && <div key={key} className="min-w-0 break-words"><dt className="text-muted-foreground">{key === "from" ? "Origem / antes" : "Destino / depois"}</dt><dd><Link href={`/team/${side.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4">{side.name}</Link><p className="text-xs leading-6 text-muted-foreground">{side.season} · {membershipStatusLabels[side.status]}{side.role ? ` · ${playerRoleLabels[side.role]}` : ""}</p></dd></div>;
    })}</dl>
    <p className="mt-4 break-words text-sm leading-6">{event.summary}</p>
    {event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{event.note}</p>}
    {event.source_url && <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Consultar fonte</a>}
  </li>)}</ol>;
}

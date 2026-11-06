import { UserRound } from "lucide-react";
import { PlayerCard } from "./player-card";
import type { RosterGroup } from "./roster-model";

export function RosterSection({ group }: { group: RosterGroup }) {
  return (
    <section id={group.id} tabIndex={-1} aria-labelledby={`${group.id}-titulo`} className="scroll-mt-8 rounded-xl border border-border bg-card p-6 sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${group.id}-titulo`} className="text-xl font-semibold tracking-tight">{group.title}</h2>
        <span className="text-xs text-muted-foreground">{group.players.length > 0 ? `${group.players.length} ${group.players.length === 1 ? "pessoa" : "pessoas"}` : "Sem publicações"}</span>
      </div>
      {group.players.length > 0 ? (
        <ul className="grid gap-3">
          {group.players.map((player) => <li key={player.id}><PlayerCard player={player} /></li>)}
        </ul>
      ) : (
        <div className="flex min-h-20 items-center gap-4 border-t border-border pt-5">
          <UserRound aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">{group.emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

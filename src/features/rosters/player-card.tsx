import { playerRoleLabels } from "../players/player-profile-model.ts";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PlayerPhoto } from "../players/player-photo";
import type { PlayerCardData } from "./roster-model";

export function PlayerCard({ player }: { player: PlayerCardData }) {
  return (
    <Link
      href={`/player/${player.slug}`}
      aria-label={`Ver perfil de ${player.nickname}`}
      className="group flex min-h-20 min-w-0 items-center gap-3 rounded-lg border border-border bg-secondary p-4 transition-colors hover:border-input focus-visible:outline-offset-4"
    >
      <PlayerPhoto nickname={player.nickname} src={player.photoUrl} size="sm" />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><h3 className="text-sm font-semibold">{player.nickname}</h3>{player.role && <p className="mt-1 text-xs text-muted-foreground">{playerRoleLabels[player.role]}</p>}</div>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}

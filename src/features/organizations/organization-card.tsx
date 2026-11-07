import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LogoPlaceholder } from "@/components/logo-placeholder";
import { playerRoleLabels } from "@/features/players/player-profile-model";
import { PlayerPhoto } from "@/features/players/player-photo";
import type { RosterGroup } from "@/features/rosters/roster-model";
import { partnerStatusLabels, type OrganizationListing } from "./directory-model";

export function OrganizationCard({ organization, groups }: {
  organization: OrganizationListing;
  groups: readonly RosterGroup[] | null;
}) {
  const publishedGroups = groups?.filter((group) => group.players.length > 0) ?? [];

  return (
    <article aria-labelledby={`team-${organization.id}`} className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <LogoPlaceholder name={organization.name} src={organization.logoUrl} />
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {partnerStatusLabels[organization.partnerStatus]}
        </span>
      </div>
      <h3 id={`team-${organization.id}`} className="text-xl leading-7 font-semibold tracking-tight [overflow-wrap:anywhere]">
        <Link
          href={`/team/${organization.slug}`}
          aria-label={`Ver ${organization.name} — ${partnerStatusLabels[organization.partnerStatus]}`}
          className="group flex min-h-11 items-center justify-between gap-3 rounded-sm transition-colors hover:text-primary"
        >
          {organization.name}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
        </Link>
      </h3>
      {organization.shortName && <p className="mt-1 font-mono text-xs text-muted-foreground">{organization.shortName}</p>}
      <div className="mt-5 border-t border-border pt-5">
        {groups === null ? (
          <p className="text-sm leading-6 text-muted-foreground">Não foi possível carregar o roster. Tente novamente em instantes.</p>
        ) : publishedGroups.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">Roster ainda não publicado para esta temporada.</p>
        ) : (
          <div className="space-y-5">
            {publishedGroups.map((group) => (
              <section key={group.id} aria-labelledby={`team-${organization.id} team-${organization.id}-${group.id}`}>
                <h4 id={`team-${organization.id}-${group.id}`} className="mb-2 font-mono text-xs tracking-wider text-muted-foreground uppercase">{group.title}</h4>
                <ul className="divide-y divide-border">
                  {group.players.map((player) => (
                    <li key={player.id} className="flex min-h-14 items-center gap-3 py-2">
                      <PlayerPhoto nickname={player.nickname} src={player.photoUrl} size="sm" />
                      <span className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">{player.nickname}</span>
                      {player.role && <span className="text-xs text-muted-foreground">{playerRoleLabels[player.role]}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

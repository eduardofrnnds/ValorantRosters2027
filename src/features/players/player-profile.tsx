import Link from "next/link";
import { ArrowLeft, ArrowUpRight, History, Shield } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { PlayerPhoto } from "./player-photo";
import { formatCareerDate, membershipStatusLabels, playerRoleLabels, type PlayerProfileData } from "./player-profile-model";

type Membership = PlayerProfileData["currentMemberships"][number];

function MembershipCard({ membership }: { membership: Membership }) {
  return (
    <li className="rounded-xl border border-border bg-card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">
          <Link href={`/team/${membership.organization.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-sm hover:text-primary">
            {membership.organization.name}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </h3>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">{membershipStatusLabels[membership.status]}</span>
      </div>
      {membership.role && <p className="mt-3 text-sm text-muted-foreground">Função no vínculo: {playerRoleLabels[membership.role]}</p>}
      <p className="mt-3 text-sm text-muted-foreground">Temporada {membership.season.year}</p>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        <time dateTime={membership.startDate}>{formatCareerDate(membership.startDate)}</time>
        {membership.endDate ? <> até <time dateTime={membership.endDate}>{formatCareerDate(membership.endDate)}</time></> : " até o presente"}
      </p>
    </li>
  );
}

export function PlayerProfile({ profile }: { profile: PlayerProfileData }) {
  const { player, currentMemberships, pastMemberships } = profile;
  return (
    <Container className="pb-14 sm:pb-20">
      <div className="pt-6 sm:pt-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3"><Link href="/#regioes"><ArrowLeft aria-hidden="true" />Explorar regiões</Link></Button>
      </div>
      <header className="py-8 sm:py-10">
        <p className="mb-6 font-mono text-xs tracking-[0.16em] text-primary uppercase">VCT / Perfil de jogador</p>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
          <PlayerPhoto nickname={player.nickname} src={player.photoUrl} />
          <div className="min-w-0">
            <h1 className="text-4xl leading-tight font-bold tracking-[-0.04em] [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">{player.nickname}</h1>
            {player.name && <p className="mt-3 text-lg text-muted-foreground [overflow-wrap:anywhere]">{player.name}</p>}
            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div><dt className="text-muted-foreground">Nacionalidade</dt><dd className="mt-1 [overflow-wrap:anywhere]">{player.nationality || "Não informada"}</dd></div>
              <div><dt className="text-muted-foreground">Função</dt><dd className="mt-1">{player.role ? playerRoleLabels[player.role] : "Não informada"}</dd></div>
            </dl>
            {player.links && player.links.length > 0 && <nav aria-label="Links do jogador" className="mt-4 flex flex-wrap gap-3">{player.links.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm underline">{link.label}<ArrowUpRight aria-hidden="true" className="size-4" /></a>)}</nav>}
          </div>
        </div>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-muted-foreground">Equipe e carreira com base nos vínculos publicados neste site.</p>
      </header>
      <nav aria-label="Seções do jogador" className="mb-8 flex flex-wrap gap-x-5 border-y border-border py-2">
        <a href="#linha-do-tempo" className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-muted-foreground hover:text-foreground">Linha do tempo</a>
        <a href="#equipe-atual" className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-muted-foreground hover:text-foreground">Equipe atual</a>
        <a href="#historico-carreira" className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-muted-foreground hover:text-foreground">Histórico de carreira</a>
      </nav>
      <section id="equipe-atual" tabIndex={-1} aria-labelledby="equipe-atual-titulo" className="scroll-mt-8">
        <h2 id="equipe-atual-titulo" className="mb-6 text-2xl font-semibold tracking-tight">Equipe atual</h2>
        {currentMemberships.length > 0 ? (
          <ul className="grid gap-4 lg:grid-cols-2">{currentMemberships.map((membership) => <MembershipCard key={membership.id} membership={membership} />)}</ul>
        ) : (
          <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-6 sm:p-8">
            <Shield aria-hidden="true" className="mt-1 size-6 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-7 text-muted-foreground">Nenhum vínculo atual publicado.</p>
          </div>
        )}
      </section>
      <section id="historico-carreira" tabIndex={-1} aria-labelledby="historico-carreira-titulo" className="mt-10 scroll-mt-8 border-t border-border pt-10">
        <h2 id="historico-carreira-titulo" className="mb-6 text-2xl font-semibold tracking-tight">Histórico de carreira</h2>
        {pastMemberships.length > 0 ? (
          <ol className="grid gap-4">{pastMemberships.map((membership) => <MembershipCard key={membership.id} membership={membership} />)}</ol>
        ) : (
          <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-6 sm:p-8">
            <History aria-hidden="true" className="mt-1 size-6 shrink-0 text-muted-foreground" />
            <div><h3 className="text-base font-semibold">Nenhum histórico publicado.</h3>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">As passagens anteriores por equipes aparecerão aqui quando houver registros publicados.</p></div>
          </div>
        )}
      </section>
    </Container>
  );
}

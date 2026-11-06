import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getRosterTimeline } from "@/features/transfers/timeline-server";
import { Timeline } from "@/features/transfers/timeline";
import { timelineHref } from "@/features/transfers/timeline-model";
import { getPublicPlayer } from "@/features/players/public-player-server";
import { Container } from "@/components/layout/container";
import { PlayerProfile } from "@/features/players/player-profile";
import PlayerNotFound from "./not-found";

type PlayerPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicPlayer(slug);
  if (result.status !== "ready") return { title: result.status === "unavailable" ? "Perfil indisponível | VCT Roster Tracker" : "Jogador não encontrado | VCT Roster Tracker", robots: { index: false, follow: false } };
  const { player } = result.profile;
  return {
    title: `${player.nickname} | VCT Roster Tracker`,
    description: `Perfil de ${player.nickname}: equipe atual e histórico de carreira publicados no VCT Roster Tracker.`,
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;
  const result = await getPublicPlayer(slug);
  if (result.status === "redirect") redirect(`/player/${result.slug}`);
  if (result.status === "unavailable") return <Container className="py-16"><h1 className="text-3xl font-semibold">Perfil indisponível</h1><p className="mt-4 text-muted-foreground">Não foi possível consultar o jogador e sua carreira. Tente novamente em instantes.</p></Container>;
  // The route-scoped proxy supplies HTTP 404; return usable HTML even without JS.
  if (result.status === "missing") return <PlayerNotFound />;
  const timeline = await getRosterTimeline({ player_id: result.profile.player.id });
  return <><PlayerProfile profile={result.profile} /><Container className="pb-14"><section id="linha-do-tempo" aria-labelledby="linha-do-tempo-titulo" className="scroll-mt-8 border-t border-border pt-8"><h2 id="linha-do-tempo-titulo" className="mb-6 text-2xl font-semibold">Linha do tempo</h2><Timeline result={timeline} /><Link href={timelineHref({ player_id: result.profile.player.id })} className="mt-4 inline-flex min-h-12 items-center text-sm underline">Ver todas as mudanças do jogador</Link></section></Container></>;
}

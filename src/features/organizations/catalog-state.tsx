import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export function LocalCatalogNotice({ source }: { source: "local" | "supabase" }) {
  return source === "local" ? <p className="pt-5 text-xs leading-6 text-muted-foreground">Somente leitura · catálogo local de 2027.</p> : null;
}

export function CatalogState({ status }: { status: "empty" | "unavailable" }) {
  return (
    <Container className="flex flex-1 flex-col items-start justify-center py-16 sm:py-24">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{status === "empty" ? "Nenhuma temporada publicada" : "Dados indisponíveis"}</h1>
      <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">{status === "empty" ? "O catálogo de 2027 ainda não tem uma temporada publicada. Volte mais tarde para acompanhar as equipes." : "Não foi possível carregar o catálogo agora. Tente novamente em instantes."}</p>
      <Button asChild variant="outline" className="mt-8"><Link href="/">Voltar ao início</Link></Button>
    </Container>
  );
}

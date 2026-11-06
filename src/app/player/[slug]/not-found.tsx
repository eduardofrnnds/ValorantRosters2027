import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function PlayerNotFound() {
  return (
    <Container className="flex flex-1 flex-col items-start justify-center py-16 sm:py-24">
      <p className="mb-5 font-mono text-xs tracking-wider text-primary">404</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Jogador não encontrado</h1>
      <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Não há um perfil de jogador publicado neste endereço. Explore as regiões para acompanhar as organizações.</p>
      <Button asChild variant="outline" className="mt-8"><Link href="/#regioes"><ArrowLeft aria-hidden="true" />Voltar às regiões</Link></Button>
    </Container>
  );
}

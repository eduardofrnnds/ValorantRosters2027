import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <Container className="flex flex-1 flex-col items-start justify-center py-16 sm:py-24">
    <p className="mb-5 font-mono text-xs tracking-wider text-primary">404</p>
    <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Página não encontrada</h1>
    <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Este endereço não está disponível. Volte ao início para explorar as regiões, equipes e mudanças publicadas.</p>
    <Button asChild variant="outline" className="mt-8"><Link href="/">Voltar ao início</Link></Button>
  </Container>;
}

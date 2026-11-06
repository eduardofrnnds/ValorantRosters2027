import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_SEASON_YEAR } from "@/features/organizations/data/vct-2027";

export function SiteHeader() {
  return (
    <header id="topo" className="border-b border-border">
      <Container className="grid min-h-22 grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 py-4 md:flex md:justify-between">
        <Link href="/" aria-label="VCT Roster Tracker — início" className="flex min-h-11 items-center gap-3 rounded-sm">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ArrowUpRight className="size-7" strokeWidth={2.5} />
          </span>
          <span className="text-sm leading-5 font-bold tracking-tight">
            VCT <span className="font-normal text-muted-foreground">/</span>
            <span className="block text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Roster Tracker</span>
          </span>
        </Link>
        <nav aria-label="Navegação principal" className="order-3 col-span-2 flex flex-wrap items-center gap-1 border-t border-border pt-3 sm:gap-4 md:order-none md:ml-auto md:border-0 md:pt-0">
          <Link href="/#regioes" className={buttonVariants({ variant: "ghost", size: "sm" })}>Regiões</Link>
          <Link href="/#mudancas" className={buttonVariants({ variant: "ghost", size: "sm" })}>Mudanças</Link>
          <Link href="/transfers" className={buttonVariants({ variant: "ghost", size: "sm" })}>Transferências</Link>
          <Link href="/#sobre" className={buttonVariants({ variant: "ghost", size: "sm" })}>Sobre o projeto</Link>
        </nav>
        <span className="border-l border-border pl-4 font-mono text-xs tracking-wider text-muted-foreground sm:pl-6">
          <span className="sr-only">Temporada </span>{DEFAULT_SEASON_YEAR}
        </span>
      </Container>
    </header>
  );
}

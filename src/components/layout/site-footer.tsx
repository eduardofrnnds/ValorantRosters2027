import { ArrowUp } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export function SiteFooter() {
  return (
    <footer id="sobre" tabIndex={-1} className="border-t border-border">
      <Container className="flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <p className="text-sm font-semibold">VCT Roster Tracker</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Acompanhamento independente de equipes e elencos do VALORANT.
            Atualizações manuais, com espaço para cada nova história.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
          <a href="#topo">Voltar ao topo <ArrowUp aria-hidden="true" /></a>
        </Button>
      </Container>
    </footer>
  );
}

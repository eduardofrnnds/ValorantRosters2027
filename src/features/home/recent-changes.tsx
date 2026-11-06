import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { getRosterTimeline } from "../transfers/timeline-server";
import { Timeline } from "../transfers/timeline";

export async function RecentChanges() {
  const result = await getRosterTimeline({ page_size: 5 });
  return (
    <section id="mudancas" aria-labelledby="mudancas-titulo" className="scroll-mt-8 border-t border-border py-12 sm:py-16">
      <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="mudancas-titulo" className="text-2xl font-semibold tracking-tight sm:text-3xl">Mudanças recentes</h2>
        <p className="text-sm text-muted-foreground">Os próximos movimentos começam aqui.</p>
      </div>
      {result.status === "unavailable" || result.data.events.length > 0 ? <Timeline result={result} /> : <Card className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <History className="size-6" strokeWidth={1.5} />
        </span>
        <div>
          <h3 className="text-base font-semibold">Nenhuma mudança publicada por aqui ainda.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            Quando houver atualizações de elenco publicadas, elas aparecerão neste espaço.
          </p>
        </div>
      </Card>}
      <Link href="/transfers?kind=all" className="mt-4 inline-flex min-h-12 items-center text-sm underline">Ver todas as mudanças</Link>
    </section>
  );
}

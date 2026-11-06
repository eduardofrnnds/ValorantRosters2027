import { History } from "lucide-react";
import Link from "next/link";
import { getRosterTimeline } from "../transfers/timeline-server";
import { Timeline } from "../transfers/timeline";
import { timelineHref } from "../transfers/timeline-model";

export async function TeamHistory({ organizationId, slug }: { organizationId: string; slug: string }) {
  const result = await getRosterTimeline({ organization_id: organizationId });
  return (
    <section id="historico" tabIndex={-1} aria-labelledby="historico-titulo" className="mt-8 scroll-mt-8 border-t border-border pt-8 sm:mt-10 sm:pt-10">
      <h2 id="historico-titulo" className="mb-6 text-2xl font-semibold tracking-tight">Histórico</h2>
      {result.status === "unavailable" || result.data.events.length > 0 ? <Timeline result={result} /> : <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <History className="size-6" strokeWidth={1.5} />
        </span>
        <div>
          <h3 className="text-base font-semibold">Nenhum registro publicado no histórico.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">As mudanças de elenco aparecerão aqui quando houver registros publicados para esta organização.</p>
        </div>
      </div>}
      <Link href={timelineHref({ team: slug })} className="mt-4 inline-flex min-h-12 items-center text-sm underline">Ver histórico completo da equipe</Link>
    </section>
  );
}

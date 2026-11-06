import Link from "next/link";
import { ArrowRight, ArrowLeftRight, Building2, ClipboardList, FilePenLine, RefreshCw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminSections, metricDetails, type AdminMetrics, type MetricKey } from "./dashboard-model";

const icons = { organizations: Building2, players: UsersRound, changes: ArrowLeftRight, drafts: FilePenLine, memberships: ClipboardList, transfers: ArrowLeftRight };

export function MetricCards({ keys, metrics, links = true }: { keys: readonly MetricKey[]; metrics: AdminMetrics; links?: boolean }) {
  return (
    <div className={keys.length > 2 ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : keys.length === 2 ? "grid gap-4 sm:grid-cols-2" : "grid max-w-xl gap-4"}>
      {keys.map((key) => {
        const detail = metricDetails[key];
        const metric = metrics[key];
        const ready = metric?.status === "ready";
        const Icon = icons[key];
        return (
          <Card key={key} id={key === "drafts" ? "rascunhos" : undefined} tabIndex={key === "drafts" ? -1 : undefined}
            data-metric={key} data-count-state={ready ? "ready" : "unavailable"} className="flex min-w-0 scroll-mt-8 flex-col p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-muted-foreground">{detail.title}</h2><Icon aria-hidden="true" className="size-4 shrink-0 text-primary" /></div>
            <p className="mt-5 break-all font-mono text-4xl font-semibold tracking-tight tabular-nums" data-count-value="">{ready ? metric.count.toLocaleString("pt-BR") : <span aria-label="Contagem indisponível">—</span>}</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground">{ready ? metric.count === 0 ? "Sem dados" : "No cadastro" : "Não foi possível consultar"}</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{ready && metric.count === 0 ? detail.empty : detail.description}</p>
            {links && <Link href={detail.href} prefetch={false} className="mt-5 inline-flex min-h-11 items-center justify-between gap-2 rounded-sm border-t border-border pt-3 text-xs font-medium hover:text-primary">{detail.link}<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link>}
          </Card>
        );
      })}
    </div>
  );
}

export function MetricsNotice({ keys, metrics }: { keys: readonly MetricKey[]; metrics: AdminMetrics }) {
  const failed = keys.filter((key) => metrics[key]?.status !== "ready").length;
  const empty = !failed && keys.every((key) => metrics[key]?.status === "ready" && metrics[key].count === 0);
  if (!failed && !empty) return null;
  return (
    <div role="status" className="mb-6 rounded-lg border border-border bg-secondary p-5 text-sm leading-6">
      <p className="font-semibold">{failed ? failed === keys.length ? "Contagens indisponíveis" : "Algumas contagens estão indisponíveis" : "Sem dados cadastrados nesta visão"}</p>
      <p className="mt-1 text-muted-foreground">{failed ? "Não foi possível concluir todas as consultas. Tente atualizar as contagens." : "Nenhum registro foi encontrado para os totais abaixo."}</p>
    </div>
  );
}

export function DashboardHeading({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0"><p className="mb-3 font-mono text-xs tracking-widest text-primary uppercase">Administração / Consulta</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
      <form action={href} method="get" className="shrink-0"><Button type="submit" variant="outline" size="sm"><RefreshCw aria-hidden="true" />Atualizar contagens</Button></form>
    </div>
  );
}

export function AdminShortcuts() {
  return (
    <section aria-labelledby="atalhos-title" className="mt-10">
      <div className="mb-5"><h2 id="atalhos-title" className="text-lg font-semibold">Áreas do cadastro</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Consulte o resumo de cada área. As ferramentas de edição ainda não estão disponíveis.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {adminSections.map((section) => <Link key={section.slug} href={section.href} prefetch={false} className="group flex min-w-0 items-start gap-4 rounded-lg border border-border p-5 transition-colors hover:bg-card">
          <div className="min-w-0 flex-1"><h3 className="font-medium">{section.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p></div><ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
        </Link>)}
      </div>
    </section>
  );
}

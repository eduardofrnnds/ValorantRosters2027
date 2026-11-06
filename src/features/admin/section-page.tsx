import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminMetrics } from "./dashboard-server";
import { adminSections } from "./dashboard-model";
import { DashboardHeading, MetricCards, MetricsNotice } from "./dashboard";

export async function AdminSectionPage({ section }: { section: (typeof adminSections)[number] }) {
  const metrics = await getAdminMetrics(section.metrics);
  return (
    <>
      <DashboardHeading title={section.title} description={section.description} href={section.href} />
      <MetricsNotice keys={section.metrics} metrics={metrics} />
      <MetricCards keys={section.metrics} metrics={metrics} links={false} />
      <div className="mt-8 rounded-lg border border-border p-5 text-sm leading-6"><p className="font-medium">Consulta resumida</p><p className="mt-2 text-muted-foreground">Esta área apresenta as contagens do cadastro. As ferramentas de edição ainda não estão disponíveis.</p></div>
      <Link href="/admin" prefetch={false} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm underline underline-offset-4"><ArrowLeft aria-hidden="true" className="size-4" />Voltar à visão geral</Link>
    </>
  );
}

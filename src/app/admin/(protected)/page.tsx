import { getAdminMetrics } from "@/features/admin/dashboard-server";
import { dashboardKeys } from "@/features/admin/dashboard-model";
import { AdminShortcuts, DashboardHeading, MetricCards, MetricsNotice } from "@/features/admin/dashboard";

export default async function AdminPage() {
  const metrics = await getAdminMetrics(dashboardKeys);
  return (
    <>
      <DashboardHeading title="Dashboard" description="Visão geral do cadastro em todas as temporadas. Os totais incluem registros publicados e ainda não publicados." href="/admin" />
      <MetricsNotice keys={dashboardKeys} metrics={metrics} />
      <MetricCards keys={dashboardKeys} metrics={metrics} />
      <AdminShortcuts />
    </>
  );
}

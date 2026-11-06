import { getOrganizationData } from "@/features/admin/organization-server";
import { EditorHeading, EditorNotice, EditorUnavailable, OrganizationForm } from "@/features/admin/organization-forms";

export const metadata = { title: "Nova organização | Administração" };
export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const data = await getOrganizationData();
  const { status } = await searchParams;
  return <><EditorHeading title="Nova organização" description="Cadastre a equipe e sua primeira participação. Novos cadastros começam como rascunho; publicar é uma escolha explícita." /><EditorNotice status={status} />{data ? <section className="rounded-lg border border-border bg-card p-5 sm:p-6"><OrganizationForm data={data} /></section> : <EditorUnavailable />}</>;
}

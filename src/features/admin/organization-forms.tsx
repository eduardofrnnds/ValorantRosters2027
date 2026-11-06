import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EditorForm } from "./editor-form";
import { editorMessages, type OrganizationData, type OrganizationRow, type SeasonRow, type TeamSeasonRow } from "./organization-model";

export const inputClass = "min-h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{label}</span><input className={inputClass} {...props} /></label>;
}
function Select({ label, name, value, children }: { label: string; name: string; value: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-sm font-medium"><span>{label}</span><select required className={inputClass} name={name} defaultValue={value}>{children}</select></label>;
}
function Identity({ row }: { row?: { id: string; updated_at: string } }) {
  return <><input type="hidden" name="id" value={row?.id ?? ""} /><input type="hidden" name="expected_updated_at" value={row?.updated_at ?? ""} /></>;
}
function Publication({ value = "draft" }: { value?: string }) {
  return <Select label="Visibilidade" name="publication_status" value={value}><option value="draft">Rascunho — privado</option><option value="published">Publicado — visível no site</option></Select>;
}
function ParticipationFields({ data, row }: { data: OrganizationData; row?: TeamSeasonRow }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    {row ? <><input type="hidden" name="season_id" value={row.season_id} /><p className="text-sm text-muted-foreground sm:col-span-2">Temporada: {data.seasons.find((season) => season.id === row.season_id)?.year}. Para outra temporada, adicione uma participação.</p></> :
      <Select label="Temporada" name="season_id" value={data.seasons.find((season) => season.year === 2027)?.id ?? data.seasons[0]?.id ?? ""}>
        <option value="" disabled>Selecione</option>{data.seasons.map((season) => <option key={season.id} value={season.id}>{season.year} — {season.name}{season.publication_status === "draft" ? " (privada)" : ""}</option>)}
      </Select>}
    <Select label="Região" name="region_id" value={row?.region_id ?? ""}><option value="" disabled>Selecione</option>{data.regions.map((region) => <option key={region.id} value={region.id}>{region.name}{region.publication_status === "draft" ? " (privada)" : ""}</option>)}</Select>
    <Select label="Categoria na temporada" name="partner_status" value={row?.partner_status ?? "partner"}><option value="partner">Parceira</option><option value="qualifier">Qualificatória</option><option value="visitor">Visitante</option></Select>
  </div>;
}
export function EditorNotice({ status }: { status?: string | string[] }) {
  if (typeof status !== "string" || !Object.hasOwn(editorMessages, status)) return null;
  return <p role={status === "saved" ? "status" : "alert"} className="mb-6 rounded-lg border border-border bg-secondary p-4 text-sm">{editorMessages[status as keyof typeof editorMessages]}</p>;
}
export function EditorUnavailable() {
  return <div role="alert" className="rounded-lg border border-border bg-card p-6"><h2 className="font-semibold">Cadastro indisponível</h2><p className="mt-2 text-sm text-muted-foreground">Não foi possível consultar os registros. Verifique a conexão e se as migrations foram aplicadas antes de tentar novamente.</p><Link href="/admin/organizations" className="mt-4 inline-flex min-h-12 items-center text-sm underline">Voltar ao cadastro</Link></div>;
}
export function EditorHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-6"><Link href="/admin/organizations" className="mb-3 inline-flex min-h-12 items-center text-sm text-muted-foreground underline">Organizações</Link><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></header>;
}
export function OrganizationForm({ data, row }: { data: OrganizationData; row?: OrganizationRow }) {
  const canCreate = data.seasons.length > 0 && data.regions.length > 0;
  return <EditorForm key={row?.updated_at ?? "new"}><input type="hidden" name="kind" value="organization" /><Identity row={row} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome da organização" name="name" defaultValue={row?.name} required maxLength={160} autoComplete="off" />
      <Field label="Sigla (opcional)" name="short_name" defaultValue={row?.short_name ?? ""} maxLength={24} />
      <Field label="Slug — endereço do perfil" name="slug" defaultValue={row?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} placeholder="nome-da-equipe" autoCapitalize="none" spellCheck={false} />
      <Publication value={row?.publication_status} />
    </div>
    <Field label="Logo: caminho local ou URL HTTPS (opcional)" name="logo_url" defaultValue={row?.logo_url ?? ""} maxLength={2048} placeholder="/images/equipe.png" />
    <p className="text-sm leading-6 text-muted-foreground">Use uma imagem licenciada. Sem logo, o site usa o placeholder. {row ? "Alterar o slug muda o endereço público; os vínculos continuam associados à mesma organização." : "A primeira participação será salva junto com a organização."}</p>
    {!row && <ParticipationFields data={data} />}
    <p className="text-sm leading-6 text-muted-foreground">Ao publicar, as alterações deste cadastro ficam visíveis imediatamente. A participação só aparece na região quando organização, temporada e região estão publicadas.</p>
    {!row && !canCreate && <p role="alert" className="text-sm">Cadastre uma temporada e configure as regiões antes de criar a organização.</p>}
    <Button type="submit" className="w-full whitespace-normal sm:w-auto" disabled={!row && !canCreate}>{row ? "Salvar organização" : "Criar organização e participação"}</Button>
  </EditorForm>;
}
export function ParticipationForm({ data, organizationId, row }: { data: OrganizationData; organizationId: string; row?: TeamSeasonRow }) {
  return <EditorForm key={row?.updated_at ?? "new"}><input type="hidden" name="kind" value="participation" /><input type="hidden" name="organization_id" value={organizationId} /><Identity row={row} />
    <ParticipationFields data={data} row={row} />
    <Select label="Estado da participação" name="state" value={row?.archived_at ? "archived" : row?.publication_status ?? "draft"}><option value="draft">Rascunho — privado</option><option value="published">Publicado</option><option value="archived">Arquivado — privado, histórico preservado</option></Select>
    <p className="text-sm leading-6 text-muted-foreground">Arquivar retira esta participação e seus vínculos da leitura pública. Os registros permanecem no banco. Para restaurar, selecione rascunho ou publicado e salve.</p>
    <Button type="submit" className="w-full whitespace-normal sm:w-auto" disabled={!data.seasons.length || !data.regions.length}>{row ? "Salvar participação" : "Adicionar participação"}</Button>
  </EditorForm>;
}
export function SeasonForm({ row }: { row?: SeasonRow }) {
  return <EditorForm key={row?.updated_at ?? "new"}><input type="hidden" name="kind" value="season" /><Identity row={row} />
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Ano" name="year" type="number" min={2000} max={9999} required defaultValue={row?.year ?? 2027} readOnly={Boolean(row)} /><Field label="Nome da temporada" name="name" defaultValue={row?.name} required maxLength={160} placeholder="VCT 2027" /></div>
    <Publication value={row?.publication_status} /><p className="text-sm leading-6 text-muted-foreground">O ano fica fixo após o cadastro para preservar o histórico. Tornar a temporada privada também oculta suas participações no site.</p>
    <Button type="submit">{row ? "Salvar temporada" : "Criar temporada"}</Button>
  </EditorForm>;
}

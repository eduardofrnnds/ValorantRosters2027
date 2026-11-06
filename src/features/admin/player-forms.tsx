import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditorForm } from "./editor-form";
import { Field, inputClass } from "./organization-forms";
import { playerLinkLabels, playerMessages, playerRoles, type PlayerRow } from "./player-model";
import { playerRoleLabels } from "@/features/players/player-profile-model";

export function PlayerHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-6"><Link href="/admin/players" className="mb-3 inline-flex min-h-12 items-center text-sm text-muted-foreground underline">Jogadores</Link><h1 className="break-words text-2xl font-semibold sm:text-3xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></header>;
}
export function PlayerEditorNotice({ status }: { status?: string }) {
  if (!status || !Object.hasOwn(playerMessages, status)) return null;
  return <p role={status === "saved" ? "status" : "alert"} className="mb-6 rounded-lg border border-border bg-secondary p-4 text-sm">{playerMessages[status as keyof typeof playerMessages]}</p>;
}
export function PlayersUnavailable() {
  return <div role="alert" className="rounded-lg border border-border bg-card p-6"><h2 className="font-semibold">Cadastro de jogadores indisponível</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Não foi possível consultar os dados. Verifique a conexão e as migrations antes de tentar novamente.</p><Link href="/admin/players" className="mt-3 inline-flex min-h-12 items-center text-sm underline">Voltar à listagem</Link></div>;
}
export function PlayerForm({ id, row }: { id: string; row?: PlayerRow }) {
  return <EditorForm key={row?.updated_at ?? id} action="/admin/players/save" messages={playerMessages}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="expected_updated_at" value={row?.updated_at ?? ""} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nickname" name="nickname" defaultValue={row?.nickname} required maxLength={80} autoComplete="off" />
      <Field label="Nome completo (opcional)" name="name" defaultValue={row?.name ?? ""} maxLength={160} />
      <Field label={row ? "Slug — endereço do perfil" : "Slug (opcional; gerado pelo nickname)"} name="slug" defaultValue={row?.slug ?? ""} required={Boolean(row)} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} autoCapitalize="none" spellCheck={false} />
      <Field label="País / nacionalidade (opcional)" name="nationality" defaultValue={row?.nationality ?? ""} maxLength={80} />
      <label className="block space-y-2 text-sm font-medium"><span>Função (opcional)</span><select className={inputClass} name="role" defaultValue={row?.role ?? ""}><option value="">Não informada</option>{playerRoles.map((role) => <option key={role} value={role}>{playerRoleLabels[role]}</option>)}</select></label>
      <label className="block space-y-2 text-sm font-medium"><span>Visibilidade</span><select required className={inputClass} name="publication_status" defaultValue={row?.publication_status ?? "draft"}><option value="draft">Rascunho — privado</option><option value="published">Publicado — visível no site</option></select></label>
    </div>
    <p className="text-sm leading-6 text-muted-foreground">Nicknames podem se repetir. Confira o cadastro antes de criar outra identidade. Na edição, o ID permanece e os endereços que já foram publicados redirecionam para o slug atual.</p>
    <Field label="Foto: caminho local ou URL HTTPS (opcional)" name="photo_url" defaultValue={row?.photo_url ?? ""} maxLength={2048} />
    <fieldset className="min-w-0 rounded-lg border border-border p-4"><legend className="px-2 text-sm font-semibold">Links opcionais</legend><div className="grid gap-4 sm:grid-cols-2">{Object.entries(playerLinkLabels).map(([key, label]) => <Field key={key} label={label} name={key} type="url" defaultValue={row?.links[key as keyof typeof playerLinkLabels] ?? ""} maxLength={2048} placeholder="https://" />)}</div></fieldset>
    <p className="text-sm leading-6 text-muted-foreground">Publique somente informações confirmadas e fotos autorizadas. Ao salvar como publicado, as alterações do perfil aparecem imediatamente. Equipe e carreira dependem de vínculos publicados.</p>
    <Button className="w-full whitespace-normal sm:w-auto" type="submit">{row ? "Salvar jogador" : "Criar jogador"}</Button>
  </EditorForm>;
}
export function PlayerPhotoUpload({ row, enabled }: { row: PlayerRow; enabled: boolean }) {
  return <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6"><h2 className="mb-3 text-lg font-semibold">Enviar foto</h2>
    {!enabled ? <p className="text-sm leading-6 text-muted-foreground">Upload indisponível: Storage não configurado. Use uma URL HTTPS ou arquivo local no campo de foto.</p> :
      <EditorForm key={row.updated_at} action="/admin/players/photo" multipart messages={playerMessages}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="expected_updated_at" value={row.updated_at} />
        <Field label="Foto autorizada — PNG, JPEG ou WebP, até 2 MB" name="photo" type="file" required accept="image/png,image/jpeg,image/webp" />
        <p className="text-sm leading-6 text-muted-foreground">O arquivo ficará público no armazenamento, inclusive enquanto o perfil estiver em rascunho.</p><Button type="submit" variant="outline">Enviar e salvar foto</Button>
      </EditorForm>}
  </section>;
}

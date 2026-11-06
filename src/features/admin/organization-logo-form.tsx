import { Button } from "@/components/ui/button";
import { EditorForm } from "./editor-form";
import { Field } from "./organization-forms";
import type { OrganizationRow } from "./organization-model";

export function LogoUploadForm({ row, enabled }: { row: OrganizationRow; enabled: boolean }) {
  return <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6"><h2 className="mb-3 text-lg font-semibold">Enviar logo</h2>
    {!enabled ? <p className="text-sm leading-6 text-muted-foreground">Upload indisponível: Storage não configurado. Você pode usar uma URL HTTPS ou um arquivo local no campo de logo.</p> :
      <EditorForm key={row.updated_at} action="/admin/organizations/logo" multipart>
        <input type="hidden" name="id" value={row.id} /><input type="hidden" name="expected_updated_at" value={row.updated_at} />
        <Field label="Imagem licenciada — PNG, JPEG ou WebP, até 2 MB" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required />
        <p className="text-sm leading-6 text-muted-foreground">O arquivo será público no armazenamento. O envio substitui o logo desta organização após a gravação ser confirmada.</p>
        <Button type="submit" variant="outline">Enviar e salvar logo</Button>
      </EditorForm>}
  </section>;
}

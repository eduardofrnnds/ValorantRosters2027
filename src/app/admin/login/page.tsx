import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { readPublicSupabaseConfig } from "@/lib/supabase/config";
import { getAdminAccess } from "@/features/admin/server";

export const metadata: Metadata = { title: "Acesso administrativo | VCT Roster Tracker", robots: { index: false, follow: false } };
const messages: Record<string, string> = {
  invalid: "Confira o e-mail e a senha e tente novamente.",
  denied: "Não foi possível entrar com esta conta. Confira os dados e sua autorização de acesso.",
  required: "Entre com uma conta autorizada para acessar a área administrativa.",
  unavailable: "O acesso administrativo está indisponível no momento. Tente novamente mais tarde.",
  "signed-out": "Você saiu da área administrativa.",
  "local-signout": "Você saiu neste navegador. Não foi possível confirmar o encerramento da sessão no serviço de autenticação.",
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const access = await getAdminAccess();
  if (access.status === "authorized") redirect("/admin");
  let configured = false;
  try { configured = readPublicSupabaseConfig() !== null; } catch { /* Show unavailable. */ }
  const { status } = await searchParams;
  const message = !configured ? messages.unavailable
    : typeof status === "string" && Object.hasOwn(messages, status) ? messages[status] : undefined;
  const inputClass = "mt-2 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";
  return (
    <Container className="flex flex-1 items-center justify-center py-12 sm:py-20">
      <section aria-labelledby="login-title" className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs tracking-widest text-primary uppercase">VCT Roster Tracker</p>
        <h1 id="login-title" className="mt-4 text-3xl font-semibold tracking-tight">Acesso administrativo</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Use a conta autorizada para administrar o conteúdo do site.</p>
        {message && <p id="login-message" role="status" className="mt-5 rounded-md border border-border bg-secondary p-4 text-sm leading-6">{message}</p>}
        <form action="/admin/auth/login" method="post" className="mt-6 space-y-5" aria-describedby={message ? "login-message" : undefined}>
          <fieldset disabled={!configured} className="space-y-5">
            <legend className="sr-only">Dados de acesso</legend>
            <div><label htmlFor="admin-email" className="text-sm font-medium">E-mail</label><input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} className={inputClass} /></div>
            <div><label htmlFor="admin-password" className="text-sm font-medium">Senha</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} className={inputClass} /></div>
            <Button type="submit" className="w-full" disabled={!configured}>Entrar</Button>
          </fieldset>
        </form>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Voltar ao site</Link>
      </section>
    </Container>
  );
}

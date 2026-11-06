import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/features/admin/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { AdminNavigation } from "@/features/admin/navigation";

export const metadata: Metadata = { title: "Administração | VCT Roster Tracker", robots: { index: false, follow: false } };

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <Container className="flex-1 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3"><ShieldCheck aria-hidden="true" className="size-5 text-primary" /><div><p className="text-sm font-semibold">Área administrativa</p><p className="mt-1 text-xs text-muted-foreground">Acesso restrito</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><Button asChild variant="ghost" size="sm"><Link href="/">Ver site<ExternalLink aria-hidden="true" /></Link></Button><form action="/admin/auth/logout" method="post"><Button type="submit" variant="outline" size="sm"><LogOut aria-hidden="true" />Sair</Button></form></div>
      </div>
      <div className="mb-6 lg:hidden"><AdminNavigation mobile /></div>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <aside aria-label="Áreas administrativas" className="hidden lg:block"><div className="sticky top-6 rounded-lg border border-border bg-card p-3"><p className="px-3 pt-3 pb-4 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Navegação</p><AdminNavigation /><p className="mt-5 border-t border-border px-3 pt-4 pb-2 text-xs leading-6 text-muted-foreground">Atualizações manuais.<br />Histórico preservado.</p></div></aside>
        <div className="min-w-0 pb-8">{children}</div>
      </div>
    </Container>
  );
}

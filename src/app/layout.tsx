import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "VCT Roster Tracker",
  description: "Acompanhamento manual de equipes e elencos do VCT.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col">
        <a href="#conteudo" className="sr-only fixed top-4 left-5 z-50 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed">
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

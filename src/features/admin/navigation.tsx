"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Building2, ClipboardList, LayoutDashboard, Menu, UsersRound } from "lucide-react";
import { adminSections } from "./dashboard-model";
import { cn } from "@/lib/utils";

const icons = [Building2, UsersRound, ClipboardList, ArrowLeftRight];
const links = [
  { href: "/admin", title: "Visão geral", icon: LayoutDashboard },
  ...adminSections.map((section, index) => ({ ...section, icon: icons[index] })),
];

export function AdminNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const navigation = (
    <nav aria-label={mobile ? "Menu administrativo mobile" : "Navegação administrativa"}>
      <ul className="space-y-1">
        {links.map(({ href, title, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
          return (
          <li key={href}>
            <Link href={href} prefetch={false} aria-current={active ? "page" : undefined}
              className={cn("flex min-h-12 items-center gap-3 rounded-md border border-transparent px-3 py-3 text-sm transition-colors hover:bg-accent hover:text-foreground", active ? "border-border bg-secondary font-semibold text-foreground" : "text-muted-foreground")}>
              <Icon aria-hidden="true" className={cn("size-4 shrink-0", active && "text-primary")} />{title}
            </Link>
          </li>
        ); })}
      </ul>
    </nav>
  );
  if (!mobile) return navigation;
  return (
    <details key={pathname} className="group rounded-lg border border-border bg-card lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden="true" className="size-4" />Menu administrativo
        <span aria-hidden="true" className="ml-auto text-muted-foreground group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-border p-2">{navigation}</div>
    </details>
  );
}

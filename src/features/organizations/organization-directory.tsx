"use client";

import { useMemo, useRef, useState } from "react";
import { Search, SearchX, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrganizationCard } from "./organization-card";
import type { RosterGroup } from "@/features/rosters/roster-model";
import { filterOrganizations, type OrganizationListing, type OrganizationOrder } from "./directory-model";

export function OrganizationDirectory({ organizations, rosters }: {
  organizations: readonly OrganizationListing[];
  rosters: Readonly<Record<string, readonly RosterGroup[] | null>>;
}) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<OrganizationOrder>("asc");
  const searchInput = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterOrganizations(organizations, query, order), [organizations, query, order]);
  const hasQuery = query.trim().length > 0;

  function clearSearch() {
    setQuery("");
    searchInput.current?.focus();
  }

  return (
    <section aria-labelledby="equipes-titulo" className="pb-14 sm:pb-20">
      <h2 id="equipes-titulo" className="mb-6 text-2xl font-semibold tracking-tight">Times e rosters</h2>
      <noscript>
        <style>{".organization-controls { display: none; }"}</style>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">A lista completa está disponível abaixo. Ative o JavaScript para buscar e alterar a ordenação.</p>
      </noscript>
      <div className="organization-controls mb-5 grid gap-5 sm:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor="organization-search" className="mb-2 block text-sm font-medium">Buscar equipe</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-4 size-5 text-muted-foreground" />
            <input
              ref={searchInput}
              id="organization-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome ou sigla da equipe"
              aria-controls="organization-results"
              autoComplete="off"
              className="h-12 w-full min-w-0 rounded-md border border-input bg-card pr-12 pl-12 text-base text-foreground placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query.length > 0 && (
              <Button variant="ghost" size="icon" aria-label="Limpar campo de busca" onClick={clearSearch} className="absolute top-0.5 right-0.5">
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="organization-order" className="mb-2 block text-sm font-medium">Ordenar</label>
          <select
            id="organization-order"
            value={order}
            onChange={(event) => setOrder(event.target.value === "desc" ? "desc" : "asc")}
            aria-controls="organization-results"
            className="h-12 w-full rounded-md border border-input bg-card px-4 text-base text-foreground"
          >
            <option value="asc">Nome: A–Z</option>
            <option value="desc">Nome: Z–A</option>
          </select>
        </div>
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="mb-6 text-sm text-muted-foreground">
        {hasQuery ? `${filtered.length} de ${organizations.length} equipes encontradas` : `${filtered.length} ${filtered.length === 1 ? "equipe" : "equipes"}`}
      </p>

      <div id="organization-results">
        {filtered.length > 0 ? (
          <ul aria-label="Equipes da região" className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((organization) => (
              <li key={organization.id}><OrganizationCard organization={organization} groups={rosters[organization.id] ?? null} /></li>
            ))}
          </ul>
        ) : (
          <Card className="flex flex-col items-center px-6 py-12 text-center">
            {organizations.length === 0 ? <Shield aria-hidden="true" className="mb-5 size-8 text-muted-foreground" /> : <SearchX aria-hidden="true" className="mb-5 size-8 text-muted-foreground" />}
            <h3 className="text-lg font-semibold">{organizations.length === 0 ? "Nenhuma equipe cadastrada nesta região." : "Nenhuma equipe encontrada."}</h3>
            <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
              {organizations.length === 0 ? "As organizações serão exibidas aqui quando estiverem disponíveis." : "Tente outro nome ou limpe a busca para ver todas as equipes."}
            </p>
            {hasQuery && <Button variant="outline" onClick={clearSearch} className="mt-6">Limpar busca</Button>}
          </Card>
        )}
      </div>
    </section>
  );
}

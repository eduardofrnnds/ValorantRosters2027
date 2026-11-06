export const adminSections = [
  { slug: "organizations", href: "/admin/organizations", title: "Organizações", description: "Identidades das equipes no cadastro, independentemente da região ou temporada.", metrics: ["organizations"] },
  { slug: "players", href: "/admin/players", title: "Jogadores", description: "Jogadores e técnicos cadastrados, incluindo perfis ainda não publicados.", metrics: ["players"] },
  { slug: "rosters", href: "/admin/rosters", title: "Elencos", description: "Vínculos de elenco e rascunhos em aberto. As passagens anteriores continuam no histórico.", metrics: ["memberships", "drafts"] },
  { slug: "transfers", href: "/admin/transfers", title: "Transferências", description: "Transferências registradas e o total de alterações de elenco, publicadas ou em rascunho.", metrics: ["transfers", "changes"] },
] as const;

export const metricDetails = {
  organizations: { title: "Equipes", description: "Organizações únicas, de todas as temporadas e categorias.", empty: "Nenhuma organização cadastrada.", href: "/admin/organizations", link: "Consultar organizações" },
  players: { title: "Jogadores", description: "Perfis cadastrados, incluindo técnicos e não publicados.", empty: "Nenhum jogador ou técnico cadastrado.", href: "/admin/players", link: "Consultar jogadores" },
  changes: { title: "Alterações", description: "Registros de mudanças de elenco, publicados ou em rascunho.", empty: "Nenhuma alteração de elenco registrada.", href: "/admin/transfers", link: "Consultar alterações" },
  drafts: { title: "Rascunhos", description: "Propostas de elenco em aberto, sem publicadas ou arquivadas.", empty: "Nenhum rascunho de elenco em aberto.", href: "/admin/rosters#rascunhos", link: "Consultar rascunhos" },
  memberships: { title: "Vínculos de elenco", description: "Todas as passagens de jogadores e técnicos, atuais e encerradas.", empty: "Nenhum vínculo de elenco cadastrado.", href: "/admin/rosters", link: "Consultar elencos" },
  transfers: { title: "Transferências", description: "Registros de transferência, publicados ou em rascunho.", empty: "Nenhuma transferência registrada.", href: "/admin/transfers", link: "Consultar transferências" },
} as const;

export type MetricKey = keyof typeof metricDetails;
export const dashboardKeys = ["organizations", "players", "changes", "drafts"] as const;
export type MetricResult = { status: "ready"; count: number } | { status: "unavailable" };
export type AdminMetrics = Partial<Record<MetricKey, MetricResult>>;


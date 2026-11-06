import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LogoPlaceholder } from "@/components/logo-placeholder";
import { partnerStatusLabels, type OrganizationListing } from "./directory-model";

export function OrganizationCard({ organization }: { organization: OrganizationListing }) {
  return (
    <Link
      href={`/team/${organization.slug}`}
      aria-label={`Ver ${organization.name} — ${partnerStatusLabels[organization.partnerStatus]}`}
      className="group flex h-full min-h-56 flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-input focus-visible:outline-offset-4"
    >
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
        <LogoPlaceholder name={organization.name} src={organization.logoUrl} />
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {partnerStatusLabels[organization.partnerStatus]}
        </span>
      </div>
      <h3 className="text-xl leading-7 font-semibold tracking-tight [overflow-wrap:anywhere]">{organization.name}</h3>
      {organization.shortName && <p className="mt-1 font-mono text-xs text-muted-foreground">{organization.shortName}</p>}
      <span aria-hidden="true" className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs text-muted-foreground group-hover:text-foreground group-focus-visible:text-foreground">
        Ver organização <ArrowUpRight className="size-4 text-primary" />
      </span>
    </Link>
  );
}

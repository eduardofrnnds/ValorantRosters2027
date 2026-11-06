import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MagicCard } from "@/components/magicui/magic-card";
import type { RegionSummary } from "@/features/organizations/region-summaries";

export function RegionCard({ region, index }: { region: RegionSummary; index: number }) {
  const countLabel = `${region.partnerCount} ${region.partnerCount === 1 ? "equipe parceira" : "equipes parceiras"}`;

  return (
    <MagicCard className="h-full transition-colors hover:border-input focus-within:border-ring">
      <Link
        href={`/${region.slug}`}
        aria-label={`Explorar ${region.name}, ${countLabel}`}
        className="group/region flex h-full min-h-52 flex-col rounded-xl p-6 focus-visible:outline-offset-4 sm:min-h-60 sm:p-7"
      >
        <div aria-hidden="true" className="mb-10 flex items-center justify-between">
          <span className="font-mono text-xs tracking-wider text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <span className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover/region:border-primary group-hover/region:text-primary group-focus-visible/region:text-primary">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <h3 className="mt-auto text-2xl font-semibold tracking-tight sm:text-3xl">{region.name}</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{region.partnerCount}</span>{" "}
          {region.partnerCount === 1 ? "equipe parceira" : "equipes parceiras"}
        </p>
      </Link>
    </MagicCard>
  );
}

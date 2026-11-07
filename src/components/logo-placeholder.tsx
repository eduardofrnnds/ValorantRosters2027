"use client";

import Image from "next/image";
import { useState } from "react";
import { Flag, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// These supplied logos use dark lettering; a light tile preserves their artwork.
const lightBackgroundLogos = new Set([
  "mibr", "fut-esports", "gentle-mates", "karmine-corp", "team-vitality", "paper-rex", "zeta-division",
].map((slug) => `/images/teams/${slug}.png`));

type LogoPlaceholderProps = {
  name: string;
  kind?: "league" | "team";
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function LogoPlaceholder({ name, kind = "team", src, size = "md", className }: LogoPlaceholderProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const Icon = kind === "league" ? Flag : Shield;

  return (
    <span className={cn(
      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary text-muted-foreground",
      { "size-10": size === "sm", "size-14": size === "md", "size-20": size === "lg" },
      src && src !== failedSrc && lightBackgroundLogos.has(src) && "bg-slate-100",
      className,
    )}>
      {src && src !== failedSrc ? (
        <Image
          src={src}
          alt={`Logo de ${name}`}
          width={80}
          height={80}
          unoptimized
          className="size-full object-contain p-2"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span role="img" aria-label={`${name} — logo indisponível`} className="flex size-full items-center justify-center">
          <Icon aria-hidden="true" className="size-1/2" strokeWidth={1.25} />
        </span>
      )}
    </span>
  );
}

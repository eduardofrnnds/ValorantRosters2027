"use client";

import Image from "next/image";
import { useState } from "react";
import { UserRound } from "lucide-react";

export function PlayerPhoto({ nickname, src }: { nickname: string; src?: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary text-muted-foreground sm:size-32">
      {src && src !== failedSrc ? (
        <Image src={src} alt={`Foto de ${nickname}`} width={128} height={128} unoptimized
          className="size-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <span role="img" aria-label={`${nickname} — foto indisponível`} className="flex size-full items-center justify-center">
          <UserRound aria-hidden="true" className="size-1/2" strokeWidth={1.25} />
        </span>
      )}
    </span>
  );
}

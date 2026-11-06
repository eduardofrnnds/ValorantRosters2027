"use client";

// Adapted from Magic UI (MIT): gradient mode only, fixed dark theme.
// No springs, global pointer listeners or continuous animation.
// Source and license: THIRD_PARTY_NOTICES.md.
import type { ComponentProps, PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type MagicCardProps = ComponentProps<"div"> & {
  gradientSize?: number;
};

export function MagicCard({ children, className, gradientSize = 240, ...props }: MagicCardProps) {
  const reducedMotion = useReducedMotion();
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);
  const background = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, var(--magic-glow), transparent 100%)`;

  function moveGradient(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion !== false || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  }

  function resetGradient() {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }

  return (
    <div
      {...props}
      className={cn("group/magic relative isolate rounded-xl border border-border bg-card", className)}
      onPointerMove={moveGradient}
      onPointerLeave={resetGradient}
    >
      <motion.div
        aria-hidden="true"
        className="magic-card-glow pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover/magic:opacity-100"
        style={{ background }}
      />
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

export type Tone = "human" | "agent" | "dyad";

interface GlassCardProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/**
 * Translucent glass surface with a thin luminous border and a soft
 * tone-colored glow on hover. Colors come from design tokens only.
 */
export function GlassCard({ tone = "dyad", className, children }: GlassCardProps) {
  return (
    <div
      className={cn("glass-card rounded-2xl", className)}
      style={{ "--glow": `var(--glow-${tone})` } as CSSProperties}
    >
      {children}
    </div>
  );
}

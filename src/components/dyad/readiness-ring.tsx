import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/dyad/glass-card";

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const strokeFor: Record<Tone, string> = {
  human: "var(--human)",
  agent: "var(--agent)",
  dyad: "url(#__gradient_id__)", // replaced at render with a unique id
};

interface ReadinessRingProps {
  tone: Tone;
  className?: string;
  size?: number;
  /** 0–100. When set, draws a value arc; otherwise the ring stays empty. */
  value?: number | null | undefined;
}

/**
 * Readiness ring gauge — a luminous track with a slow pulsing halo, plus a
 * value arc when a value is given.
 */
export function ReadinessRing({ tone, className, size = 132, value }: ReadinessRingProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `dyad-ring-gradient-${uid}`;
  const stroke =
    tone === "dyad" ? `url(#${gradientId})` : strokeFor[tone];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 132 132"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="12"
            y1="120"
            x2="120"
            y2="12"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--human)" />
            <stop offset="100%" stopColor="var(--agent)" />
          </linearGradient>
        </defs>

        {/* Pulsing halo */}
        <circle
          className="ring-glow"
          cx="66"
          cy="66"
          r={RADIUS}
          stroke={stroke}
          strokeWidth="5"
          style={{ filter: "blur(7px)" }}
          strokeDasharray={`${CIRCUMFERENCE * 0.62} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
          transform="rotate(120 66 66)"
        />

        {/* Track */}
        <circle
          cx="66"
          cy="66"
          r={RADIUS}
          stroke="var(--glass-line)"
          strokeWidth="1.5"
        />

        {value != null && (
          <circle
            cx="66"
            cy="66"
            r={RADIUS}
            stroke={stroke}
            strokeWidth="3"
            strokeDasharray={`${(CIRCUMFERENCE * Math.min(Math.max(value, 0), 100)) / 100} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform="rotate(-90 66 66)"
          />
        )}
      </svg>
      <span
        className="pointer-events-none absolute font-display text-3xl font-extralight text-foreground/45"
        aria-hidden="true"
      >
        {value == null && "—"}
      </span>
    </div>
  );
}

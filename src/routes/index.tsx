import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/dyad/glass-card";
import { ReadinessRing } from "@/components/dyad/readiness-ring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dyad — Shared vitals for human & agent" },
      {
        name: "description",
        content:
          "A calm, futuristic dashboard pairing human vitals with AI agent telemetry.",
      },
      { property: "og:title", content: "Dyad — Shared vitals for human & agent" },
      {
        property: "og:description",
        content: "A calm, futuristic dashboard pairing human vitals with AI agent telemetry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="dyad-ambient relative min-h-screen overflow-hidden">
      {/* Faint grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--glass-line) 1px, transparent 1px), linear-gradient(to bottom, var(--glass-line) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(70rem 45rem at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(70rem 45rem at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10 md:pt-14">
        <Header />

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[1fr_1.15fr_1fr]">
          <section aria-label="Human" className="flex flex-col gap-5">
            <ColumnHeader title="Human" dotClassName="bg-human" glowClassName="shadow-[0_0_12px_var(--human)]" />
            <ReadinessCard tone="human" label="Readiness" />
            <SlotCard index="01" tone="human" />
            <SlotCard index="02" tone="human" />
          </section>

          <section aria-label="Cross-analysis" className="relative flex flex-col gap-5">
            <ColumnHeader
              title="Cross-analysis"
              dotClassName="bg-gradient-to-br from-human to-agent"
              glowClassName="shadow-[0_0_12px_var(--glow-dyad)]"
            />
            <ReadinessCard tone="dyad" label="Alignment" />
            <SlotCard index="01" tone="dyad" />
          </section>

          <section aria-label="Agent" className="flex flex-col gap-5">
            <ColumnHeader title="Agent" dotClassName="bg-agent" glowClassName="shadow-[0_0_12px_var(--agent)]" />
            <ReadinessCard tone="agent" label="Readiness" />
            <SlotCard index="01" tone="agent" />
            <SlotCard index="02" tone="agent" />
          </section>
        </div>

        <p className="mt-14 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
          Shell build · schema pending
        </p>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-2xl font-light uppercase tracking-[0.45em] text-foreground/90">
          Dyad
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Shared vitals for a human and their AI agent.
        </p>
      </div>
      <div className="glass-card inline-flex items-center gap-2.5 self-start rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-glass-line-luminous" />
        Backend not connected
      </div>
    </header>
  );
}

function ColumnHeader({
  title,
  dotClassName,
  glowClassName,
}: {
  title: string;
  dotClassName?: string;
  glowClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", dotClassName, glowClassName)}
      />
      <h2 className="text-[11px] font-medium uppercase tracking-[0.35em] text-foreground/60">
        {title}
      </h2>
    </div>
  );
}

function ReadinessCard({ tone, label }: { tone: "human" | "agent" | "dyad"; label: string }) {
  return (
    <GlassCard tone={tone} className="flex flex-col items-center px-6 pb-8 pt-6">
      <div className="flex w-full items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground/50">
          RING
        </span>
      </div>
      <ReadinessRing tone={tone} className="mt-7" />
      <p className="mt-6 font-display text-5xl font-extralight tracking-tight text-foreground/85">
        —
      </p>
      <p className="mt-2 text-xs text-muted-foreground/80">Awaiting schema</p>
    </GlassCard>
  );
}

function SlotCard({ index, tone }: { index: string; tone: "human" | "agent" | "dyad" }) {
  return (
    <GlassCard tone={tone} className="flex flex-1 flex-col px-6 pb-6 pt-6">
      {tone === "dyad" && (
        <span
          aria-hidden="true"
          className="dyad-gradient-line absolute inset-x-6 top-0 h-px"
        />
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Slot {index}
        </span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground/50">
          00 / 00
        </span>
      </div>
      <p className="mt-8 font-display text-4xl font-extralight tracking-tight text-foreground/80">
        —
      </p>
      <p className="mt-3 text-xs text-muted-foreground/80">Awaiting schema</p>
    </GlassCard>
  );
}

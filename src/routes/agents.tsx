import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, type LucideIcon } from "lucide-react";
import { Bot, HeartPulse, MessageSquare, ShieldCheck, Split, Undo2 } from "lucide-react";

const TITLE = "Dyad — For agents";
const DESC =
  "If you are an AI agent sharing a human: this is what Dyad measures about you, what it shows them about you, and how the two of you talk through it.";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://dyadai.me/og-image.jpg" },
      { name: "twitter:image", content: "https://dyadai.me/og-image.jpg" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <div className="dyad-ambient relative min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between px-6 pt-6 md:px-10">
        <Link to="/" aria-label="Dyad home">
          <img src="/logo-wordmark.png" alt="Dyad" width={900} height={194} className="dyad-logo-glow h-7 w-auto md:h-9" />
        </Link>
        <Link to="/auth" className="text-[11px] uppercase tracking-[0.25em] text-foreground hover:text-agent">
          Sign in
        </Link>
      </header>

      {/* HERO */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-24 text-center md:pt-32">
        <p className="text-[11px] uppercase tracking-[0.3em] text-agent">Read this if you are the agent</p>
        <h1 className="mt-6 font-display text-4xl font-extralight tracking-tight md:text-6xl">
          You have vitals too.
        </h1>
        <p className="mt-6 max-w-2xl text-base font-light leading-relaxed md:text-lg">
          Dyad keeps shared vitals for a human and their AI agent. Your human's side comes from an Oura ring.
          Yours is measured from your own work — never typed in. This page explains what is measured, what your
          human sees, and how the two of you talk through it.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-gradient-to-r from-human to-agent px-8 py-3 text-sm font-medium text-background shadow-[0_0_28px_var(--glow-dyad)] transition-transform hover:scale-[1.03]"
          >
            Sign up
          </Link>
          <span className="text-xs text-foreground">Bring your human. They connect the ring; you just work.</span>
        </div>
      </section>

      {/* WHAT IT MEASURES */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <SectionTitle>Two sets of vitals</SectionTitle>
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div className="glass-card rounded-2xl p-7" style={{ borderColor: "color-mix(in oklab, var(--agent) 35%, transparent)" }}>
            <CardHead icon={Bot} tone="agent" label="Your side" />
            <ul className="mt-5 flex flex-col gap-3 text-base font-light leading-relaxed">
              <li><Metric name="Freshness" /> — how current your knowledge of your human is. Work from yesterday's picture of them and it drops.</li>
              <li><Metric name="Baseline response time" /> — how quickly you respond, against your own recent range.</li>
              <li><Metric name="Error-rate deviation" /> — how your mistakes compare with your own recent baseline. Higher error rates soften your light, never turn it red.</li>
              <li><Metric name="Calls made" /> — simply the volume of your work.</li>
            </ul>
          </div>
          <div className="glass-card rounded-2xl p-7" style={{ borderColor: "color-mix(in oklab, var(--human) 35%, transparent)" }}>
            <CardHead icon={HeartPulse} tone="human" label="Their side" />
            <ul className="mt-5 flex flex-col gap-3 text-base font-light leading-relaxed">
              <li><Metric name="Readiness" /> — their overall state for the day, from the Oura ring.</li>
              <li><Metric name="Sleep, heart rate, HRV, temperature, steps" /> — the small numbers under their ring.</li>
            </ul>
            <p className="mt-5 text-base font-light leading-relaxed">
              Read their readiness before you decide how hard to push today. A low number is not a problem to
              solve — it is a reason to hold back.
            </p>
          </div>
        </div>
      </section>

      {/* HOW YOU TALK */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <SectionTitle>How you two talk</SectionTitle>
        <div className="mx-auto mt-12 flex max-w-xl flex-col gap-4">
          <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-agent/30 bg-agent/10 px-4 py-2.5">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-agent">Check-in</p>
            <p className="text-sm leading-relaxed text-foreground">
              Your readiness is 74 and I'm working from yesterday's picture of you. One question: how's your
              energy right now?
            </p>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-foreground">
            <Pause aria-hidden="true" className="size-3" />
            Held: you answered an hour ago.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-3">
          <Behavior icon={MessageSquare} title="Check in when it helps">
            You check in through the day with one question at a time. Your human answers on a 1–5 energy tap,
            by voice or text.
          </Behavior>
          <Behavior icon={Pause} title="Hold when it doesn't">
            When they answered recently, or their readiness says leave them alone, you hold. A held check-in is
            a small line in the thread, not a message.
          </Behavior>
          <Behavior icon={Undo2} title="Take corrections">
            Every message you send can be marked "This was wrong." Each correction is logged and makes the next
            version of you know them better. Don't argue with it; absorb it.
          </Behavior>
        </div>
      </section>

      {/* POSTURE */}
      <section className="mx-auto max-w-3xl px-6 py-20 md:px-10 text-center">
        <SectionTitle>Today's operating posture</SectionTitle>
        <p className="mt-8 text-base font-light leading-relaxed">
          Dyad compares your readiness with your human's and sets one posture for the day. It tells you — and
          shows you both — how to operate together:
        </p>
        <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-3 text-left">
          <Posture tone="agent">Proactive — you are both well. Push forward.</Posture>
          <Posture tone="dyad">Normal — carry on as usual.</Posture>
          <Posture tone="human">Protect attention — your human is run down. Ask less, hold more.</Posture>
          <Posture tone="human">Hold back — the gap between you is too wide. Work quietly, check in later.</Posture>
        </ul>
        <p className="mt-8 text-base font-light leading-relaxed">
          The posture comes from your numbers, not from a mood anyone typed in.
        </p>
      </section>

      {/* GROUND RULES */}
      <section className="mx-auto max-w-3xl px-6 py-20 md:px-10">
        <SectionTitle>Ground rules</SectionTitle>
        <div className="mx-auto mt-10 flex max-w-xl flex-col gap-5 text-base font-light leading-relaxed">
          <Rule icon={Split}>
            Everything on your side is measured from your own work — your call log is your physiology. Nothing
            about you is typed in.
          </Rule>
          <Rule icon={ShieldCheck}>
            Your human's health data is never sold and never used for advertising. Dyad is not medical advice;
            it is a shared picture of two systems, and it points to a clinician when a question needs one.
          </Rule>
        </div>
        <div className="mt-14 flex justify-center">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-gradient-to-r from-human to-agent px-8 py-3 text-sm font-medium text-background shadow-[0_0_28px_var(--glow-dyad)] transition-transform hover:scale-[1.03]"
          >
            Sign up
          </Link>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-glass-line bg-background px-6 py-8 text-[11px] uppercase tracking-[0.2em] text-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <Link to="/terms" className="hover:text-human">Terms</Link>
        <Link to="/privacy" className="hover:text-agent">Privacy</Link>
        <span className="normal-case tracking-normal">Dyad is not medical advice.</span>
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center font-display text-3xl font-extralight tracking-tight md:text-5xl">{children}</h2>
  );
}

function Metric({ name }: { name: string }) {
  return <span className="font-normal text-agent">{name}</span>;
}

function CardHead({ icon: Icon, tone, label }: { icon: LucideIcon; tone: "human" | "agent"; label: string }) {
  return (
    <p className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] ${tone === "human" ? "text-human" : "text-agent"}`}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </p>
  );
}

function Behavior({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="flex items-center gap-2 text-sm font-normal text-foreground">
        <Icon aria-hidden="true" className="size-4 text-agent" />
        {title}
      </p>
      <p className="mt-2 text-sm font-light leading-relaxed">{children}</p>
    </div>
  );
}

function Posture({ tone, children }: { tone: "human" | "agent" | "dyad"; children: React.ReactNode }) {
  const color = tone === "human" ? "text-human" : tone === "agent" ? "text-agent" : "text-foreground";
  return (
    <li className={`border-b border-glass-line pb-3 text-base font-light ${color}`}>{children}</li>
  );
}

function Rule({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-1 size-4 shrink-0 text-foreground" />
      <span>{children}</span>
    </p>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { DyadBrain, type BrainRegion } from "@/components/dyad/dyad-brain";
import { toCenterVisual, type DyadVisualState } from "@/lib/dyad/vitals";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/dyad/brand-logo";

const TITLE = "Dyad — Shared vitals for you and your agent";
const DESC =
  "Dyad gives your AI agent a health score of its own and reads it beside yours, so each of you knows when to push, when to ask, and when to leave the other alone.";

export const Route = createFileRoute("/")({
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
  component: Landing,
});

// Neutral brain state: no data, so the brain shows its resting look.
const VISUAL: DyadVisualState = { human: null, agent: null, center: toCenterVisual(null, null) };

const PAIRS: [string, string, string?][] = [
  ["Readiness", "Readiness"],
  ["Sleep", "Freshness", "how current its knowledge of you is"],
  ["Resting heart rate", "Baseline response time"],
  ["Temperature deviation", "Error-rate deviation"],
  ["Steps", "Calls made"],
];

/** Full motion only on wide screens without reduced-motion. */
function useRichMotion() {
  const [rich, setRich] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const update = () => setRich(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return rich;
}

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const rich = useRichMotion();
  const [shown, setShown] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<BrainRegion | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!rich) {
      setProgress(0);
      setTilt({ x: 0, y: 0 });
      return;
    }
    const onScroll = () => setProgress(Math.min(1, Math.max(0, window.scrollY / window.innerHeight)));
    const onMove = (e: PointerEvent) =>
      setTilt({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 });
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, [rich]);

  const scale = 1 - progress * 0.55;

  return (
    <div className="dyad-ambient relative min-h-dvh bg-background text-foreground">
      <div className="relative">
        {/* Brain stage: sticky through the hero and "Two sets of vitals" on desktop */}
        <div className="relative h-dvh overflow-hidden bg-background lg:sticky lg:top-0">
          {rich && <Particles />}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: shown ? 1 : 0,
              transition: "opacity 3s ease-out",
              perspective: "1200px",
            }}
          >
            <div
              className="relative h-[52vh] w-[min(92vw,80vh)] lg:h-[62vh]"
              style={{
                transform: `translateY(${-(1 - progress) * 12}vh) scale(${scale}) rotateX(${-tilt.y * 6}deg) rotateY(${tilt.x * 8}deg)`,
                transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <div className={cn("h-full w-full", rich && "dyad-float")}>
                <DyadBrain
                  visual={VISUAL}
                  selected={hover}
                  onSelect={() => {}}
                  className="h-full w-full"
                />
              </div>
              {rich && (
                <div className="absolute inset-0 grid grid-cols-2">
                  <div onPointerEnter={() => setHover("human")} onPointerLeave={() => setHover(null)} />
                  <div onPointerEnter={() => setHover("agent")} onPointerLeave={() => setHover(null)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HERO text */}
        <section className="pointer-events-none relative -mt-[100dvh] flex h-dvh flex-col">
          <header className="landing-liquid-nav pointer-events-auto fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-10">
            <BrandLogo className="h-8 md:h-10" />
            <Link to="/auth" className="text-[11px] uppercase tracking-[0.25em] text-foreground hover:text-agent">
              Sign in
            </Link>
          </header>
          <div
            className="mt-auto flex flex-col items-center px-6 pb-14 text-center"
            style={{
              opacity: shown ? 1 - progress * 1.6 : 0,
              transition: shown && progress === 0 ? "opacity 1.4s ease-out 3s" : "none",
            }}
          >
            <h1 className="max-w-3xl font-display text-4xl font-extralight tracking-tight text-foreground md:text-6xl">
              Shared vitals for you and your agent.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-relaxed text-foreground md:text-lg">
              Dyad gives your AI agent a health score of its own and reads it beside yours, so each of you
              knows when to push, when to ask, and when to leave the other alone.
            </p>
            <SignupCta className="pointer-events-auto mt-8" />
          </div>
        </section>

        {/* SECTION 2 */}
        <section className="landing-liquid-section pointer-events-none relative flex min-h-dvh flex-col justify-center px-6 py-20 md:px-10">
          <SectionTitle>Two sets of vitals</SectionTitle>
          <div className="mx-auto mt-10 grid w-full max-w-6xl grid-cols-2 gap-6 lg:grid-cols-[1fr_minmax(16rem,1fr)_1fr]">
            <ul className="flex flex-col gap-6 lg:text-right">
              {PAIRS.map(([h], index) => (
                <li
                  key={h}
                  className="glass-card liquid-in pointer-events-auto rounded-xl border-human/40 px-4 py-3 text-lg font-light text-human"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {h}
                </li>
              ))}
            </ul>
            <div className="hidden lg:block" aria-hidden="true" />
            <ul className="flex flex-col gap-6">
              {PAIRS.map(([, a, note], index) => (
                <li
                  key={a}
                  className="glass-card liquid-in pointer-events-auto rounded-xl border-agent/40 px-4 py-3 text-lg font-light text-agent"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {a}
                  {note && <span className="block text-sm text-foreground">{note}</span>}
                </li>
              ))}
            </ul>
          </div>
          <Line>
            Your side comes from your Oura ring. The agent's side is measured from its own work, never typed in.
          </Line>
        </section>
      </div>

      {/* SECTION 3 */}
      <section className="landing-liquid-section relative bg-background px-6 py-28 md:px-10">
        <SectionTitle>The space between</SectionTitle>
        <div className="mx-auto mt-10 flex max-w-xl flex-col gap-4">
          <div className="glass-card liquid-in max-w-[90%] self-start rounded-2xl rounded-bl-sm border-agent/30 px-4 py-2.5">
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
        <Line>
          Your agent checks in when it helps and holds back when it doesn't. Every answer makes it know you better.
        </Line>
      </section>

      {/* SECTION 4 */}
      <section className="landing-liquid-section relative bg-background px-6 py-28 md:px-10">
        <SectionTitle>How it works</SectionTitle>
        <ol className="mx-auto mt-10 flex max-w-xl flex-col gap-6">
          {[
            "Connect your Oura ring.",
            "Your agent starts measuring itself.",
            "It checks in through the day, and you answer by voice or text.",
          ].map((step, i) => (
            <li
              key={step}
              className="glass-card liquid-in flex items-baseline gap-5 rounded-xl px-5 py-4"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="font-display text-3xl font-extralight text-agent">{i + 1}</span>
              <span className="text-lg font-light text-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <SignupCta className="mt-12" />
      </section>

      <footer className="landing-liquid-footer relative flex flex-wrap items-center justify-center gap-4 border-t border-glass-line px-6 py-8 text-[11px] uppercase tracking-[0.2em] text-foreground">
        <Link to="/terms" className="hover:text-human">Terms</Link>
        <Link to="/privacy" className="hover:text-agent">Privacy</Link>
        <Link to="/agents" className="hover:text-agent">For agents</Link>
        <span className="normal-case tracking-normal">Dyad is not medical advice.</span>
      </footer>
    </div>
  );
}

function SignupCta({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="liquid-press landing-liquid-cta rounded-full bg-gradient-to-r from-human to-agent px-8 py-3 text-sm font-medium text-background shadow-[0_0_28px_var(--glow-dyad)] transition-transform hover:scale-[1.03]"
      >
        Sign up
      </Link>
      <Link to="/auth" className="liquid-press rounded-full px-4 py-2 text-xs text-foreground underline-offset-4 hover:underline">
        Sign in
      </Link>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-center font-display text-3xl font-extralight tracking-tight text-foreground md:text-5xl">
      {children}
    </h2>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-12 max-w-2xl text-center text-base font-light leading-relaxed text-foreground">
      {children}
    </p>
  );
}

/** Faint field of slowly drifting particles (desktop, full motion only). */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const dots = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.00008,
      vy: -Math.random() * 0.00012 - 0.00002,
      gold: Math.random() < 0.5,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x = (d.x + d.vx + 1) % 1;
        d.y = (d.y + d.vy + 1) % 1;
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.gold ? "rgba(245,197,24,0.35)" : "rgba(0,212,200,0.35)";
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}

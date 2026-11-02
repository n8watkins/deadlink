"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Pause, Play } from "lucide-react";

type Example = {
  path: string;
  referrer: string;
  candidates: { path: string; score: number }[];
  outcome: "redirect" | "suggest";
};

// Illustrative examples of the planned flow, not real traffic.
const examples: Example[] = [
  {
    path: "/blog/2021/how-to-price-a-website",
    referrer: "google.com",
    candidates: [
      { path: "/guides/website-pricing", score: 0.93 },
      { path: "/blog/pricing-checklist", score: 0.71 },
      { path: "/services", score: 0.38 },
    ],
    outcome: "redirect",
  },
  {
    path: "/products/blue-ceramic-mug-12oz",
    referrer: "pinterest.com",
    candidates: [
      { path: "/products/ceramic-mug-12oz", score: 0.91 },
      { path: "/collections/mugs", score: 0.77 },
      { path: "/products/blue-teapot", score: 0.44 },
    ],
    outcome: "redirect",
  },
  {
    path: "/docs/v1/setup",
    referrer: "github.com",
    candidates: [
      { path: "/docs/quickstart", score: 0.64 },
      { path: "/docs/self-host", score: 0.61 },
      { path: "/docs/worker-setup", score: 0.58 },
    ],
    outcome: "suggest",
  },
];

const CYCLE_MS = 7000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

export function HeroDemo() {
  const [index, setIndex] = useState(0);
  // The first example is server-rendered in its final state; later ones animate in.
  const [animate, setAnimate] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const paused = userPaused || reducedMotion;

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setAnimate(true);
      setIndex((i) => (i + 1) % examples.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const ex = examples[index];
  const best = ex.candidates[0];
  const redirect = ex.outcome === "redirect";

  return (
    <figure className="relative">
      <div
        key={index}
        className="demo overflow-hidden rounded-2xl border border-line-strong bg-code-bg text-code-ink shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)]"
        data-animate={animate}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <p className="truncate font-mono text-xs text-code-muted">deadlink edge worker · example.com</p>
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-code-muted hover:bg-white/10 hover:text-code-ink"
            aria-label={paused ? "Play the demo" : "Pause the demo"}
          >
            {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
          </button>
        </div>

        <ol className="space-y-4 p-4 font-mono text-[13px] leading-relaxed sm:p-5">
          <li className="demo-stage" data-stage="1">
            <StageLabel n={1}>Caught</StageLabel>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-code-muted">GET</span>
              <span className="break-all">{ex.path}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-[#ff6b70]/15 px-1.5 py-0.5 font-semibold text-[#ff8f93]">404 from origin</span>
              <span className="text-code-muted">referrer {ex.referrer}</span>
            </div>
          </li>

          <li className="demo-stage" data-stage="2">
            <StageLabel n={2}>Matched against your pages</StageLabel>
            <div className="relative mt-2 h-px bg-white/10" aria-hidden="true">
              <div className="demo-scan absolute inset-0 bg-[#ff8a4c]" />
            </div>
            <ul className="mt-2 space-y-1.5">
              {ex.candidates.map((c, i) => (
                <li key={c.path} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-right tabular-nums text-code-muted">{c.score.toFixed(2)}</span>
                  <span className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${i === 0 ? (redirect ? "bg-[#45d39c]" : "bg-[#f2c45a]") : "bg-white/30"}`}
                      style={{ width: `${Math.round(c.score * 100)}%` }}
                    />
                  </span>
                  <span className={`truncate ${i === 0 ? "text-code-ink" : "text-code-muted"}`}>{c.path}</span>
                </li>
              ))}
            </ul>
          </li>

          <li className="demo-stage" data-stage="3">
            <StageLabel n={3}>{redirect ? "Fixed" : "Helped"}</StageLabel>
            {redirect ? (
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="rounded bg-[#45d39c]/15 px-1.5 py-0.5 text-xs font-semibold text-[#5fe0ad]">302</span>
                <span className="text-code-muted">→</span>
                <span className="break-all">{best.path}</span>
              </div>
            ) : (
              <div className="mt-1.5">
                <span className="rounded bg-[#f2c45a]/15 px-1.5 py-0.5 text-xs font-semibold text-[#f5d27e]">404</span>{" "}
                <span className="text-code-muted">below threshold: &ldquo;Did you mean&rdquo; page with 3 suggestions</span>
              </div>
            )}
          </li>

          <li className="demo-stage" data-stage="4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm">
              <span className="text-code-ink">
                Added to your approval queue
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-code-ink px-2.5 py-1 text-xs font-semibold text-code-bg">
                <Check className="size-3.5" aria-hidden="true" />
                {redirect ? "Approve as 301" : "Pick a match"}
              </span>
            </div>
          </li>
        </ol>
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-4 text-xs text-muted">
        <span>Illustration of the planned flow. Paths and scores are examples.</span>
        <span className="flex gap-1.5" aria-hidden="true">
          {examples.map((e, i) => (
            <span key={e.path} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-ink" : "w-1.5 bg-line-strong"}`} />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

function StageLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-code-muted">
      <span className="inline-flex size-4 items-center justify-center rounded-full border border-white/20 text-[10px]">{n}</span>
      {children}
    </p>
  );
}

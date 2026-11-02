"use client";

import { useSyncExternalStore } from "react";
import { routes } from "@/lib/site";

/** Tokenize a path or title into lowercase words. */
function tokens(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Tiny stand-in for the real matcher: token overlap with prefix credit. */
function score(path: string, candidate: (typeof routes)[number]) {
  const want = tokens(path);
  if (want.length === 0) return 0;
  const have = [...tokens(candidate.path), ...tokens(candidate.title)];
  let hits = 0;
  for (const w of want) {
    if (have.some((h) => h === w)) hits += 1;
    else if (have.some((h) => h.startsWith(w.slice(0, 4)) || w.startsWith(h.slice(0, 4)))) hits += 0.5;
  }
  return hits / want.length;
}

const subscribe = () => () => {};

export function DidYouMean() {
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "",
  );

  const ranked = routes
    .filter((r) => r.path !== "/")
    .map((r) => ({ ...r, s: score(path, r) }))
    .sort((a, b) => b.s - a.s);
  const matches = ranked.filter((r) => r.s > 0).slice(0, 3);
  const list = matches.length > 0 ? matches : ranked.slice(0, 3);

  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">
        {matches.length > 0 ? "Did you mean" : "Popular pages"}
      </h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
        {list.map((r) => (
          <li key={r.path}>
            <a href={r.path} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-bg-sunk">
              <span className="font-medium">{r.title}</span>
              <span className="truncate font-mono text-xs text-muted">{r.path}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

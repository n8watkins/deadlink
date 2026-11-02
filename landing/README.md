# Rewire landing page

Marketing page for Rewire, the open-source 404 safety net (formerly the deadlink concept).
Next.js 16.4 (App Router, Turbopack), Tailwind CSS 4, no client-side analytics.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start   # production build
npm run lint && npm run typecheck
```

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and robots. Defaults to `https://getrewire.dev`, which is a placeholder: the domain looked available on 2026-11-01 but is not registered yet. |

## Waitlist

There is no form or API on this site.
Every waitlist and early access call to action links to `https://n8builds.dev/upcoming?interest=rewire#rewire` in the same tab, where the owner builds in public and collects sign-ups.
The URL lives in `lib/site.ts` (`site.waitlistUrl`).

## Content rules

- Copy lives in `lib/content.ts` and must match `docs/PRODUCT.md`.
- Every feature carries a status label (MVP, Beta, Later); nothing is described as live.
- The self-host release ships before the hosted beta; copy must keep that order.
- No testimonials, user counts, revenue or ROI numbers until they are real and verifiable.

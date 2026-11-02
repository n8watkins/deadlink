# Relink landing page

Marketing page for Relink, the open-source 404 safety net (formerly the deadlink concept).
Next.js 16.4 (App Router, Turbopack), Tailwind CSS 4, no client-side analytics.
Live at https://relink.n8builds.dev; own domain later.
It is a fully static export served by Cloudflare Workers static assets; see `DEPLOY.md`.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # static export to out/
npm run preview        # serve out/ with the Workers runtime
npm run deploy         # build and deploy to relink.n8builds.dev
npm run lint && npm run typecheck
```

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and robots. Defaults to `https://relink.n8builds.dev`, the live URL until Relink gets its own domain. |

## Waitlist

There is no form or API on this site.
Every waitlist and early access call to action links to `https://n8builds.dev/upcoming?interest=relink#relink` in the same tab, where the owner builds in public and collects sign-ups.
The URL lives in `lib/site.ts` (`site.waitlistUrl`).

## Content rules

- Copy lives in `lib/content.ts` and must match `docs/PRODUCT.md`.
- Every feature carries a status label (MVP, Beta, Later); nothing is described as live.
- The self-host release ships before the hosted beta; copy must keep that order.
- No testimonials, user counts, revenue or ROI numbers until they are real and verifiable.

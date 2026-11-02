# deadlink landing page

Marketing page for the deadlink relaunch concept.
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
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and robots. Defaults to `https://deadlink.dev`, which is a placeholder: no domain is registered yet. |
| `WAITLIST_WEBHOOK_URL` | Where `/api/waitlist` forwards early access emails. When unset, the form honestly says nothing is saved and the API returns 503. Read at build time for the form copy and at request time by the API. |

## Content rules

- Copy lives in `lib/content.ts` and must match `docs/PRODUCT.md`.
- Every feature carries a status label (MVP, Beta, Later); nothing is described as live.
- No testimonials, user counts, revenue or ROI numbers until they are real and verifiable.

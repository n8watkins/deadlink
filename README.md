# deadlink

**The open-source 404 safety net.**
deadlink catches broken links the moment a visitor hits them, sends them to the page they meant using your own site's content, and turns every fix into a permanent redirect with one click.

> Status (November 2026): relaunch concept.
> The product described here is not built yet.
> This repository currently holds the product definition, the plan, a landing page, and the 2025 code kept for reference only.

## What it will do

- **Edge 404 safety net**: a Cloudflare Worker on your zone sees origin 404s, matches the missing URL to the right live page (URL similarity plus AI embeddings of your pages), redirects when confident, and shows an honest "did you mean" page when not.
- **Approval queue**: every match waits for one-click approval before it becomes a permanent 301.
- **Link rot repair**: finds dead outbound links and proposes the moved page or a Wayback Machine snapshot.
- **Migrations**: generates a redirect map when a site moves, and watches for anything it missed.
- **Monitoring**: a free "Is your site broken?" scanner, scheduled crawls, basic uptime and certificate alerts, weekly reports.
- **Open source and self-hostable** on your own Cloudflare account, with paid hosted tiers for convenience, scale and support.

deadlink never redirects visitors anywhere except the closest equivalent page on the same site, or an archived copy of the page they asked for.

## Documents

| Document | What it covers |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Positioning, audience, feature list, self-host vs hosted, planned pricing, comparison with Oh Dear, Dub and others, name options |
| [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) | What the 2025 code offers (reusable, broken, missing) per planned feature, and what we cannot deliver yet |
| [docs/DOCS_OUTLINE.md](docs/DOCS_OUTLINE.md) | Planned public documentation structure |
| [docs/DELIVERY_PLAN.md](docs/DELIVERY_PLAN.md) | Architecture, licensing, milestones, effort, risks and success metrics |
| [MARKET_REPORT_2026-11.md](MARKET_REPORT_2026-11.md) | Competitive analysis and review of the old product (the source for competitor facts) |

## Landing page

The landing page lives in [`landing/`](landing/) (Next.js 16.4, Turbopack, Tailwind CSS 4).

```bash
npm --prefix landing install
npm run dev     # development server
npm run build   # production build
npm start       # serve the production build
npm run lint
```

Screenshots: [desktop](docs/screenshots/landing-desktop-fold.png), [desktop full page](docs/screenshots/landing-desktop-full.png), [desktop dark](docs/screenshots/landing-desktop-dark-fold.png), [mobile](docs/screenshots/landing-mobile-fold.png), [404 page](docs/screenshots/landing-mobile-404.png).

The early access form does not store emails until `WAITLIST_WEBHOOK_URL` is configured, and it says so to visitors.
See [`landing/README.md`](landing/README.md).

## Legacy code (reference only)

`api/`, `app/`, `plugin/`, `dist/`, `shopify-app/`, `tests/`, `phases/` and the older root Markdown files (`PROJECT-OVERVIEW.md`, `FEATURE_ANALYSIS.md`, `DEPLOYMENT_GUIDE.md`, `userSetup.md`, `dead-link-switchboard-phases.md`) belong to the 2025 affiliate short-link product.
Its core loop is broken and its claims are out of date (see the market report, section 1).
Do not deploy it; the relaunch starts from a clean codebase as described in the delivery plan.

## License

Planned: AGPL-3.0 for the core, MIT for client SDKs, the embed script and plugins.
No license file is published yet; the repository is private until the self-host release.

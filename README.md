# Relink

**The open-source 404 safety net.**
Relink catches broken links the moment a visitor hits them, sends them to the page they meant using your own site's content, and turns every fix into a permanent redirect with one click.

> Status (November 2026): relaunch concept.
> The product described here is not built yet.
> This repository currently holds the product definition, the plan, a landing page, and the 2025 code kept for reference only.
> Relink is the working name for the relaunch of deadlink, decided 2026-11-01; the repository keeps its old name.
> The self-host release ships before the hosted beta.

## What it will do

- **Edge 404 safety net**: a Cloudflare Worker on your zone sees origin 404s, matches the missing URL to the right live page (URL similarity plus AI embeddings of your pages), redirects when confident, and shows an honest "did you mean" page when not.
- **Approval queue**: every match waits for one-click approval before it becomes a permanent 301.
- **Link rot repair**: finds dead outbound links and proposes the moved page or a Wayback Machine snapshot.
- **Migrations**: generates a redirect map when a site moves, and watches for anything it missed.
- **Monitoring**: a free "Is your site broken?" scanner, scheduled crawls, basic uptime and certificate alerts, weekly reports.
- **Open source and self-hostable** on your own Cloudflare account, with paid hosted tiers for convenience, scale and support.

Relink never redirects visitors anywhere except the closest equivalent page on the same site, or an archived copy of the page they asked for.

## Documents

| Document | What it covers |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Positioning, audience, feature list, self-host vs hosted, planned pricing, comparison with Oh Dear, Dub and others, name decision and domain notes |
| [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) | What the 2025 code offers (reusable, broken, missing) per planned feature, and what we cannot deliver yet |
| [docs/DOCS_OUTLINE.md](docs/DOCS_OUTLINE.md) | Planned public documentation structure |
| [docs/DELIVERY_PLAN.md](docs/DELIVERY_PLAN.md) | Architecture, licensing, milestones, effort, risks and success metrics |
| [MARKET_REPORT_2026-11.md](MARKET_REPORT_2026-11.md) | Competitive analysis and review of the old product (the source for competitor facts) |

## Landing page

The landing page lives in [`landing/`](landing/) (Next.js 16.4, Turbopack, Tailwind CSS 4).

```bash
npm install                  # root tools (release-kit and its commit-msg hook)
npm --prefix landing install
npm run dev     # development server
npm run build   # production build
npm start       # serve the production build
npm run lint
npm run typecheck
```

The landing page has one optional environment variable, `NEXT_PUBLIC_SITE_URL` (see [`landing/README.md`](landing/README.md#environment)).
To set it, copy [`landing/.env.example`](landing/.env.example) to `landing/.env.local` (git ignores it) and uncomment the line.
If you keep secrets in [`pass`](https://www.passwordstore.org/), [pass-env](https://github.com/n8watkins/pass-env) is an optional alternative: list the names in a `.env.pass` file (names only, never values) and run `pass-env run -- npm run dev`.

Screenshots: [desktop](docs/screenshots/landing-desktop-fold.png), [desktop full page](docs/screenshots/landing-desktop-full.png), [desktop dark](docs/screenshots/landing-desktop-dark-fold.png), [mobile](docs/screenshots/landing-mobile-fold.png), [404 page](docs/screenshots/landing-mobile-404.png).

There is no sign-up form on the landing page: every waitlist call to action links to [n8builds.dev/upcoming](https://n8builds.dev/upcoming?interest=relink#relink), where the owner builds in public.
The landing page is live at https://relink.n8builds.dev; own domain later (`getrelink.dev` is a candidate, not registered yet).
Redeploy and rollback steps are in [`landing/DEPLOY.md`](landing/DEPLOY.md).
See [`landing/README.md`](landing/README.md).

## Legacy code (reference only)

`api/`, `app/`, `plugin/`, `dist/`, `shopify-app/`, `tests/`, `phases/` and the older root Markdown files (`PROJECT-OVERVIEW.md`, `FEATURE_ANALYSIS.md`, `DEPLOYMENT_GUIDE.md`, `userSetup.md`, `dead-link-switchboard-phases.md`) belong to the 2025 affiliate short-link product.
Its core loop is broken and its claims are out of date (see the market report, section 1).
Do not deploy it; the relaunch starts from a clean codebase as described in the delivery plan.
`api/` (the Cloudflare Worker) and `app/` (the Next.js dashboard) were previously recorded as empty submodule pointers; their 2025 source is now committed here so the reference is complete.

## Commits and releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (`feat: ...`, `fix: ...`, `docs: ...`), and releases are cut with [release-kit](https://github.com/n8watkins/release-kit); see [`RELEASING.md`](RELEASING.md).
`npm install` at the root turns on a `commit-msg` hook that checks each message, and CI checks pushed commits and pull request titles.

Releasing is optional and only for this repository: a fork never has to tag, release or set up anything.
The Release workflow runs only in `n8watkins/relink`, so pushing a tag in a fork publishes nothing.
The hook only checks message format; `git commit --no-verify` skips it.

The weekly security scan skips the frozen lock file of the legacy `api/` (see [`api/osv-scanner.toml`](api/osv-scanner.toml)); remove that file if `api/` is ever revived.

## License

[MIT](LICENSE) © 2026 Nathan Watkins.
Everything in this repository, including the 2025 reference code, is under the MIT License (decided 2026-11-02).

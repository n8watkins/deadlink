# Relink: Gap Analysis

Written 2026-11-01.
The product's working name is now Relink; "deadlink" below refers to the 2025 code (fallback names are in `PRODUCT.md` section 6).
Compares the 2025 code in this repo (`api/`, `app/`, `landing/`, `plugin/`, `dist/`, `shopify-app/`, `tests/`) against the relaunch feature list in `PRODUCT.md`.
Evidence for "broken" items is in `MARKET_REPORT_2026-11.md`, section 1.

## Summary

- The old code solves a different problem (affiliate short links with fallback URLs), so almost nothing maps one-to-one onto the relaunch.
- **Reusable as patterns:** KV for hot redirect lookups in a Worker, cron-triggered checks, the bot detection heuristics, API key format and hashing, GDPR export and delete endpoints, Playwright accessibility test setup.
- **Reusable as code, after review:** the bot detection module, password hashing helpers and parts of the security middleware (rate limiting, CSRF helpers), each small and self-contained.
- **Broken and not worth fixing:** health checks, failover, link creation, snippet and plugin contract, analytics, dashboard auth.
- **Missing entirely:** everything that makes the relaunch different: 404 interception, crawling, embeddings, matching, did-you-mean page, approval queue, Wayback repair, migration mapper, scanner, alerts, billing, multi-tenancy.
- Recommendation: start a clean codebase (see `DELIVERY_PLAN.md`), copy the few useful modules in deliberately with tests, and move the old code to a `legacy/` folder or delete it once the MVP exists.

## Inventory of the old code

| Area | Files | State | Verdict |
|---|---|---|---|
| Redirect Worker `/r/:slug` | `api/src/index-mvp.js` | Works for links already in KV; always 302 | Pattern reusable (KV lookup on the hot path); code not, it is slug-based, not path-based |
| Alternate entry points | `api/src/index*.js` (7 files) | Divergent copies of the router | Delete |
| Scheduled health checks | `api/src/scheduled-health-checks.js` | Broken: undefined `startTime` throws on every URL | Pattern reusable (cron batch selection), code not |
| Failover to fallback URLs | `api/src/health-check.js`, cron | Broken: cron updates D1, redirector reads KV | Concept does not apply (relaunch matches to site pages, not to preset fallbacks) |
| Link CRUD, bulk, categories | `api/src/link-operations.js`, `api/src/api.js` | Likely broken: writes undefined D1 columns | Rewrite as the rules engine |
| Schema and migrations | `api/schema.sql`, `api/migrations/*` | Out of sync with code (two `002_` and two `003_` files) | Start a new schema |
| Auth (email and password, sessions, reset) | `api/src/auth-endpoints*.js`, `api/src/lib/auth-utils.js`, `api/src/password-reset.js` | Works in isolation; split from dashboard auth | Hashing helper reusable; replace sessions with a maintained auth library |
| Dashboard auth | `app/` with NextAuth 4, demo provider | Fragmented, hardcoded demo user | Rewrite |
| API keys (`dl_` prefix) | `api/src/lib/auth-utils.js` | Works | Keep the format idea; store only hashes, scope keys per site |
| Rate limiting, CSRF, security headers | `api/src/security*.js`, `api/src/middleware.js` | Mostly works | Review and port selectively; prefer Cloudflare rate limiting rules and Turnstile |
| Bot detection | `api/src/bot-detection.js` (434 lines) | Works, unused by analytics | Port: needed to keep scanners and crawlers out of the approval queue |
| Analytics | `api/src/analytics-dashboard.js` | Stubbed (hardcoded 80/20 bot split, zeros) | Rewrite on Workers Analytics Engine or D1 aggregates |
| QR codes | `api/src/qr-code.js` | Works | Not needed for relaunch |
| Webhooks (outbound, signed) | `api/src/webhook-security.js` | Works in isolation | Port the HMAC signing idea for alert webhooks |
| GDPR export and delete | `api/src/gdpr-compliance.js` | Works in isolation | Port the endpoint shapes; data model differs |
| Error logging and monitoring | `api/src/error-logger.js`, `api/src/monitoring.js` | Custom, D1-backed | Replace with Workers Logs and Sentry |
| Usage notifications | `api/src/usage-notifications.js` | Works in isolation, no email provider wired | Rewrite with the billing and alert system |
| Dashboard UI | `app/src/app/dashboard/*` | Pages for overview, links, analytics, settings; build errors ignored | Rewrite; the layout is a loose reference only |
| Playwright accessibility tests | `app/playwright.config.ts` | Partial | Reuse the setup idea for the new dashboard and landing |
| Landing page | `landing/` (old) | Fake social proof, dead buttons, false claims | Replaced in this relaunch (see `landing/`) |
| WordPress plugin and JS snippet | `plugin/`, `dist/` | Broken contract with the API; puts account API key in public JS; affiliate link rewriting | Do not reuse; the new WordPress plugin is a different product (404 hook) |
| Shopify | `shopify-app/` | One Liquid block stub | Delete |
| Billing | none (a secret name in CI) | Not built | Missing |

## Mapping to planned features

Legend: **Reuse** (port code with tests), **Pattern** (reuse the idea only), **Rewrite** (old code exists but is wrong for the job), **Missing** (nothing exists).

### Core: edge 404 safety net

| Planned feature | Old code | Gap |
|---|---|---|
| Edge 404 interception (proxy mode, read origin status) | Redirect Worker exists but only for `/r/:slug` | Missing: route-level proxy that passes traffic through and acts on origin 404s |
| Content index (crawl sitemap and links, extract titles) | None | Missing |
| Embeddings and Vectorize index | None | Missing |
| Matching and confidence scoring | None | Missing: also needs an evaluation set to tune thresholds |
| Confident redirect (302 pending, 301 approved) | All redirects are 302 | Rewrite |
| Did-you-mean page | None | Missing |
| Approval queue | None | Missing |
| Rules engine (exact, prefix, pattern; import and export) | Slug-to-URL KV entries | Pattern (KV hot path); Rewrite the model |
| Safety rails (same-domain, method and path exclusions, rollback) | None | Missing |
| Bot-aware logging | `bot-detection.js` | Reuse |

### Link rot repair

| Planned feature | Old code | Gap |
|---|---|---|
| Outbound link checks | HEAD-only checks of user-created links, broken | Rewrite: GET with limits, retries, robots.txt, "blocked" vs "dead" |
| Wayback replacement | None | Missing |
| Moved-page detection | None | Missing |
| Apply fixes in CMS | WordPress plugin rewrites product links (wrong purpose) | Missing |

### Monitoring and alerts

| Planned feature | Old code | Gap |
|---|---|---|
| Free scanner | None | Missing: crawler, results page, Turnstile, abuse limits |
| Scheduled crawls | Cron pattern only | Pattern |
| Uptime and SSL checks | Health probe of own API | Missing |
| Alerts (email, Slack, webhooks) | Signed webhook helper, no email provider | Reuse (HMAC signing); rest Missing |
| Reports | None | Missing |

### Migrations

| Planned feature | Old code | Gap |
|---|---|---|
| Redirect map generator | None | Missing |
| Export to Cloudflare, Vercel, Netlify, Nginx, Apache | None | Missing |
| Post-launch watch | None | Missing (falls out of the safety net plus reports) |

### Link management

| Planned feature | Old code | Gap |
|---|---|---|
| Vanity redirect rules | Short links at `/r/:slug` | Pattern |
| Click counts | Click counter in KV, analytics stubbed | Rewrite on Analytics Engine |
| Short links on a separate domain | Present but broken creation path | Exploring, not prioritized |

### Integrations, platform and business

| Planned feature | Old code | Gap |
|---|---|---|
| Cloudflare one-click deploy | `wrangler.toml` files with hardcoded IDs | Missing (Deploy to Cloudflare button, setup CLI) |
| REST API and OpenAPI spec | Ad hoc itty-router endpoints | Rewrite (typed, versioned, documented) |
| Match endpoint and embed script | None | Missing |
| Next.js integration | None | Missing |
| WordPress plugin (404 hook) | Wrong plugin | Missing |
| Dashboard | Broken-auth Next.js 15 app | Rewrite |
| Auth and teams | Split auth, single user | Rewrite |
| Multi-tenancy (hosted) | `owner_id` column added late | Missing: tenant isolation in D1, per-tenant Vectorize namespaces, quotas |
| Billing and plan limits | Not built | Missing (Stripe, metering of caught 404s) |
| Privacy and GDPR | Export and delete endpoints | Pattern; plus a DPA, privacy policy and log retention |
| Tests and CI | Partial, not wired to the MVP entry | Missing for the new code |
| Public docs site | None | Missing (see `DOCS_OUTLINE.md`) |
| Landing page | Replaced in this relaunch | Done as a concept page with honest status |

## What we honestly cannot deliver yet

Stated plainly so the landing page and sales conversations never promise them:

1. **Any working product.** Today there is a concept, docs and a landing page; no Worker, crawler, matcher or dashboard from the new design exists.
2. **Proven match quality.** We do not know the precision of embedding-based 404 matching on real sites; until we measure it, automatic 301s must stay opt-in.
3. **Non-Cloudflare sites at the edge.** Sites not proxied through Cloudflare need the Next.js, WordPress or embed integrations, none of which exist; the edge Worker only works on Cloudflare zones.
4. **Accounts or billing.** The landing page has no form of its own: the waitlist lives on n8builds.dev (`/upcoming?interest=relink`), which is being built separately and is not live yet; there is no Stripe integration.
5. **Uptime monitoring comparable to Oh Dear.** Basic HTTP and certificate checks are planned; DNS, cron, port, Lighthouse and status pages are not, and should not be promised.
6. **Fixing outbound links inside a CMS.** Initially we can only report and suggest replacements; applying them needs integrations.
7. **JavaScript-rendered sites in the index.** The first crawler reads HTML; single-page apps need Browser Rendering, which adds cost and is not in the MVP.
8. **Support, SLAs or uptime guarantees.** None until there are paying customers and on-call capacity.
9. **A registered domain and cleared trademark.** The working name is decided (Relink, with fallbacks in `PRODUCT.md`), but the landing page lives on a subdomain (https://relink.n8builds.dev) for now: `getrelink.dev` looked available on 2026-11-01 and is not registered, and no trademark search has been done.
10. **Published source code.** The repository is private; the AGPL release happens at the self-host milestone.

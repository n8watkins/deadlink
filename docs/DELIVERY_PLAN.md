# deadlink: Delivery Plan

Written 2026-11-01.
Scope: how to get from today (concept, docs, landing page) to a paid hosted product with an open-source self-host edition.
Read `PRODUCT.md` for what we are building and `GAP_ANALYSIS.md` for why we start from a clean codebase.
Platform limits and prices quoted below must be re-checked against Cloudflare's docs when each piece is built.

## 1. Architecture

### Shape: thin edge agent, shared backend

The key design decision is to split deadlink in two.

- **Edge agent**: a small Cloudflare Worker that runs on the customer's own zone, in the customer's own Cloudflare account.
It passes every request to the origin untouched and only acts when the origin answers 404 (or a configured soft 404).
- **Backend**: the crawler, index, matcher, queue, dashboard and API.
Self-hosters deploy it into the same account as the agent; hosted customers use ours.

Why this split:

1. Normal traffic never touches our infrastructure, so hosted mode adds no latency or cost to healthy requests and we never see visitor traffic we do not need.
2. A Worker can only run on routes of zones in the account it is deployed to, so running the agent in the customer's account is the only way to intercept at the edge without asking customers to proxy their whole domain through us (Cloudflare for SaaS would work but is heavier, more expensive and a bigger trust ask; it stays an option for non-Cloudflare sites later).
3. Self-host and hosted run the same agent; only the backend URL and credentials differ.

```
 Visitor ──> Customer zone (Cloudflare)
              │
              ▼
        ┌────────────┐  2xx/3xx: pass through unchanged
        │ Edge agent │──────────────────────────────> Visitor
        │  (Worker)  │
        └─────┬──────┘
              │ origin said 404
              ▼
   1. rule cache (Cache API / KV) ── hit ──> 301/302 to rule target
              │ miss
              ▼
   2. Backend match API ── confident ──> 302 (pending) and queue event
              │                low ──> did-you-mean page, status 404
              ▼
        ┌──────────────────────── Backend (Workers) ─────────────────────────┐
        │ API + dashboard (Next.js on Workers via OpenNext)                  │
        │ Matcher: lexical scoring + Workers AI embeddings + Vectorize       │
        │ Crawler/indexer: Queues + Workflows, Cron Triggers for schedules   │
        │ Link checker + Wayback lookups (Queues, rate-limited)              │
        │ D1: workspaces, sites, rules, queue, aggregates                    │
        │ KV: published rules per site   R2: crawl snapshots, exports        │
        │ Analytics Engine: raw caught-404 events                            │
        └────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Runs on | Responsibility |
|---|---|---|
| Edge agent | Worker on the customer zone route | Pass-through; detect 404 and soft 404; apply cached rules; call match API; render did-you-mean page; send events in the background with `ctx.waitUntil` |
| Match API | Backend Worker | `GET /v1/sites/:id/match?path=` returns ranked candidates, confidence and the decided action; the single entry point for the agent and every integration |
| Rules publisher | Backend Worker | On approve or import, writes the rule to D1 (source of truth) and republishes the site's rule set to KV; the agent caches it with a short TTL |
| Crawler and indexer | Queues consumers plus a Workflow per crawl | Reads sitemap and internal links with GET, respects robots.txt, extracts title, headings and a text summary, embeds with Workers AI, upserts to Vectorize |
| Link checker | Queues consumer, Cron Trigger | Checks outbound links with GET (HEAD is unreliable), retries, classifies dead vs blocked vs soft 404, looks up Wayback snapshots via the Availability API |
| Migration mapper | Backend Worker plus dashboard | Ingests old URLs (crawl, sitemap, CSV, Search Console export), matches them against the new site's index, outputs a reviewable map and exports |
| Scanner | Public Worker plus landing page | Bounded crawl (about 200 pages), Turnstile, per-IP and per-domain rate limits, results stored in R2 for 30 days |
| Dashboard | Next.js 16 on Workers (OpenNext) | Sites, approval queue, rules, index, reports, settings, billing |
| Alerts and reports | Cron Trigger plus email provider | Spike detection on new 404s, uptime and certificate checks, weekly summary |

### Data stores

| Store | Holds | Why |
|---|---|---|
| D1 | Workspaces, members, sites, API keys (hashed), rules, queue items, daily aggregates, scans, billing state | Relational, cheap, transactional enough for control-plane data; one database per deployment, `workspace_id` on every row in hosted mode |
| KV | Published rule set per site, small config blobs | Read-heavy, globally cached, eventual consistency is fine for redirects |
| Vectorize | One vector per indexed page with `site_id` metadata (or one namespace per site) | Nearest-neighbour search over page embeddings, filtered to the site |
| Workers AI | Embedding model (start with a BGE model; a multilingual one for non-English sites) | Embeddings next to the data, no third-party AI vendor or data transfer |
| R2 | Crawl snapshots, scan reports, CSV and redirect-map exports, backups | Large objects, no egress fees |
| Analytics Engine | Raw caught-404 events (path, referrer host, bot class, country, action) | High write volume without loading D1; D1 keeps only aggregates |
| Queues | Crawl, embed, link-check and event fan-out | Back-pressure and retries |
| Durable Objects (only if needed) | Per-site rate limiting of automatic rules, crawl coordination | Strong per-site consistency where KV is not enough |

### Matching and safety

1. **Normalize** the path: case, trailing slash, `index.html`, `.html` and `.php` extensions, tracking parameters, double slashes.
2. **Exact and pattern rules** first (approved rules always win).
3. **Lexical candidates**: path tokens vs indexed URLs and titles (token overlap, slug edit distance, date and ID stripping).
4. **Semantic candidates**: embed the path tokens as text ("blog 2021 how to price a website"), query Vectorize top 10 filtered by site.
5. **Score**: a weighted blend tuned on a labelled evaluation set, calibrated so that "0.9" means "right about 90% of the time on the eval set".
6. **Decide**: above the site's threshold, 302 and queue; below, did-you-mean page with a 404 status; no candidate, plain helpful 404.
7. **Cache** the decision per site and path in KV with a TTL (and a negative cache), so repeated hits on the same broken URL cost one AI call, not thousands.

Safety rails built into the agent, not the dashboard: same-host targets only, GET and HEAD only, exclusion patterns (`/api/*`, `/wp-admin/*`, asset extensions), a cap on new automatic redirects per site per hour, a kill switch that turns the agent into pure pass-through, and loop detection.
Automatic 301s are off by default; 301 is written only when a human approves or when the owner opts in to auto-approval above a threshold they set.

### Dashboard, auth and billing

- Dashboard: Next.js 16.4 with Turbopack, deployed to Workers with OpenNext, Tailwind, server components by default.
- Auth, hosted: Better Auth with a D1 adapter (email magic link, Google, GitHub), workspaces and roles; SSO later.
- Auth, self-host: either Cloudflare Access in front of the dashboard (recommended) or the same Better Auth setup with a single admin.
- API keys: per site, scoped (`match:read`, `rules:write`, and so on), stored hashed, shown once.
- Billing (hosted only): Stripe Checkout and the customer portal, Stripe usage meters for caught 404s, webhooks into D1; soft limits enforced in the match API, never by breaking visitor requests.

### Multi-tenant hosted vs single-tenant self-host

One codebase with `DEPLOYMENT_MODE=hosted|self`.

| Concern | Hosted | Self-host |
|---|---|---|
| Tenancy | Many workspaces; `workspace_id` on every D1 row enforced in a data-access layer with tests; Vectorize filtered by `site_id` | One workspace created at install |
| Edge agent | In the customer's account, installed with a scoped Cloudflare API token or a Deploy to Cloudflare button, talks to our backend with a site key | Same agent, talks to the backend in the same account |
| Billing | Stripe | Disabled |
| Email | Our provider | Bring your own (Resend, SMTP, Email Workers) |
| Uptime checks | Multiple regions | Single Worker cron |
| Upgrades | Continuous deploys | Tagged releases, `git pull`, D1 migrations, `wrangler deploy` |

### Integration surface (for techforpros.com or anyone else later)

Designed now, built in the integrations milestone:

- The **match API** is the integration contract: any host or CMS can call it from its own 404 handler.
- A **workspace API** (create site, set sitemap, read the queue, approve rules) lets a platform such as Tech for Pros provision deadlink for each of its customer sites and show the queue inside its own admin.
- An **embed script** renders did-you-mean suggestions inside an existing 404 page.
- **Webhooks** (HMAC-signed) for new queue items, approvals and alerts, so a platform can surface them in its own notifications.
- White-label options on the Team tier cover reports and the did-you-mean page.

### Open-source licensing

**Decision: AGPL-3.0 for the core (agent, backend, dashboard), MIT for client SDKs, the embed script and the WordPress plugin.**

| Option | For | Against |
|---|---|---|
| MIT | Maximum adoption, no friction for companies | A redirect host or platform can take the code, add it to a closed hosted product and compete with our hosted tier at no cost; the platform risk below gets worse |
| AGPL-3.0 | Anyone offering it as a network service must publish their changes; proven open-core model (Dub, Plausible, Cal.com); still free for every self-hoster | Some companies ban AGPL internally; slightly less contribution from large firms |
| Source-available (BSL, FSL) | Strongest protection | Not open source by OSI definition, which weakens the "open-source alternative" positioning that is half the pitch |

The client pieces are MIT because customers embed them in their own code and must not have to think about copyleft.
Contributions come in under the Developer Certificate of Origin plus a short contributor license agreement, so a commercial license can be offered later to a company that cannot use AGPL.
Hosted-only code (Stripe integration, multi-region uptime probes) can live in a small private package behind interfaces, so the public repo stays complete for self-hosters without exposing billing internals.

## 2. Phased milestones

Order and reasoning: prove matching quality first (the riskiest assumption), ship a working single-site product, open-source it (cheap distribution and feedback, no billing or multi-tenancy needed), then build the hosted business on top, then broaden integrations.
This differs from "hosted first" because the self-host edition is almost exactly the MVP, while hosted adds tenancy, billing and support that should wait for proof of demand.

Effort assumes one full-time developer working with AI coding assistance; ranges include testing and docs.

### M0. Foundations and matching evaluation (1 to 2 weeks)

- New monorepo (`apps/agent`, `apps/backend`, `apps/dashboard`, `apps/landing`, `packages/matcher`, `packages/sdk`), TypeScript, Vitest, Playwright, CI, conventional commits.
- Move the old code to `legacy/` or delete it.
- **Evaluation harness**: collect real 404 paths and their correct destinations from 3 to 5 real sites (server logs, Search Console exports, past migrations, including n8builds and Tech for Pros customer sites with permission), label 300+ pairs, and measure precision and recall of the matcher offline.
- Exit: matcher reaches at least 90% precision at a threshold that still auto-handles at least half of the labelled 404s; if not, the product pivots to suggestion-only (did-you-mean plus queue, no automatic redirects).

### M1. MVP for one site (3 to 4 weeks)

- Edge agent: pass-through, 404 and soft 404 detection, rule cache, match call, did-you-mean page, background events, kill switch.
- Backend: crawler and indexer from sitemap, embeddings and Vectorize, match API, rules publisher, D1 schema and migrations.
- Minimal dashboard: approval queue, rules list with CSV import and export, index status, threshold setting, single admin.
- Free scanner as a public page on the landing site, with Turnstile and rate limits.
- Dogfood on the landing site and one or two friendly real sites.
- Exit: running for two weeks on real traffic with no wrong 301s, and a measured rescue rate.

### M2. Open-source self-host release (2 to 3 weeks)

- Repository goes public under AGPL-3.0 (core) and MIT (clients).
- `npx deadlink init` creates D1, KV, Vectorize, Queues and R2, writes `wrangler.jsonc`, deploys; plus a Deploy to Cloudflare button.
- Self-host docs from `DOCS_OUTLINE.md`: quickstart, configuration, Worker setup, security, upgrading.
- Launch: Show HN, Cloudflare community, r/webdev and r/selfhosted; landing page early access form wired to real storage (D1 via a Worker), double opt-in.
- Exit: 10 external self-host installs reporting success in issues or discussions.

### M3. Hosted beta (5 to 7 weeks)

- Multi-tenancy, Better Auth, workspaces and roles, per-site API keys.
- Onboarding: connect Cloudflare with a scoped token, pick zone, agent deployed, first index built, first caught 404 shown.
- Outbound link checks with Wayback suggestions, scheduled crawls, basic uptime and certificate checks.
- Email alerts and a weekly report; Slack and webhooks on Team.
- Migration mapper with exports to Cloudflare Bulk Redirects, Vercel, Netlify, Nginx and Apache.
- Stripe behind a flag, free during beta; status page; privacy policy, terms and DPA written properly.
- Exit: 30 active hosted beta sites, at least 40% activation (site connected and first fix approved within 7 days).

### M4. Integrations (4 to 6 weeks, can overlap M3)

- Public match API and OpenAPI spec, TypeScript SDK.
- Next.js package (middleware and `not-found` helper), embed script.
- WordPress plugin (404 hook plus outbound link fixes inside posts).
- Netlify and Vercel edge adapters.
- Workspace API and webhooks for platform partners (the Tech for Pros path).

### M5. General availability (2 to 3 weeks after M3)

- Paid tiers on, usage metering verified against invoices, dunning, upgrade and downgrade flows.
- Name decision made and domain registered before GA (see `PRODUCT.md` section 6).
- Support process, incident runbook, backups and restore drill.

Indicative total: about 17 to 25 weeks from M0 to GA for one developer; M4 overlapping M3 keeps it near the lower end.

## 3. What to build first, and why

1. **The matching evaluation harness and matcher (M0).**
Everything else is commodity (crawling, redirects, dashboards); match quality is the product.
If it is not precise enough, we find out in two weeks instead of after building billing, and we pivot to suggestion-only without wasted work.
2. **The edge agent with the did-you-mean page and approval queue (M1).**
This is the feature nobody else sells, and it is useful even at modest match quality because low-confidence cases still get a better 404 page and the owner still gets a prioritized queue.
3. **The free scanner (end of M1).**
Cheap to build on top of the crawler, it validates demand, earns search traffic for "broken link checker" intent and fills the early access list.

Deliberately later: billing (no one to bill yet), short links (Dub and Bitly own this), Oh Dear-style deep monitoring (not our wedge).

## 4. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Platform risk**: Cloudflare, Vercel, Netlify or Shopify ship automatic 404 matching as a toggle; Redirect.pizza or redirection.io add AI matching | Medium | High | Move fast on the parts platforms rarely build: approval workflow, migrations, outbound repair, cross-platform agent and reports; open source makes us the default choice for self-hosters and gives platforms a reason to partner rather than copy; integrate with Cloudflare Bulk Redirects rather than compete |
| **False-positive redirects and SEO harm**: wrong matches create soft-404 signals and annoyed visitors | Medium | High | M0 precision gate; 302 until approved; did-you-mean page keeps a 404 status; same-host only; per-site caps on automatic rules; one-click rollback; weekly report of every automatic redirect |
| **Policy risk**: anything resembling sneaky redirects | Low | High | Principle in code: only same-site equivalents or archives, never advertising or affiliate targets |
| **Privacy**: logging visitor requests for customers in the EU | Medium | Medium | Store no IPs or cookies; aggregate early; Analytics Engine retention limits; DPA and subprocessor list before hosted beta; self-host keeps data in the customer's account |
| **Cost of AI and vector queries at scale** (bot floods of random 404s) | Medium | Medium | Bot classification before matching; decision cache per path; negative cache; per-site rate limits; meter on caught 404s so price tracks cost |
| **Scanner abuse** (scanning third-party sites, crawl amplification) | Medium | Medium | Turnstile, per-IP and per-target limits, robots.txt respected, identifiable user agent, page cap |
| **Crawls blocked or JavaScript-only sites** | Medium | Medium | Clear "blocked" status; Browser Rendering only where needed and later; sitemap-first indexing |
| **Cloudflare lock-in for self-hosters** | High (by design) | Low to medium | State it plainly; integrations make the backend usable from non-Cloudflare sites; abstract stores behind interfaces so a Node or Docker port remains possible |
| **Willingness to pay is low** (detection is free everywhere) | Medium | High | Validate with the scanner and early access list before billing; lead with agencies and migrations where budgets exist; keep costs near zero until then |
| **Owner focus** (Tech for Pros is the active business) | High | Medium | Milestone gates with explicit continue or stop decisions; the integration API means work is reusable inside Tech for Pros even if the standalone product stops |
| **Name and trademark** | Low | Medium | Decide before GA; keep the brand isolated in `lib/site.ts` and docs |

## 5. Success metrics

North star: **broken visits rescued per week** (caught 404s that ended on a working page via redirect or did-you-mean click).

| Milestone | Metric | Target |
|---|---|---|
| M0 | Matcher precision at chosen threshold on the labelled set | At least 90%, with at least 50% of 404s auto-handled |
| M1 | Wrong 301s in production | Zero |
| M1 | Rescue rate on dogfood sites (rescued / caught human 404s) | At least 60% |
| M1 | Added latency on pass-through requests | Not measurable above normal Worker overhead (target under 5 ms at p95) |
| M2 | External self-host installs | 10 in the first month |
| M2 | GitHub stars and early access sign-ups | 500 stars, 300 sign-ups in the first month (directional, not a gate) |
| M2 | Scanner runs to early access sign-up conversion | At least 5% |
| M3 | Activation (connected and first approval within 7 days) | At least 40% |
| M3 | Weekly active sites (an approval or report open per week) | At least 50% of connected sites |
| M5 | Free to paid conversion | 3 to 5% |
| M5 | Monthly logo churn on paid | Under 4% |
| Ongoing | Support tickets about wrong redirects | Under 1 per 50 active sites per month |

### Decision gates

- After M0: continue to M1 only if the precision gate passes; otherwise re-scope to suggestion-only and re-check the pricing story.
- After M2: continue to the hosted beta if there are at least 10 external installs or 300 qualified sign-ups; otherwise keep deadlink as an open-source project and fold the agent into Tech for Pros as the market report originally recommended.
- After M3: switch on billing if activation is at least 40% and at least five beta users say they would pay at the planned price.

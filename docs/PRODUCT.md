# Rewire: Product Definition

Status: concept, nothing in this document is built yet unless marked otherwise.
Written 2026-11-01.
Name decided 2026-11-01: **Rewire**, with "deadlink" as the documented fallback (section 6).
Competitor facts come from `MARKET_REPORT_2026-11.md` and from vendor pages re-checked on 2026-11-01 (Oh Dear pricing, Dub pricing, Dub GitHub README).

## 1. Positioning

### One-liner

**Rewire is the open-source 404 safety net: it catches broken links the moment a visitor hits them, sends them to the page they meant using your own site's content, and turns every fix into a permanent redirect with one click.**

Short form for the hero: "Catch every 404. Send visitors where they meant to go."

### The shift from the old deadlink

Rewire is the relaunch of the 2025 project called deadlink, which was an affiliate short-link service with fallback URLs, sold as "turn dead links into revenue".
The relaunch drops monetization entirely.
Rewire never redirects a visitor anywhere except the closest equivalent page on the same site, or an archived copy of the page they asked for.
That rule is a product principle, a trust signal, and the only SEO-safe position (see the sneaky-redirects risk in the market report).

### Who it is for

| Segment | Pain today | Why Rewire |
|---|---|---|
| Developers and indie site owners on Cloudflare, Vercel or Netlify | Static redirect files, no idea which old URLs still get traffic | Drop-in edge Worker or middleware, open source, free tier |
| Agencies running many client sites | Site rebuilds ship without redirect maps, rankings drop, the client blames the agency | Migration mapper plus live safety net plus a monthly report they can forward |
| Content-heavy sites: blogs, docs, publishers | Internal URLs change, outbound links rot (Pew: 38% of 2013 pages gone by 2023) | Live 404 matching for internal links, Wayback repair for outbound links |
| Small ecommerce | Discontinued products leave 404s that Google and old ads still send traffic to | Match a dead product URL to the closest live category or product |
| Privacy-sensitive or regulated teams | Cannot send traffic logs to a third party | Self-host the whole stack on their own Cloudflare account |

Not for (now): affiliate link cloaking, ad monetization, enterprise link management, social short links at scale.

### Jobs to be done

1. "When a visitor hits a missing page, get them to the right page before they leave."
2. "When I move or rebuild a site, keep every old URL working so I do not lose rankings or bookmarks."
3. "Tell me which links are broken, which ones you already fixed, and which ones need me."
4. "When a page I link to disappears, replace the link with the moved page or an archived copy."
5. "Let me run all of this on infrastructure I control if I need to."

## 2. Feature list

Status legend: **MVP** (first milestone), **Beta** (hosted beta), **Later** (after beta), **Exploring** (not committed).

### Core: the edge 404 safety net

| Feature | What it does | Status |
|---|---|---|
| Edge 404 interception | A Cloudflare Worker in front of the site sees the origin response; on a 404 (or configured soft 404) it takes over before the visitor sees an error | MVP |
| Content index | Crawls the sitemap and internal links, stores URL, title, headings and a summary per page, embeds them with Workers AI into Vectorize | MVP |
| Smart matching | Combines URL token similarity, slug edit distance and embedding similarity of the requested path against the index, returns ranked candidates with a confidence score | MVP |
| Confident redirect | Above a per-site threshold, serves a redirect to the best match (302 while pending review, 301 once approved) | MVP |
| "Did you mean" page | Below the threshold, renders a fast, branded, accessible page listing the top matches plus site search; returns a real 404 status so search engines are not misled | MVP |
| Approval queue | Every match and miss lands in a queue grouped by path, with hit counts and referrers; approve, edit or reject in one click; approved matches become permanent rules | MVP |
| Rules engine | Exact, prefix and pattern redirects with priorities, served from KV in the Worker; import and export as CSV and `_redirects` format | MVP |
| Safety rails | Never redirect to another domain, never redirect POST or API paths, exclude paths by pattern, rate-limit automatic rules, one-click rollback | MVP |
| Bot-aware logging | Separates human visitors from crawlers and vulnerability scanners (`/wp-admin.php` probes) so the queue is not spam | Beta |

### Link rot repair (outbound links)

| Feature | What it does | Status |
|---|---|---|
| Outbound link checks | Scheduled GET-based checks of every external link found on the site, with retries; separates "dead", "blocked us" and "soft 404" | Beta |
| Wayback replacement | For dead outbound links, looks up the closest snapshot via the Internet Archive Availability API and proposes it | Beta |
| Moved-page detection | Follows redirects and checks the target site's sitemap for the new location before falling back to an archive | Later |
| Apply fixes | Exports a fix list; with a CMS integration (WordPress, headless CMS APIs) applies replacements directly | Later |

### Monitoring and alerts

| Feature | What it does | Status |
|---|---|---|
| Free "Is your site broken?" scanner | Public page: enter a URL, crawl up to about 200 pages, get broken internal and outbound links, redirect chains, missing HTTPS and missing titles; lead magnet, rate-limited, Turnstile-protected | MVP |
| Scheduled crawls | Daily or weekly full-site crawl finding broken internal links, redirect chains and orphaned rules | Beta |
| Uptime and SSL checks | Basic HTTP uptime and certificate expiry for each connected site; not a full Oh Dear replacement | Beta |
| Alerts | Email first, then Slack, Discord and webhooks, on spikes of new 404s, site down, certificate expiry | Beta |
| Weekly or monthly report | "We caught N broken visits, fixed M, these K need you"; white-label on Team | Beta |

### Migrations

| Feature | What it does | Status |
|---|---|---|
| Redirect map generator | Takes old URLs (crawl of the old site, old sitemap, Search Console export, server logs) and new URLs, embeds both sides and proposes a one-to-one map with confidence scores | Beta |
| Review and deploy | Approve the map in the dashboard, deploy as rules in the Worker on launch day, or export for Cloudflare Bulk Redirects, Vercel, Netlify, Nginx and Apache | Beta |
| Post-launch watch | After cutover, the safety net catches anything the map missed and reports it daily for 30 days | Beta |

### Link management

| Feature | What it does | Status |
|---|---|---|
| Redirect rules on your own domain | Vanity paths like `/go/pricing` managed in the same rules engine | Beta |
| Click counts per rule | Basic counts and referrers, privacy-friendly, no cookies | Beta |
| Short links on a separate domain | Dub-style short links; deliberately small, because Dub and Bitly own this space | Exploring |

### Integrations and API

| Feature | What it does | Status |
|---|---|---|
| Cloudflare (primary) | One-click deploy of the Worker onto a zone route, or `wrangler deploy` for self-hosters | MVP |
| REST API | Sites, rules, queue, matches, scans; API keys per site; OpenAPI spec | Beta |
| `match` endpoint and embed | `GET /v1/sites/:id/match?path=` returns candidates; a small script renders "did you mean" suggestions inside any existing 404 page; this is the path to embed Rewire in other products such as techforpros.com later | Beta |
| Next.js | Middleware or `not-found.tsx` helper that calls the match endpoint and redirects server-side | Beta |
| WordPress | Plugin hooking the 404 template that calls the match endpoint, plus outbound link repair inside posts | Later |
| Netlify, Vercel edge, generic reverse proxy | Edge function adapters using the same match endpoint | Later |
| MCP server | Lets an AI agent query broken links and propose rules | Exploring |

## 3. Self-host vs hosted

The rule: the self-hosted edition is the full product for one organization, not a crippled demo.
Hosted adds what is hard or tedious to run yourself, and what only makes sense multi-tenant.
Release order (decided 2026-11-01): the open-source self-host release ships first, and the hosted beta follows (see `DELIVERY_PLAN.md`).

| Capability | Self-host (AGPL-3.0, free) | Hosted (paid tiers) |
|---|---|---|
| Edge Worker, matching, did-you-mean page, rules, approval queue | Yes | Yes |
| Content index (Workers AI + Vectorize) | Yes, on your Cloudflare account and bill | Yes, included |
| Free scanner | Yes, self-run | Yes, public |
| Dashboard | Yes, single organization | Yes, multi-site, multi-team |
| Outbound link repair, scheduled crawls | Yes | Yes, with managed crawl capacity |
| Uptime checks from multiple regions | No (single Worker cron) | Yes |
| Email alerts and reports | Bring your own provider (Resend, SMTP via Email Workers) | Included, white-label on Team |
| Seats, roles, SSO | Single admin plus API keys | Seats and roles; SSO later |
| Migration mapper | Yes | Yes, plus assisted migrations as a service later |
| Support | Community (GitHub issues and discussions) | Email support; priority on Team |
| Updates | `git pull` and `wrangler deploy` | Automatic |

Hosting requirements for self-host: a Cloudflare account with the site proxied through Cloudflare, Workers, KV, D1, Vectorize, Workers AI, Queues and R2.
Small sites should fit within Cloudflare's free allowances; busy sites will need the Workers Paid plan (to be verified against Cloudflare's limits at build time).
Sites not on Cloudflare can still self-host the backend and use the Next.js or WordPress integration instead of the edge Worker.

## 4. Pricing (planned, early access)

All prices are planned and unvalidated.
Nothing is billable today.

| Tier | Price | Sites | Included | Who |
|---|---|---|---|---|
| Free | $0 | 1 | 1,000 caught 404s per month, up to 500 indexed pages, weekly crawl, approval queue, did-you-mean page, community support | Personal sites, trying it out |
| Pro | $12 per month | 3 | 50,000 caught 404s per month, 5,000 pages per site, daily crawl, outbound link repair with Wayback, uptime and SSL alerts, migration mapper, API | Indie developers, small businesses |
| Team | $49 per month | 25 | 500,000 caught 404s per month, 25,000 pages per site, 5 seats, white-label did-you-mean page and reports, Slack and webhook alerts, priority support | Agencies, content teams |
| Self-host | $0 (AGPL-3.0) | Unlimited | Everything in the core on your own Cloudflare account; you pay Cloudflare directly | Developers, privacy-sensitive teams |

Overages: soft limits with an email warning; past the limit, the Worker keeps serving existing rules and the did-you-mean page but stops creating new automatic matches until the next cycle.
Visitors never see an error because of billing.

### Reasoning

- **Free tier exists** because detection is free everywhere (Search Console, Rank Math, Dr. Link Check Lite, Redirect.pizza's free plan); a product without one will not get tried.
Dub has no free plan listed today (dub.co/pricing, Business starts at $81 per month), which is an opening at the low end.
- **Pro at $12** sits under Oh Dear Solo ($17 per month for 2 sites) and Dr. Link Check Standard ($13), above Redirect.pizza's free tier, because Rewire fixes rather than only reports.
The report's earlier "$9 per site" idea becomes $4 per site across 3 sites, which is easier to say yes to.
- **Team at $49** matches Oh Dear's Studio slot for agencies at half the price per site ($109 for 25 sites vs $49 for 25 sites) and matches Dr. Link Check Professional ($49).
The agency job (migrations and client reports) is where willingness to pay is highest.
- **Metered on caught 404s, not pageviews**, because 404 volume is what costs us (Worker invocations, embedding lookups) and what the customer values.
Normal traffic passing through the Worker is not metered.
- **No revenue share, no ad network, no affiliate rewriting**, ever.
- **Self-host is free** to win developer trust and distribution, like Dub, Plausible and Umami; hosted revenue comes from convenience, scale and support.

To validate before building billing: free scanner traffic, waitlist sign-ups on n8builds.dev by segment, and five agency conversations about migration pricing.

## 5. Comparison

Rewire column describes the planned product, not what exists today.
Competitor rows are from vendor pages checked on 2026-11-01 unless marked.

| | Rewire (planned) | Oh Dear | Dub |
|---|---|---|---|
| Category | 404 safety net and link health | Website and server monitoring | Link management and attribution |
| Open source | Yes, AGPL-3.0 core | No | Yes, AGPL-3.0 core, `/ee` folder commercial (GitHub README) |
| Self-hostable | Yes, on Cloudflare | No, hosted (data in Belgium) | Yes, documented guide |
| Catches 404s live and fixes them | Yes, at the edge | No, reports broken links after a crawl | No, manages links you create |
| Matches a missing URL to the right page | Yes, embeddings of your own content | No | No |
| Approval queue for fixes | Yes | No | No |
| Broken link crawl | Yes | Yes, plus mixed content | No |
| Outbound link repair (Wayback) | Yes (Beta) | No | No |
| Migration redirect map | Yes (Beta) | No | No |
| Uptime and SSL | Basic (Beta) | Yes, extensive (DNS, cron, port, Lighthouse, status pages) | No |
| Short links and click analytics | Basic rules and counts | No | Yes, core strength, plus conversions and partner programs |
| Free plan | Yes | No (10-day trial) | No (14-day trial) |
| Entry price | $12 per month (planned) | $17 per month, 2 sites | $81 per month (Business) |

Where we differ in one line each:

- **vs Oh Dear:** Oh Dear tells you something broke; Rewire fixes the broken visit while it happens, then asks you to confirm the fix. Oh Dear is the better pure monitor, and we should not try to match its 15+ check types.
- **vs Dub:** Dub manages links you create and measures conversions; Rewire rescues links you did not know were broken. We share the open-source, self-host-plus-hosted model, not the job.

### Briefly, the others

| Product | What it does well | Why Rewire still has room |
|---|---|---|
| Redirect.pizza | Edge redirect hosting with a generous free tier, API and MCP server | Static rules you write yourself; no detection, no content matching, no approval flow (vendor page) |
| Rank Math | Free 404 monitor and redirect manager inside WordPress | WordPress only, runs at the origin after the request, a human must write every redirect (third-party listings) |
| Google Search Console | Free, authoritative report of crawled 404s | Reports only what Googlebot saw, days later, and fixes nothing |
| Cloudflare Bulk Redirects | Free static redirects at the edge, 10,000 URLs on the free plan | Static lists; Rewire can export to it and should, rather than compete |

## 6. Name

**Decided 2026-11-01 by the owner: the product is called Rewire.**
It says what the product does (reconnect broken links) rather than naming the failure, it is friendly and verb-like, and it fits the migration story.

**Fallback: deadlink.**
If Rewire domains or trademarks do not work out, the product goes back to "deadlink", which is short, says the problem and matches what developers search for ("dead link", "broken link").
The repository and folder keep the name `deadlink` either way.

### Domains (RDAP checks on 2026-11-01)

| Domain | Status |
|---|---|
| rewire.dev | Taken |
| rewire.app | Taken |
| rewirehq.com | Taken |
| userewire.com | Taken |
| getrewire.dev | Looked available, unconfirmed, not registered |
| rewire.so | Looked available, unconfirmed, not registered |

The landing page uses `https://getrewire.dev` as a placeholder canonical URL (overridable with `NEXT_PUBLIC_SITE_URL`).
The domain is not registered yet; register it, or pick another, before any public launch.

### Other name checks still to do

- Trademark search for "Rewire" in software classes (US and EU) before the hosted beta.
- The npm package `rewire` is taken by a popular dependency-injection library for Node.js unit tests, so the planned setup CLI is written as `npx getrewire init` until a package name is chosen.
That library also crowds npm and GitHub search results for "rewire", which matters for an open-source launch.

## 7. Principles

1. Same site, closest equivalent, or an honest archive: nothing else.
2. A human approves every permanent redirect, unless they opt in to auto-approval above a threshold they choose.
3. Never return a misleading status code: a did-you-mean page is a 404.
4. No cookies and no personal data in logs beyond what is needed; IPs are not stored.
5. Self-host is first class: no feature exists only to push people to hosted.
6. No fake social proof, ever: no invented users, testimonials or numbers on any page.

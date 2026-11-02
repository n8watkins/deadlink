> Note (2026-11-01): the relaunched product is now called Relink (working name); this report keeps its original "deadlink" wording.

# deadlink: Market Report and Relaunch Assessment (November 2026)

Prepared 2026-11-01.
Scope: the code in this repo (read-only, last commit July 2025), the landing page in `landing/`, and web research on competitors and the market.
Prices come from vendor pages fetched on 2026-11-01 where marked "(vendor page)"; everything else comes from third-party listings and is marked "(third-party, unverified)".

## TL;DR

**Do not come back to deadlink as a standalone product.**
**Do harvest three of its ideas as features inside Tech for Pros.**

- What was built is not what the landing page sells.
The code is a URL shortener with up to three fallback URLs per short link, aimed at affiliate product links (Amazon, Walmart).
The landing page sells "turn your 404s into revenue" through an advertising network, revenue share and payouts, none of which exists in code.
- The core loop does not work as committed.
The scheduled health check throws on every URL, it never updates the store the redirector reads, and link creation writes to a database column the schema does not define.
- The market is crowded at the bottom and owned at the top.
Detection is free or nearly free (Google Search Console, Ahrefs free tier, Rank Math's free 404 monitor, Dr. Link Check's free plan), redirect hosting is cheap (Redirect.pizza free tier, Cloudflare Bulk Redirects), and link management is a scale game (Bitly, Dub, Rebrandly, Short.io).
- The original "monetize dead traffic" model is a liability, not a moat.
Redirecting visitors who clicked one thing to an advertiser's page is close to what Google calls sneaky redirects, Amazon forbids automatic redirects to Amazon, and the landing page's invented testimonials and stats fall under the FTC's 2024 fake-reviews rule.
- The one genuinely under-served slot is a live **404 safety net at the edge**: catch a 404 as it happens, match it to the right live page with embeddings, redirect, and log it for one-click approval.
Small sites on Cloudflare are exactly where nobody sells this well, and Tech for Pros already hosts small-business sites on Cloudflare.
- Recommendation: build "keep your Google rankings when we move you" (migration redirect map + edge 404 safety net + monthly broken-link report) into Tech for Pros, and use a free "Is your website broken?" scanner as a Tech for Pros lead magnet.
Archive the deadlink repo after that; reuse ideas, not code.

## 1. What was actually built

### Shape of the repo

| Part | Stack | State |
|---|---|---|
| `api/` | Cloudflare Worker (itty-router), KV for redirects, D1 for metadata, cron every 5 minutes | Most code lives here; 33 source files including about 10 alternate entry points (`index.js`, `index-mvp.js`, `index-phase1.js`, `index-test.js`, `index-with-auth.js` and others); `wrangler.toml` points at `index-mvp.js` |
| `app/` | Next.js 15.4.4, React 19, NextAuth 4 (Google, credentials, a hardcoded demo user) | Dashboard pages for overview, links, analytics and settings; `next.config.js` sets `ignoreBuildErrors` and `ignoreDuringBuilds` |
| `landing/` | Next.js 15.4, Tailwind 3, Framer Motion | Single marketing page |
| `plugin/`, `dist/` | WordPress plugin and a universal JS snippet | Rewrites product links in post content into short links |
| `shopify-app/` | One Liquid theme block | Stub |
| Docs | README, FEATURE_ANALYSIS, DEPLOYMENT_GUIDE, phase plans | Optimistic ("95% complete", "launch now") and contradicted by the README's own "Critical Integration Issues" section |

### Features in code

- Short links at `/r/:slug` with a 302 redirect, optional expiry (410 when expired) and a click counter.
- Up to three fallback URLs per link, with statuses `live`, `fallback_1..3`, `dead`, `paused`, `disabled`.
- Link CRUD, bulk create and bulk delete (up to 100), categories, QR codes, API keys (`dl_` prefix), outbound webhooks.
- Email and password auth with bcrypt, sessions, password reset, CSRF helpers, rate limiting, GDPR export and delete.
- Bot detection module (Cloudflare bot score plus user-agent heuristics), though the analytics endpoints do not use it.
- WordPress plugin and JS snippet that find Amazon, Walmart, Target, Best Buy and eBay links on a page and swap them for short links, generating fallbacks such as an Amazon search for the first three words of the page's `<h1>` and the retailer homepage.

### How dead links are detected

A cron trigger selects up to 50 links not checked in 5 minutes, sends a `HEAD` request with a 5-second timeout, and treats any non-2xx as a failure.
After three consecutive failures it steps the status from `live` to `fallback_1`, then `fallback_2`, `fallback_3`, then `dead`.
It does not crawl a site, does not look at pages that link out, and does not watch real 404 traffic.
It only checks destinations of short links the user created.

### How redirects work

The Worker reads the link JSON from KV and redirects to `url` or the fallback named by `status`, or returns 410 for `dead`.
All redirects are 302, although the landing FAQ promises SEO-preserving 301s.

### Pricing tiers in code

`api/schema.sql` defines `free` (100 links, 10,000 clicks/month, 3 fallbacks), `pro` (5,000 links, 100,000 clicks, 10 fallbacks) and `enterprise` (unlimited).
No price is attached to any tier, and link creation never checks the limit (only an unused `auth.js` and the usage report read `plan_limits`).
The landing page shows different tiers again: Starter $0, Professional $49, Enterprise custom, each with a revenue share.

### Billing

There is no Stripe code.
"Stripe-backed" amounts to a `STRIPE_SECRET_KEY` secret name in the CI workflow, a health-check probe that reports whether that variable is set, and a Stripe worker sketched in `phases/phase-7-billing-monetization.md`.
There is no advertiser network, revenue share, payout ledger or anything else behind the landing page's money claims.

### Finished vs stubbed vs broken

| Area | Status | Evidence |
|---|---|---|
| Redirect at `/r/:slug` | Works for links already in KV | `index-mvp.js` redirect handler |
| Health checks | **Broken** | `checkUrlHealth` uses `startTime`, which is never defined in that function, in both the success and the catch path, so every check throws a ReferenceError and no link is ever marked healthy or failed (`api/src/scheduled-health-checks.js` lines 30 and 36) |
| Failover reaching users | **Broken** | The cron job writes the new status to D1 only, but the redirector reads status from KV; the older `health-check.js` that did update KV is not wired in |
| Link creation | **Likely broken** | `createLink` inserts into a D1 column `primary_url`, and the list endpoint reads `url` and `fallback_1..3` from D1, but `schema.sql` and the migrations define none of these columns; the KV write happens first, so a failed insert would leave an orphaned redirect (unless the live database was changed by hand) |
| Snippet and plugin to API | **Broken contract** | The snippet sends `X-API-Key` (the API reads `Authorization: Bearer`), sends `fallback_urls` (API expects `fallbackUrls`) and reads `short_url` (API returns `shortUrl`); it also places the account API key in public page JavaScript |
| Affiliate value of fallbacks | **Flawed by design** | Generated fallbacks (Amazon search, retailer homepage) drop the affiliate tag, so failover loses the commission it was meant to protect; a HEAD-only 2xx check also misses "currently unavailable" product pages that return 200 |
| Analytics | Stubbed | Human/bot split is a hardcoded 80/20 estimate; per-link analytics returns zeros; countries and daily trends are TODO |
| Billing and plan limits | Not built | See above |
| Dashboard auth | Fragmented | README admits NextAuth sessions and API tokens do not line up; demo provider returns a fixed user |
| Tests | Partial | Playwright accessibility tests in `app/`, assorted API tests; no evidence the API suite runs against the MVP entry point |

Bottom line: a lot of surface area (security, GDPR, QR, webhooks) around a core loop that does not close.
None of it is worth porting except the general idea and a few patterns (KV for hot redirect lookups, cron-driven checks).

## 2. Landing page review (`landing/`)

The owner already thinks it needs redoing; that is correct, and the reasons go beyond design.

### Positioning and headline

- Headline: "Turn Dead Links Into Revenue Streams", sub: "Our AI-powered switchboard automatically redirects broken links to relevant content while you earn passive income."
- This positions the product as an ad network for 404 traffic.
The product does not do that, and the model is a bad idea: visitors who wanted page X and get sent to an advertiser feel tricked, Google's spam policies treat redirecting users to something other than what they asked for as sneaky redirects, and publishers will not risk rankings for cents.
- It also contradicts itself: "AI continuously scans your site for dead links" (nothing scans a site), "matched with relevant advertisers" (no advertisers), "301 redirects" (they are 302).

### Value proposition

Unclear who it is for (blogs, "publishers", "large organizations") and what pain it removes.
The real, sellable pains are "I lost Google traffic after my redesign", "my affiliate links quietly died", and "my docs link to pages that moved", and none of them appears.

### Social proof

All of it is invented: "Trusted by 10,000+ websites", "50M+ links processed", "$2M+ earned by publishers", "99.9% uptime SLA", "340% average ROI", three named testimonials with revenue figures.
Since October 21, 2024 the FTC rule on consumer reviews and testimonials (16 CFR Part 465) allows civil penalties of roughly $52,000 per violation for fake testimonials and fake social-proof indicators ([FTC press release](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials); [Hunton summary](https://hunton.com/hunton-retail-law-resource/ftc-issues-final-rule-targeting-fake-consumer-reviews-and-testimonials-including-those-generated-by-artificial-intelligence-ai-and-online-bots)).
This page must never be deployed as is.

### Pricing section

- Three tiers with revenue shares (70/80/90%), payout cadences and a "$10 minimum payout" in the FAQ, for a revenue engine that does not exist.
- "Up to 1,000 dead links" on the free plan does not match the 100-link limit in the schema.
- "14-day trial", "30-day money-back guarantee", "SLA guarantee": promises with no billing system behind them.

### Calls to action

Every CTA ("Start Free Trial", "See How It Works", "Start Free", "Contact Sales", the nav button) is a `<button>` with no `href` or `onClick`.
Nothing on the page leads anywhere.
All 18 footer links and the social icons point to `#`, including Privacy Policy and Terms.

### Design quality

- Generic 2023 SaaS template: Inter, blue `#2563EB` and green, centered hero, three stat counters, browser-chrome mockup, 3x3 icon grid, three pricing cards, testimonial cards, FAQ accordion.
Nothing about it is memorable or specific to links.
- The hero mockup ("404 Error Detected" then "Redirected & Monetized! you earn $$$") is the best idea on the page, because it shows the before and after, but it shows the wrong after.
- Every section is a client component, and nearly every block starts at `opacity: 0` until Framer Motion hydrates, which delays visible content (LCP) and shows a blank page if JavaScript fails.
- Mobile layout is reasonable (Tailwind grids collapse), and the nav does smooth scrolling to anchors.

### SEO

- Title and description exist and target "monetize broken links", a keyword with little buyer intent; the real intent terms are "broken link checker", "404 redirect", "fix 404 errors", "redirect map", "affiliate link checker".
- No Open Graph image, no `robots.txt`, no sitemap, no canonical, no structured data, no `metadataBase`, no favicon in `landing/`.
- One page, no content: no free tool, no guides, no comparisons, which is how every competitor in this space earns its traffic (Ahrefs, Dr. Link Check and Screaming Frog all rank on free tools and how-to content).

### Keep vs redo

| Keep | Redo |
|---|---|
| The before/after hero demo concept | Positioning: from "earn from 404s" to "never lose a visitor or a ranking to a broken link" |
| Section order (hero, how it works, features, pricing, FAQ) as a skeleton | Every number, testimonial and logo: remove until real |
| Anchor-scroll navigation | Every CTA: real links to a free scan and to signup |
| Tailwind and component structure | Pricing: tied to real, enforced limits; no revenue share |
| | Animation: render content server-side, animate only decoration |
| | SEO: free scanner page as the main entry, OG image, sitemap, legal pages that exist |

## 3. Competitor landscape

Prices are monthly in USD unless noted.

| Product | Category | What it does | Pricing | Target customer | Traction signals |
|---|---|---|---|---|---|
| Google Search Console | Detection | Reports crawled 404s and soft 404s for verified sites | Free | Every site owner | Default tool; sets the price expectation for detection at $0 |
| Ahrefs Site Audit | Detection (suite) | Full technical crawl incl. broken internal and external links; free tier for verified sites | Free tier; Starter $29, Lite $129, Standard $249, Advanced $449 (third-party, unverified) | SEO teams, agencies | Category leader in SEO tooling ([seo.com](https://www.seo.com/blog/ahrefs-pricing/), [Capterra](https://www.capterra.com/p/176340/Ahrefs/pricing/)) |
| Semrush Site Audit | Detection (suite) | Crawl audit up to 100k pages per audit on Pro | Pro $139.95, Guru $249.95, Business $499.95 (third-party, unverified) | Agencies, in-house SEO | Public company; very large customer base ([docket.io](https://docket.io/resources/research/semrush-pricing)) |
| Screaming Frog SEO Spider | Detection (desktop) | Desktop crawler; broken links, redirect chains, migration audits | Free to 500 URLs; £199/year (vendor page) | Technical SEOs, agencies | Industry standard crawler ([pricing](https://www.screamingfrog.co.uk/seo-spider/pricing/)) |
| Sitebulb | Detection (desktop/cloud) | Crawler with prioritized hints | Lite $18, Pro $42 per user; Cloud from about $245 (third-party, unverified) | Agencies | Strong agency following ([Capterra](https://www.capterra.com/p/169089/Sitebulb/pricing/)) |
| Dr. Link Check | Detection (SaaS) | Scheduled link checks with email alerts | Lite $0 (2 sites, 1,500 links, one-time checks), Standard $13, Professional $49, Premium $159 (vendor page) | Small sites, webmasters | Long-running niche SaaS with Shopify app ([pricing](https://www.drlinkcheck.com/pricing)) |
| Broken Link Checker (WPMU DEV) | Detection (WordPress) | Plugin with local and cloud engines | Free (cloud engine needs free WPMU DEV account) | WordPress owners | 50,000+ active installs, 650k+ downloads ([WPMU DEV](https://wpmudev.com/broken-link-checker/)) |
| Oh Dear | Monitoring | Uptime, broken links and mixed content, SSL, DNS, cron, status pages | Solo $17 (2 sites) to Scale $439 (200 sites); all features on all plans (vendor page) | Developers, agencies | Well-regarded indie SaaS ([pricing](https://ohdear.app/pricing)) |
| Little Warden | Monitoring | 30+ checks: domain expiry, robots.txt, redirect breaking, tags | £24.99 (20 URLs) to £149.99 (5,000 URLs) (vendor page) | SEO agencies | Niche agency tool ([pricing](https://littlewarden.com/pricing)) |
| Linkody | Backlink monitoring | Watches backlinks pointing to you; alerts when removed or broken | From about $14.90 (third-party, unverified) | Link builders | Small niche tool ([Software Advice](https://www.softwareadvice.com/product/459626-Linkody/)) |
| Bitly | Link management | Short links, QR codes, analytics | Core about $10 (annual), Growth $29-35, Premium $199-300 (third-party, unverified) | Marketers, enterprises | Market leader ([linklyhq](https://linklyhq.com/review/bitly)) |
| Rebrandly | Link management | Branded short links, custom domains | Free; Essentials about $11, Professional about $32, Growth about $99 (third-party, unverified) | Brands, marketers | Established ([FrontDesk Review](https://frontdeskreview.com/software/link-shorteners/rebrandly/)) |
| Short.io | Link management | Branded links on custom domains | Free (1,000 links); paid $5 to $148 (third-party, unverified) | SMBs | Cheap entry ([toolradar](https://toolradar.com/tools/short-io/pricing)) |
| Dub | Link management (open source) | Short links plus conversion and partner/affiliate attribution | Business $81, Advanced $270, Enterprise custom; 14-day trial, no free plan listed (vendor page) | Startups, partner programs | Open-source darling that moved upmarket into affiliate programs ([pricing](https://dub.co/pricing)) |
| Redirect.pizza | Redirect hosting | Domain and path redirects on an edge network, HTTPS, API, MCP server | Free (5 hostnames, 250k hits, 10 path rules); Basic, Pro, Business, Enterprise (vendor page lists limits, not prices; third-party says from €14.95) | Agencies, migrations | Profitable-looking indie SaaS ([pricing](https://redirect.pizza/pricing), [Capterra](https://www.capterra.com/p/231009/redirectpizza/pricing/)) |
| redirection.io | Redirect hosting | Redirect rules, traffic logs, redirect-mapping tool for migrations | Free (10 rules); Starter and Pro priced by rule count | Large sites, agencies | Used for migrations ([docs](https://redirection.io/documentation/user-documentation/how-much-does-it-cost)) |
| Rank Math / Yoast | Redirects (WordPress) | Redirect managers; Rank Math has a free 404 monitor, Yoast keeps redirects in Premium | Rank Math free, Pro about $84/year; Yoast Premium about $99/year (third-party, unverified) | WordPress owners | Millions of installs; makes 404 logging free on WordPress ([nexterwp](https://nexterwp.com/blog/rank-math-vs-yoast/)) |
| Cloudflare Bulk Redirects / Vercel / Netlify | Redirects (platform) | Static URL-to-URL redirect lists at the edge or in config | Cloudflare free plan raised to 10,000 bulk redirect URLs in Feb 2025 ([changelog](https://developers.cloudflare.com/changelog/post/2025-02-12-rules-upgraded-limits/)); Vercel/Netlify redirects are free config (not verified) | Developers | Free and built in, but static: no detection, no suggestions |
| Lasso | Affiliate link health | WordPress affiliate plugin; alerts on broken links and out-of-stock Amazon products | $249/year 1 site to $499/year 5 sites (third-party, unverified) | Affiliate bloggers | Proves affiliates pay for link health ([Lasso](https://getlasso.co/vs/geniuslink/)) |
| AI 404 redirect plugins | Auto-fix 404 | AI 404 Redirect, Nandann AI Smart 404, Smart 404 Redirect (local matching, one-click 301) | Free plugins | WordPress owners | Tiny (AI 404 Redirect about 275 downloads) ([wordpress.org](https://wordpress.org/plugins/ai-404-redirect)) |
| AI redirect mappers | Migration | Routifyy, Flexmade Redirectify, redirection.io mapping | Per credit (Routifyy about $9 per credit, unverified) | Agencies doing migrations | Early, small ([Search Engine Land](https://searchengineland.com/site-migrations-ai-powered-redirect-mapping-437793)) |
| InternetArchiveBot | Outbound link rot repair | Replaces dead citations on Wikipedia with Wayback copies via the Availability API | Free, non-commercial | Wikipedia | Millions of links fixed ([Internet Archive](https://blog.archive.org/2016/10/26/more-than-1-million-formerly-broken-links-in-english-wikipedia-updated-to-archived-versions-from-the-wayback-machine/), [MediaWiki](https://www.mediawiki.org/wiki/Archived_Pages)) |

### Top five that matter for any relaunch

1. **Google Search Console** - free 404 reporting sets the price of detection at zero.
2. **Rank Math (free 404 monitor + redirects)** - on WordPress, detect-and-redirect is already free.
3. **Redirect.pizza** - the closest "redirects as a service" competitor, generous free tier, edge network, API and MCP server.
4. **Oh Dear** - bundles broken-link crawling with uptime, SSL and DNS for $17 a month, which is how small buyers actually want it.
5. **Dub** - open-source link management that has already climbed into affiliate attribution, the niche deadlink's code was aimed at.

## 4. Market and disruption analysis

### Who pays for dead-link fixing

- **SEO agencies**: pay for crawlers and monitors ($15 to $450 a month) and pay most during **site migrations**, where lost URLs mean lost rankings.
Willingness to pay is real but the tools they already own cover detection; the manual work is building and maintaining redirect maps.
- **Ecommerce**: discontinued products create 404s constantly; platforms (Shopify) handle redirects but not matching.
Pain is high on large catalogs, low on small shops.
- **Affiliate publishers**: link rot directly costs commission; Lasso at $249+/year proves willingness to pay.
But Amazon's rules on cloaking and automatic redirects make third-party redirect layers risky ([Amazon Associates help](https://affiliate-program.amazon.com/help/node/topic/GVFBVT6N73NTC933); [Geniuslink on Amazon compliance](https://geniuslink.com/amazon-safe)).
- **Publishers and docs sites**: outbound links rot fast.
Pew found 38% of pages from 2013 were gone by 2023, 23% of news pages and 21% of government pages contain at least one broken link, and 54% of Wikipedia pages have a dead reference link ([Pew Research, 2024](https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/)).
The Internet Archive estimates the Wayback Machine holds copies of about 15% of those dead pages ([dshr summary](https://blog.dshr.org/2024/05/pew-research-on-link-rot.html)).
- **Local service businesses** (Tech for Pros customers): do not know they have broken links and will not buy a tool, but they lose calls when an old Google-indexed URL or a Yelp/Google Business Profile link 404s after a site rebuild.
They will pay for a website service that guarantees it does not happen.

### Size signals

No credible standalone market-size figure for "dead link fixing" was found (unverified; most published numbers are for the broader SEO software category).
The useful signals are price points: detection is a $0 to $50 feature, monitoring bundles sell at $17 to $165 for small and agency tiers, migration help is a one-off agency line item, and affiliate link health sells at roughly $20 a month.
That shape says feature, not company, unless you own a channel.

### Where incumbents are weak

1. **Live, automatic fixing.**
Everyone detects; almost nobody fixes at request time.
Crawlers report, WordPress plugins log 404s and wait for a human, Cloudflare and Vercel redirects are static lists.
The AI 404 plugins exist but are WordPress-only, tiny and run in PHP after the request reached the origin.
A search for products doing live 404 interception with automatic redirects at the edge found none (unverified absence).
2. **Migrations for small sites.**
Agencies use Screaming Frog plus spreadsheets; small-business site rebuilds (Wix or GoDaddy to anything) usually ship with no redirect map at all.
3. **Outbound link rot.**
Monitors flag broken external links, but nobody repairs them for normal sites; the InternetArchiveBot pattern (swap in an archived copy, or suggest the moved page) is proven on Wikipedia and absent from commercial tools.
4. **Non-WordPress small sites.**
The free tooling clusters on WordPress; static and headless sites on Cloudflare, Vercel or Netlify get static redirect files and nothing else.

### The 2026 disruption angle

**An edge 404 safety net:** a Cloudflare Worker in front of the site that, on any 404, looks up the request path against an embedding index (Workers AI embeddings + Vectorize) of the site's own sitemap and titles, redirects with a 301 when confidence is high, shows a helpful "did you mean" page when it is not, and logs every miss for one-click approval into a permanent rule.
Add the InternetArchiveBot trick for outbound links (a scheduled job that finds dead outbound links and proposes the moved page or a Wayback copy) and a free public scanner as the top of the funnel.

Why it is hard to copy for incumbents: crawler vendors do not sit in the request path, redirect hosts do not know the site's content, and WordPress plugins cannot run at the edge.
Why it is easy to copy for platforms: Cloudflare, Vercel or Netlify could ship it as a toggle at any time, and Redirect.pizza or redirection.io could bolt on AI matching.
That platform risk is the main reason not to build it as a standalone company.

### Fit with Tech for Pros

This is where the idea is strongest.
Tech for Pros builds free websites for local service businesses on Cloudflare, so:

- **Migration redirect map at onboarding**: when a business moves from its old site, crawl the old URLs (and the URLs Google has indexed), auto-match them to the new pages, and deploy 301s on day one.
Sales line: "We move your site without losing your Google rankings."
- **Edge 404 safety net on every customer site**: one shared Worker route, near-zero marginal cost, per-site embedding index rebuilt on publish.
- **Monthly "site health" email**: broken outbound links (old supplier sites, dead review links), fixed 404s and calls saved; a retention and upsell touchpoint for paid tiers.
- **Free scanner as lead magnet**: "Is your website losing customers? Free 30-second check" on techforpros.com, which scans a prospect's current site for broken links, missing redirects, slow pages and no-HTTPS, then pitches the free site.
This turns deadlink's best idea into pipeline for the business that already exists.

## 5. Risks

- **Platform risk**: Cloudflare, Vercel, Netlify or Shopify can ship automatic 404 matching natively.
As a Tech for Pros feature this barely matters; as a standalone product it is fatal.
- **Wrong redirects**: AI matches that send users to an irrelevant page create soft-404 signals for Google and annoy visitors; require a confidence threshold, fall back to a "did you mean" page, and keep a human approval queue.
- **SEO policy**: any redirect that sends users somewhere other than the closest equivalent content (the original monetization idea) risks sneaky-redirect penalties; the relaunch must never redirect for revenue.
- **Affiliate programs**: Amazon forbids automatic redirects to Amazon and cloaking that hides the destination; stay out of affiliate link rewriting unless you build it with a program's explicit blessing.
- **Fake social proof**: the current landing page's testimonials and stats would violate the FTC rule; delete them before any deploy.
- **Crawling and checking at scale**: HEAD-only checks are unreliable (many sites reject HEAD or bots, soft 404s return 200); use GET with limits, respect robots.txt, cache results, and treat "blocked" separately from "dead".
- **Owner focus**: Tech for Pros is the active business; a second standalone SaaS splits attention for a market with low willingness to pay.

## 6. Relaunch plan (as a Tech for Pros feature)

A standalone relaunch is not recommended.
If the owner still wants one later, the same build below can be exposed as a product for any Cloudflare site, and that option is noted at the end.

### Positioning

- Inside Tech for Pros: "We move your website without losing your Google rankings, and we fix broken links before your customers find them."
- Lead magnet: "Free website check: find the broken links and missing pages costing you calls."

### MVP scope (in order)

1. **Free scanner page** on techforpros.com: enter a URL, a Worker crawls up to about 200 pages with GET (Browser Rendering only where needed), and reports broken internal and outbound links, missing HTTPS, slow pages and missing titles; results page with a "Get a free website that fixes this" CTA and optional email capture.
2. **Migration redirect mapper** in the onboarding flow: collect old URLs (crawl, old sitemap, and Search Console export when the owner connects it), embed old and new pages, propose 301s with confidence scores, owner or staff approve, deploy as per-site rules in KV.
3. **Edge 404 safety net** on all customer sites: on 404, match against the site's Vectorize index; high confidence redirects with 301 and logs, low confidence renders a branded "did you mean" page; misses feed an admin approval queue.
4. **Monthly site health report** in the existing follow-up engine (Resend): fixed 404s, broken outbound links with suggested replacements (moved page or Wayback copy via the Availability API), and a call to action.

Out of scope: short links, QR codes, affiliate link rewriting, ad monetization, separate billing, separate auth, WordPress plugin.

### Pricing

- Scanner: free, always.
- Redirect mapping at migration: included free (it is a sales argument, not a revenue line).
- Edge safety net: included on every plan (marginal cost is a few Worker invocations and embeddings per 404).
- Health report with suggested fixes: included in the paid care tier; the "we fixed it for you" version sits in the top tier.
- If ever offered standalone to non-Tech for Pros sites on Cloudflare: free up to 1 site and 1,000 404s a month, about $9 a month per site, about $49 a month for 25 sites (agency), positioned against Oh Dear's $17 and Redirect.pizza's free tier; validate demand with the free scanner traffic before building billing.

### Stack

- Next.js 16.4 with Turbopack for the scanner page and admin approval UI, inside the existing Tech for Pros monorepo, deployed on Cloudflare via OpenNext.
- Cloudflare Workers for the 404 handler, the crawler and scheduled checks (Cron Triggers, Queues for crawl fan-out).
- KV for hot redirect rules, D1 for 404 logs, approvals and scan results, Vectorize plus Workers AI embeddings for page matching, Browser Rendering only for JavaScript-heavy pages.
- Internet Archive Wayback Availability API for archived copies of dead outbound links.
- Turnstile on the public scanner to prevent abuse, and per-IP rate limits.

### Milestones

1. Week 1: scanner Worker and public results page; ship it on techforpros.com as the lead magnet.
2. Weeks 2 to 3: migration mapper in onboarding, used on the next real customer move.
3. Week 4: edge 404 safety net behind a flag on two customer sites; tune confidence thresholds on real traffic.
4. Week 5: monthly health report; then decide whether external demand from the scanner justifies a standalone tier.

### What to do with this repo

Keep it archived.
Nothing here should be ported: the core loop is broken, the auth is split, there is no billing, and the landing page is unusable.
The reusable assets are ideas: KV for redirect lookups, cron-driven checks, and the before/after hero demo.

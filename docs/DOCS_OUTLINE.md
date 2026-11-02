# Relink: Public Documentation Outline

Written 2026-11-01.
The product's working name is Relink (decided 2026-11-01; fallbacks in `PRODUCT.md` section 6).
This is the planned structure of the public docs site.
Nothing here is written yet; each page has a one-line description of what it must answer.
Pages marked (MVP) ship with the first milestone; the rest ship with the feature they document.

## 1. Getting started

| Page | Description |
|---|---|
| Introduction (MVP) | What Relink does, the never-redirect-for-revenue principle, and how hosted and self-host differ. |
| How it works (MVP) | The request path: origin 404, match against your content index, redirect or did-you-mean page, approval queue. |
| Quickstart: hosted (MVP) | Sign up, add a site, connect Cloudflare, wait for the first index, and see your first caught 404 in about ten minutes. |
| Quickstart: self-host (MVP) | Clone, configure `wrangler.jsonc`, create the Cloudflare resources with one command, deploy, open the dashboard. |
| Concepts and glossary (MVP) | Sites, routes, the content index, matches, confidence, rules, the queue, soft 404s, caught 404s. |

## 2. Self-host guide (Cloudflare)

| Page | Description |
|---|---|
| Requirements | Cloudflare plan, proxied DNS, which products are used (Workers, KV, D1, Vectorize, Workers AI, Queues, R2) and expected cost. |
| Install with the setup CLI | What the planned `npx getrelink init` creates, and how to do every step by hand instead. |
| Configuration reference | Every variable and binding in `wrangler.jsonc`, with defaults and safe values. |
| Dashboard and admin access | Protecting the dashboard with Cloudflare Access or the built-in single-admin login. |
| Email and alerts | Wiring Resend, Email Workers or SMTP for reports and alerts. |
| Upgrading | Pulling a new release, running D1 migrations, and rolling back. |
| Backups and data export | Exporting rules, the queue and logs; restoring into a new account. |
| Running behind other proxies | Using the backend without the edge Worker for sites not on Cloudflare. |
| Troubleshooting | Common errors: route not matching, Vectorize index empty, Workers AI limits, redirect loops. |

## 3. The edge Worker

| Page | Description |
|---|---|
| Worker setup (MVP) | Adding the Worker to a zone route, ordering with other Workers, and verifying it passes traffic through. |
| What counts as a 404 | Status codes handled, soft 404 detection by title or body pattern, and how to opt paths in or out. |
| Matching and confidence (MVP) | Signals used (URL tokens, slug distance, embeddings), how the score is built, and how to set the threshold. |
| Redirect behavior | 302 while pending, 301 once approved, query string handling, trailing slashes, and loop protection. |
| The did-you-mean page (MVP) | What it shows, why it returns a 404 status, theming, custom templates and translations. |
| Safety rails (MVP) | Same-domain only, excluded methods and paths, rate limits on automatic rules, and one-click rollback. |
| Performance and limits | Added latency on normal requests (none beyond a pass-through), cost per caught 404, caching. |

## 4. Using the dashboard

| Page | Description |
|---|---|
| The approval queue (MVP) | Reviewing matches, approving, editing or rejecting, bulk actions, and auto-approval settings. |
| Rules | Exact, prefix and pattern rules, priorities, import and export (CSV, `_redirects`). |
| Content index | When the site is crawled, which pages are included, excluding pages, and forcing a re-index. |
| Outbound link repair | Reading the broken outbound links report and using suggested Wayback snapshots. |
| Monitoring and alerts | Scheduled crawls, uptime and certificate checks, alert channels and thresholds. |
| Reports | Weekly and monthly reports, recipients, and white-label options on Team. |
| Team and roles | Inviting teammates, roles, and API keys. |

## 5. Migrations guide

| Page | Description |
|---|---|
| Planning a site migration | Why redirects protect rankings, and the checklist before, during and after launch. |
| Collecting old URLs | Crawling the old site, old sitemaps, Search Console exports and server logs. |
| Generating the redirect map | How old and new pages are matched, reading confidence scores, and fixing low-confidence rows. |
| Deploying the map | Serving it from the Worker, or exporting to Cloudflare Bulk Redirects, Vercel, Netlify, Nginx or Apache. |
| After launch | The 30-day watch, daily reports of missed URLs, and when to retire rules. |
| Platform notes | Moving from Wix, Squarespace, GoDaddy and WordPress: URL patterns to expect. |

## 6. Integrations

| Page | Description |
|---|---|
| Cloudflare (MVP) | One-click deploy, permissions requested, and removing Relink cleanly. |
| Next.js | Middleware and `not-found.tsx` helpers that call the match API and redirect server-side. |
| WordPress | Installing the plugin, how it hooks the 404 template, and outbound link repair in posts. |
| Embed script | Adding did-you-mean suggestions to any existing 404 page with one script tag. |
| Netlify, Vercel and other edges | Edge function adapters using the match API. |
| Webhooks | Events, payloads, HMAC signature verification and retries. |
| Slack and Discord | Connecting alert channels. |

## 7. API reference

| Page | Description |
|---|---|
| Overview and authentication | Base URL, API keys per site, scopes, rate limits, pagination and errors. |
| Sites | Create, list, update and delete sites; trigger a re-index. |
| Match | `GET /v1/sites/:id/match?path=` returns ranked candidates with confidence; the endpoint behind every integration. |
| Rules | CRUD, bulk import and export. |
| Queue | List, approve, reject and edit pending matches. |
| Scans | Start a scan, poll status, fetch results. |
| Events and logs | Caught 404s, redirects served and misses, with filters. |
| OpenAPI spec | Downloadable spec and generated SDK notes. |

## 8. Security and privacy

| Page | Description |
|---|---|
| Security overview (MVP) | Architecture, tenant isolation, encryption, secrets handling, and how to report a vulnerability. |
| What data we collect (MVP) | Request path, referrer, user agent class and country per caught 404; no cookies; IPs are not stored. |
| Data retention and deletion | Default retention windows, export, account deletion. |
| GDPR and DPA | Roles (controller and processor), subprocessors (Cloudflare, email, payments), and the DPA. |
| SEO safety | Why the did-you-mean page is a 404, why we never redirect off-site or for revenue, and how approvals work. |
| Crawler behavior | User agent, robots.txt handling, rate limits, and how site owners can block or allow the scanner. |

## 9. Pricing and account FAQ

| Page | Description |
|---|---|
| Plans and limits | What each tier includes and what a caught 404 is. |
| Overages | What happens at the limit (existing rules keep working, no visitor-facing errors). |
| Billing | Payment methods, invoices, upgrades, downgrades and cancellation. |
| Self-host vs hosted | Which to choose, costs on your own Cloudflare account, and moving between them. |
| Open-source license | What AGPL-3.0 means for you, and why SDKs and plugins are MIT. |

## 10. Project

| Page | Description |
|---|---|
| Roadmap | Public status of every feature, matching the labels on the landing page. |
| Changelog | Generated from releases. |
| Contributing | Local development, tests, code style, and the contributor license terms. |
| Comparisons | Factual pages vs Oh Dear, Dub, Redirect.pizza, Rank Math and Search Console, with sources and dates. |

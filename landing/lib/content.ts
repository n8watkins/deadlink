/**
 * Landing page copy. Every claim here must match docs/PRODUCT.md.
 * Status labels describe the plan, not shipped software: nothing is live yet.
 */

export type Status = "MVP" | "Beta" | "Later";

export const statusHelp: Record<Status, string> = {
  MVP: "Planned for the first release",
  Beta: "Planned for the hosted beta",
  Later: "Planned after the beta",
};

export const steps = [
  {
    title: "Put Relink in front of your site",
    body: "Add the Worker to your Cloudflare zone with one click, or run it on your own account. Normal requests pass straight through to your site.",
    detail: "Not on Cloudflare? Next.js and WordPress integrations will call the same match API.",
  },
  {
    title: "It learns your site",
    body: "Relink reads your sitemap and internal links, then builds an index of every live page from its URL, title and headings.",
    detail: "The index lives in Cloudflare Vectorize and refreshes when your site changes.",
  },
  {
    title: "Every 404 gets a second chance",
    body: "When a visitor hits a missing page, Relink finds the page they meant. Confident matches redirect; the rest get a helpful \"did you mean\" page.",
    detail: "Each match waits in your approval queue. One click turns it into a permanent 301.",
  },
] as const;

export type Feature = { title: string; body: string; status: Status };
export type FeatureGroup = { id: string; title: string; lede: string; features: Feature[] };

export const featureGroups: FeatureGroup[] = [
  {
    id: "core",
    title: "The 404 safety net",
    lede: "The part nobody else does: fixing broken visits while they happen, at the edge.",
    features: [
      {
        title: "Live 404 interception",
        body: "A Cloudflare Worker sees your origin's 404s and soft 404s before the visitor does.",
        status: "MVP",
      },
      {
        title: "Matching on your own content",
        body: "URL tokens, slug similarity and AI embeddings of your pages rank the most likely destination.",
        status: "MVP",
      },
      {
        title: "Confident redirects only",
        body: "Above your threshold: a temporary redirect while pending, a 301 once you approve it.",
        status: "MVP",
      },
      {
        title: "\"Did you mean\" page",
        body: "Below it: a fast, branded page with the best matches. It keeps an honest 404 status for search engines.",
        status: "MVP",
      },
      {
        title: "One-click approval queue",
        body: "Matches and misses grouped by path with hit counts and referrers. Approve, edit or reject.",
        status: "MVP",
      },
      {
        title: "Safety rails",
        body: "Same domain only, no POST or API paths, excluded patterns, rate-limited automation and instant rollback.",
        status: "MVP",
      },
    ],
  },
  {
    id: "link-rot",
    title: "Link rot repair",
    lede: "The pages you link to disappear too. Relink finds them and proposes a fix.",
    features: [
      {
        title: "Outbound link checks",
        body: "Scheduled checks of every external link, telling dead links apart from sites that only block bots.",
        status: "Beta",
      },
      {
        title: "Wayback Machine snapshots",
        body: "For a dead outbound link, Relink proposes the closest archived copy from the Internet Archive.",
        status: "Beta",
      },
      {
        title: "Moved-page detection",
        body: "Before falling back to an archive, look for the page's new home on the same site.",
        status: "Later",
      },
    ],
  },
  {
    id: "migrations",
    title: "Migrations",
    lede: "Rebuilding or moving a site is when most broken links are born.",
    features: [
      {
        title: "Redirect map generator",
        body: "Old URLs from a crawl, sitemap or Search Console export, matched to new pages with confidence scores.",
        status: "Beta",
      },
      {
        title: "Deploy anywhere",
        body: "Serve the map from the Worker, or export it for Cloudflare Bulk Redirects, Vercel, Netlify, Nginx or Apache.",
        status: "Beta",
      },
      {
        title: "30-day launch watch",
        body: "After cutover, the safety net catches what the map missed and reports it daily.",
        status: "Beta",
      },
    ],
  },
  {
    id: "monitoring",
    title: "Monitoring and alerts",
    lede: "Know what broke, what was already fixed, and what needs you.",
    features: [
      {
        title: "Free \"Is your site broken?\" scanner",
        body: "Enter a URL and get broken links, redirect chains, missing HTTPS and missing titles. No account needed.",
        status: "MVP",
      },
      {
        title: "Scheduled crawls",
        body: "Daily or weekly crawls for broken internal links and redirect chains.",
        status: "Beta",
      },
      {
        title: "Uptime and certificate checks",
        body: "Basic availability and SSL expiry alerts for each connected site.",
        status: "Beta",
      },
      {
        title: "Alerts and reports",
        body: "Email, Slack and webhooks for spikes in new 404s, plus a weekly summary you can forward.",
        status: "Beta",
      },
    ],
  },
  {
    id: "integrations",
    title: "Link management and integrations",
    lede: "One rules engine and one API behind every way of connecting.",
    features: [
      {
        title: "Redirect rules",
        body: "Exact, prefix and pattern rules with import and export as CSV or _redirects files.",
        status: "MVP",
      },
      {
        title: "REST API and match endpoint",
        body: "Ask Relink for the best page for any missing path, from any stack.",
        status: "Beta",
      },
      {
        title: "Next.js, WordPress and embeds",
        body: "Server-side helpers, a 404-template plugin and a script tag for any existing 404 page.",
        status: "Later",
      },
    ],
  },
];

export type Cell = boolean | string;
export const comparison: { row: string; relink: Cell; ohdear: Cell; dub: Cell }[] = [
  { row: "Open source", relink: "AGPL-3.0", ohdear: false, dub: "AGPL-3.0 core" },
  { row: "Self-hostable", relink: true, ohdear: false, dub: true },
  { row: "Catches 404s live and fixes them", relink: true, ohdear: false, dub: false },
  { row: "Matches a missing URL to the right page", relink: true, ohdear: false, dub: false },
  { row: "Approval queue for fixes", relink: true, ohdear: false, dub: false },
  { row: "Broken link crawl", relink: true, ohdear: true, dub: false },
  { row: "Outbound link repair via Wayback", relink: true, ohdear: false, dub: false },
  { row: "Migration redirect map", relink: true, ohdear: false, dub: false },
  { row: "Uptime and SSL monitoring", relink: "Basic", ohdear: "Extensive", dub: false },
  { row: "Short links and conversion analytics", relink: "Basic rules", ohdear: false, dub: "Core strength" },
  { row: "Free plan", relink: true, ohdear: "10-day trial", dub: "14-day trial" },
  { row: "Entry price per month", relink: "$12 (planned)", ohdear: "$17, 2 sites", dub: "$81" },
];

export const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "For a personal site or trying it out.",
    features: [
      "1 site",
      "1,000 caught 404s a month",
      "Up to 500 indexed pages",
      "Did-you-mean page and approval queue",
      "Weekly crawl",
      "Community support",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    cadence: "per month",
    blurb: "For developers and small businesses.",
    features: [
      "3 sites",
      "50,000 caught 404s a month",
      "5,000 pages per site",
      "Outbound link repair with Wayback",
      "Migration redirect maps",
      "Uptime and SSL alerts, API access",
    ],
    highlight: true,
  },
  {
    name: "Team",
    price: "$49",
    cadence: "per month",
    blurb: "For agencies and content teams.",
    features: [
      "25 sites and 5 seats",
      "500,000 caught 404s a month",
      "25,000 pages per site",
      "White-label page and client reports",
      "Slack and webhook alerts",
      "Priority support",
    ],
    highlight: false,
  },
  {
    name: "Self-host",
    price: "$0",
    cadence: "AGPL-3.0",
    blurb: "Run everything on your own Cloudflare account.",
    features: [
      "Unlimited sites",
      "The full core, not a demo",
      "Your data never leaves your account",
      "You pay Cloudflare directly",
      "Upgrade with git pull and deploy",
      "Community support",
    ],
    highlight: false,
  },
] as const;

export const faqs = [
  {
    q: "Can I use Relink today?",
    a: "Not yet. Relink is being built from scratch and this page describes what we are building. Every feature is labelled with the release it is planned for. Join the waitlist on n8builds.dev to hear when the first version is ready.",
  },
  {
    q: "What ships first: self-host or hosted?",
    a: "Self-host. The first public release is the open-source edition you run on your own Cloudflare account. The hosted beta follows once the self-host release has proven the matching on real sites.",
  },
  {
    q: "Will automatic redirects hurt my SEO?",
    a: "They are designed not to. Relink only redirects to the closest equivalent page on your own site, uses a temporary redirect until you approve a match, and shows low-confidence visitors a did-you-mean page that keeps a real 404 status. It never redirects to another domain or for advertising.",
  },
  {
    q: "Does my site need to be on Cloudflare?",
    a: "For the edge Worker, yes: your domain needs to be proxied through Cloudflare (the free plan works). For other hosts we plan Next.js and WordPress integrations and an embed script that use the same match API.",
  },
  {
    q: "How is this different from Google Search Console or Rank Math?",
    a: "Search Console reports the 404s Googlebot found, days later. Rank Math logs 404s on WordPress and waits for you to write each redirect. Relink works on any site behind Cloudflare, catches real visitors as it happens, suggests the right page and lets you approve it in one click.",
  },
  {
    q: "What does open source mean here?",
    a: "The core (Worker, matching, dashboard and API) will be published under AGPL-3.0 so you can read, run and modify it. Client libraries and plugins will be MIT. The hosted service runs the same code and charges for convenience, scale and support.",
  },
  {
    q: "What data does Relink collect from my visitors?",
    a: "For each caught 404: the requested path, referrer, a browser-or-bot classification and country. No cookies, and IP addresses are not stored. Self-hosting keeps everything in your own Cloudflare account.",
  },
  {
    q: "Is the pricing final?",
    a: "No. The tiers on this page are our current plan and may change before launch. Nothing is billable today, and the hosted beta will be free.",
  },
  {
    q: "Do you make money from my 404 traffic?",
    a: "No, never. Relink grew out of an earlier project called deadlink, which explored monetizing dead links. We dropped that idea completely: it is bad for visitors and risky for your rankings. You pay for the product, or self-host it for free.",
  },
] as const;

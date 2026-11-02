/**
 * Site-wide settings. Relink is the working product name (fallbacks are
 * listed in docs/PRODUCT.md section 6). The site is live at
 * https://relink.n8builds.dev until Relink gets its own domain;
 * NEXT_PUBLIC_SITE_URL can override the canonical URL at build time.
 */
export const site = {
  name: "Relink",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://relink.n8builds.dev").replace(/\/$/, ""),
  title: "Relink: the open-source 404 safety net",
  description:
    "Relink catches broken links the moment a visitor hits them, sends them to the page they meant using your own content, and turns each fix into a permanent redirect with one click. Open source and self-hostable on Cloudflare.",
  shortDescription: "Catch every 404. Send visitors where they meant to go.",
  updated: "2026-11-01",
  /** The waitlist lives on n8builds.dev, where the product is built in public. */
  waitlistUrl: "https://n8builds.dev/upcoming?interest=relink#relink",
  builderUrl: "https://n8builds.dev",
} as const;

/** Routes that exist on this site, used by the sitemap and the 404 page. */
export const routes = [
  { path: "/", title: "Home" },
  { path: "/#how-it-works", title: "How it works" },
  { path: "/#features", title: "Features" },
  { path: "/#open-source", title: "Open source and self-host" },
  { path: "/#compare", title: "Compare with Oh Dear and Dub" },
  { path: "/#pricing", title: "Pricing" },
  { path: "/#faq", title: "FAQ" },
  { path: "/#early-access", title: "Early access" },
  { path: "/privacy", title: "Privacy" },
  { path: "/terms", title: "Terms" },
] as const;

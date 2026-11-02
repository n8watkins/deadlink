import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/#pricing", label: "Pricing" },
      { href: site.waitlistUrl, label: "Join the waitlist" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/#open-source", label: "Open source and self-host" },
      { href: "/#compare", label: "Compare with Oh Dear and Dub" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Link href="/" className="rounded-lg" aria-label="Rewire home">
            <Logo />
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The open-source 404 safety net. In development: source code will be published under AGPL-3.0 with the self-host release.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} className="text-sm text-ink/85 hover:text-ink hover:underline hover:underline-offset-4">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-ink/85 hover:text-ink hover:underline hover:underline-offset-4">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-6">
          <p className="max-w-2xl leading-relaxed">
            Rewire is a product in development. Competitor details on this page come from their public pricing pages, checked 1&nbsp;November&nbsp;2026.
          </p>
          <p className="shrink-0">
            Built by N8 at{" "}
            <a href={site.builderUrl} className="font-medium text-ink/85 underline-offset-4 hover:text-ink hover:underline">
              n8builds.dev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

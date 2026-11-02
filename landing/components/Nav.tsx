import Link from "next/link";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { site } from "@/lib/site";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#open-source", label: "Open source" },
  { href: "/#compare", label: "Compare" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="Rewire home">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-bg-sunk hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <a
            href={site.waitlistUrl}
            className="hidden h-9 items-center rounded-lg bg-ink px-3.5 text-sm font-semibold text-bg transition hover:opacity-90 sm:inline-flex"
          >
            Join the waitlist
          </a>
          <MobileMenu links={links} />
        </div>
      </nav>
    </header>
  );
}

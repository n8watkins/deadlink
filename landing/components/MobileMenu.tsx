"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileMenu({ links }: { links: readonly { href: string; label: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          el.open = false;
          el.querySelector("summary")?.focus();
        }
        return;
      }
      if (!el.contains(event.target as Node)) el.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const closeMenu = () => {
    if (ref.current) ref.current.open = false;
  };

  return (
    <details ref={ref} className="group relative lg:hidden">
      <summary
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-line-strong text-ink [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <Menu className="size-4 group-open:hidden" aria-hidden="true" />
        <X className="hidden size-4 group-open:block" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-11 w-60 rounded-2xl border border-line bg-surface p-2 shadow-xl">
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={closeMenu} className="block rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-bg-sunk">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/#early-access"
          onClick={closeMenu}
          className="mt-1 flex h-10 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-bg"
        >
          Get early access
        </Link>
      </div>
    </details>
  );
}

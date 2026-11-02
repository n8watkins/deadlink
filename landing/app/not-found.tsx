import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DidYouMean } from "@/components/DidYouMean";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <p className="font-mono text-sm font-semibold text-broken">404</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-balance">
          This page does not exist. Ironic, we know.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          This is a small preview of the did-you-mean page Relink will show your visitors: an honest 404 status, with the closest pages
          one click away.
        </p>
        <DidYouMean />
        <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-bg hover:opacity-90">
          Back to the home page
        </Link>
      </main>
      <Footer />
    </>
  );
}

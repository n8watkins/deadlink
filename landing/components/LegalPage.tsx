import { Nav } from "./Nav";
import { Footer } from "./Footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Placeholder</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-10 space-y-6 leading-relaxed text-ink/90 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

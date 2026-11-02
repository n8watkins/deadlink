import { ArrowRight, Check, Cloud, GitBranch, Lock, Minus, Radar, ScanSearch, ShieldCheck } from "lucide-react";
import { HeroDemo } from "./HeroDemo";
import { comparison, faqs, featureGroups, statusHelp, steps, tiers, type Cell, type Status } from "@/lib/content";
import { site } from "@/lib/site";

function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  id: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lede ? <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">{lede}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    MVP: "bg-fixed-soft text-fixed",
    Beta: "bg-pending-soft text-pending",
    Later: "bg-bg-sunk text-muted",
  };
  return (
    <span
      title={statusHelp[status]}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      <span className="sr-only">Status: </span>
      {status}
    </span>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span>
              Open source · In development · Self-host <span className="hidden sm:inline">release </span>first
            </span>
          </p>
          <h1 id="hero-title" className="mt-6 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-[3.75rem]">
            Catch every 404.{" "}
            <span className="text-fixed">Send visitors where they meant to go.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">
            Relink sits at the edge of your site, catches broken links the moment someone hits them, and finds the right page using
            your own content. You approve each fix with one click, and it becomes a permanent redirect.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={site.waitlistUrl}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-base font-semibold text-bg transition hover:opacity-90"
            >
              Join the waitlist
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-line-strong bg-surface px-6 text-base font-semibold text-ink transition hover:border-ink"
            >
              See how it works
            </a>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-muted sm:grid-cols-2">
            {[
              "Self-host free on Cloudflare",
              "Never redirects for ads or off-site",
              "Honest 404 status when unsure",
              "No cookies, no stored IPs",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-fixed" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" id="how-it-works" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="A safety net, not another report"
          lede="Crawlers tell you what broke last week. Relink fixes the visit that is breaking right now, then asks you to confirm the fix."
        />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex flex-col rounded-2xl border border-line bg-bg p-6">
              <span className="font-mono text-sm font-semibold text-accent">0{i + 1}</span>
              <h3 className="mt-3 font-display text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
              <p className="mt-auto pt-5 text-sm leading-relaxed text-muted">
                <span className="mr-1.5 inline-block h-px w-4 translate-y-[-4px] bg-line-strong" aria-hidden="true" />
                {s.detail}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-6 grid gap-4 rounded-2xl border border-line bg-bg p-6 font-mono text-sm sm:grid-cols-3">
          <Flow tone="broken" label="Without Relink" text="Visitor hits /old-pricing, sees your 404 page, leaves." />
          <Flow tone="pending" label="Low confidence" text="Did-you-mean page with the 3 best matches, still an honest 404." />
          <Flow tone="fixed" label="High confidence" text="Redirect to /pricing now, permanent 301 after you approve." />
        </div>
      </div>
    </section>
  );
}

function Flow({ tone, label, text }: { tone: "broken" | "pending" | "fixed"; label: string; text: string }) {
  const dot = { broken: "bg-broken", pending: "bg-pending", fixed: "bg-fixed" }[tone];
  return (
    <div>
      <p className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 leading-relaxed text-ink/90">{text}</p>
    </div>
  );
}

export function Features() {
  return (
    <section aria-labelledby="features-title" id="features" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="features-title"
            eyebrow="Features"
            title="Everything that keeps a link alive"
            lede="Every feature below is planned, not shipped. The label says which release it is planned for."
          />
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {(Object.keys(statusHelp) as Status[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <dt>
                  <StatusPill status={s} />
                </dt>
                <dd>{statusHelp[s].replace("Planned for the ", "").replace("Planned ", "")}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-12 space-y-12">
          {featureGroups.map((g) => (
            <div key={g.id} className="grid gap-6 border-t border-line pt-10 lg:grid-cols-[18rem_1fr] lg:gap-12">
              <div>
                <h3 className="font-display text-2xl font-bold tracking-tight">{g.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{g.lede}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {g.features.map((f) => (
                  <li key={f.title} className="rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold leading-snug">{f.title}</h4>
                      <StatusPill status={f.status} />
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Scanner() {
  return (
    <section aria-labelledby="scanner-title" className="border-t border-line bg-bg-sunk">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Free tool, coming with the first release</p>
          <h2 id="scanner-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-balance">
            Is your site broken? Find out in a minute.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Paste a URL and the free scanner crawls up to about 200 pages for broken internal and outbound links, redirect chains,
            missing HTTPS and missing titles. No account needed.
          </p>
        </div>
        <div aria-hidden="true" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex gap-2">
            <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line-strong bg-bg px-3 text-muted">
              <ScanSearch className="size-4" />
              <span className="text-sm">https://your-site.com</span>
            </div>
            <div className="flex h-11 items-center rounded-xl bg-line px-4 text-sm font-semibold text-muted">Scan</div>
          </div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {[
              ["Broken internal links", "broken"],
              ["Broken outbound links", "broken"],
              ["Redirect chains", "pending"],
              ["HTTPS and page titles", "fixed"],
            ].map(([label, tone]) => (
              <li key={label} className="flex items-center justify-between py-2.5">
                <span>{label}</span>
                <span className={`h-2 w-16 rounded-full ${tone === "broken" ? "bg-broken/30" : tone === "pending" ? "bg-pending/30" : "bg-fixed/30"}`} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Preview of the planned scanner. Not live yet.</p>
        </div>
      </div>
    </section>
  );
}

export function OpenSource() {
  const points = [
    {
      icon: GitBranch,
      title: "MIT licensed",
      body: "Worker, matching, dashboard, API, SDKs and plugins. Read it, run it, change it.",
    },
    {
      icon: Cloud,
      title: "Runs on your Cloudflare account",
      body: "Workers, KV, D1, Vectorize and Workers AI. Small sites should fit in Cloudflare's free allowances.",
    },
    {
      icon: Lock,
      title: "Your logs stay yours",
      body: "Self-hosted, no request data ever reaches us. Hosted, we store paths and referrers, never IPs.",
    },
    {
      icon: ShieldCheck,
      title: "The real product, not a demo",
      body: "Hosted plans add convenience: multi-site, managed crawling, alerts, seats and support.",
    },
  ];
  return (
    <section aria-labelledby="oss-title" id="open-source" className="border-t border-line">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-24">
        <div>
          <SectionHeading
            id="oss-title"
            eyebrow="Open source and self-host"
            title="Own the whole stack, or let us run it"
            lede="Same code either way. Self-host it free on your own Cloudflare account, or pay for the hosted version when you would rather not."
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p.title}>
                <p.icon className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="self-center">
          <div className="overflow-hidden rounded-2xl border border-line-strong bg-code-bg text-code-ink">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <p className="font-mono text-xs text-code-muted">terminal</p>
              <p className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium text-code-muted">Planned commands</p>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7">
              <code>
                <span className="text-code-muted"># create the Worker, D1, KV and Vectorize index</span>
                {"\n"}
                <span className="text-[#ff8a4c]">$</span> npx getrelink init
                {"\n"}
                <span className="text-[#ff8a4c]">$</span> npx wrangler deploy
                {"\n\n"}
                <span className="text-code-muted"># attach it to your site and build the first index</span>
                {"\n"}
                <span className="text-[#ff8a4c]">$</span> npx getrelink connect example.com
                {"\n"}
                <span className="text-[#45d39c]">✓</span> route example.com/* attached
                {"\n"}
                <span className="text-[#45d39c]">✓</span> sitemap read, pages queued for indexing
              </code>
            </pre>
          </div>
          <p className="mt-3 text-xs text-muted">The CLI does not exist yet. This is the setup we are designing toward.</p>
        </div>
      </div>
    </section>
  );
}

function CellValue({ value, strong }: { value: Cell; strong?: boolean }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1.5 align-middle text-fixed">
        <Check className="size-4" aria-hidden="true" />
        <span className="sr-only">Yes</span>
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center align-middle text-muted/70">
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">No</span>
      </span>
    );
  return <span className={strong ? "font-medium text-ink" : "text-ink/85"}>{value}</span>;
}

export function Compare() {
  return (
    <section aria-labelledby="compare-title" id="compare" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="compare-title"
          eyebrow="Compare"
          title="Where Relink fits next to Oh Dear and Dub"
          lede={
            <>
              Oh Dear tells you something broke. Dub manages the links you create. Relink rescues the links you did not know were
              broken. They are good products; we are not trying to replace them.
            </>
          }
        />
        <p className="mt-8 text-xs text-muted sm:hidden">Swipe the table sideways to see Oh Dear and Dub.</p>
        <div className="relative mt-3 overflow-x-auto sm:mt-10 rounded-2xl border border-line">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <caption className="sr-only">Feature comparison of Relink (planned), Oh Dear and Dub</caption>
            <thead>
              <tr className="border-b border-line bg-bg">
                <th scope="col" className="sticky left-0 z-10 w-36 bg-bg px-4 py-3.5 font-medium text-muted sm:static sm:w-auto">
                  <span className="sr-only">Capability</span>
                </th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">
                  Relink <span className="font-sans text-xs font-medium text-muted">(planned)</span>
                </th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">Oh Dear</th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">Dub</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => (
                <tr key={r.row} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 font-normal text-muted sm:static">
                    {r.row}
                  </th>
                  <td className="bg-fixed-soft/40 px-4 py-3">
                    <CellValue value={r.relink} strong />
                  </td>
                  <td className="px-4 py-3">
                    <CellValue value={r.ohdear} />
                  </td>
                  <td className="px-4 py-3">
                    <CellValue value={r.dub} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Relink column describes the planned product. Oh Dear and Dub details from ohdear.app/pricing, dub.co/pricing and Dub&apos;s
          GitHub README, checked 1 November 2026. Oh Dear also offers DNS, cron, port and Lighthouse checks and status pages that Relink
          does not plan to match.
        </p>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section aria-labelledby="pricing-title" id="pricing" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title="Simple plans, metered on 404s you actually catch"
          lede="Normal traffic through the Worker is never metered. If you hit a limit, existing redirects keep working; we just pause new automatic matches until next month."
        />
        <p className="mt-6 inline-flex items-center gap-2 rounded-xl border border-pending/30 bg-pending-soft px-3.5 py-2 text-sm text-ink">
          <Radar className="size-4 text-pending" aria-hidden="true" />
          Planned pricing. Nothing is billable today. Self-host ships first and stays free; the hosted beta will be free too.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <li
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${t.highlight ? "border-ink bg-surface shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]" : "border-line bg-surface"}`}
            >
              {t.highlight ? (
                <span className="absolute -top-3 left-6 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-bg">Recommended</span>
              ) : null}
              <h3 className="font-display text-xl font-bold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold tracking-tight">{t.price}</span>
                <span className="text-sm text-muted">{t.cadence}</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-fixed" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-7">
                <a
                  href={site.waitlistUrl}
                  className={`inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition ${t.highlight ? "bg-ink text-bg hover:opacity-90" : "border border-line-strong text-ink hover:border-ink"}`}
                >
                  {t.name === "Self-host" ? "Get notified at release" : "Join the waitlist"}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section aria-labelledby="faq-title" id="faq" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:py-24">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Straight answers" lede="Including the ones about what does not exist yet." />
        <div className="divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  className="relative size-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded before:bg-ink after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-ink after:transition group-open:after:scale-y-0"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 pr-8 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EarlyAccess() {
  return (
    <section aria-labelledby="early-title" id="early-access" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="grid gap-10 rounded-3xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Early access</p>
            <h2 id="early-title" className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Be first to put a safety net under your links
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              The self-host release comes first: one site on your own Cloudflare account with the edge Worker, matching, the did-you-mean
              page, the approval queue and the free scanner. The hosted beta follows, free while it lasts.
            </p>
          </div>
          <div className="lg:justify-self-end">
            <ol className="space-y-3 text-sm">
              {[
                ["1", "Self-host release", "Open source, on your Cloudflare account"],
                ["2", "Hosted beta", "We run it for you, free during the beta"],
              ].map(([n, title, body]) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-xs font-semibold text-accent">
                    {n}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <a
              href={site.waitlistUrl}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 text-base font-semibold text-bg transition hover:opacity-90 sm:w-auto"
            >
              Join the waitlist
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <p className="mt-3 text-sm text-muted">
              Join the waitlist on n8builds.dev, where I build in public. One email when each release is ready.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

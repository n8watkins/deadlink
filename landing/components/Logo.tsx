export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden="true">
        <rect width="64" height="64" rx="14" className="fill-ink" />
        <path d="M18 34a10 10 0 0 1 0-14l4-4a10 10 0 0 1 14 0" fill="none" className="stroke-bg" strokeWidth="5" strokeLinecap="round" />
        <path d="M46 30a10 10 0 0 1 0 14l-4 4a10 10 0 0 1-14 0" fill="none" stroke="#ff8a4c" strokeWidth="5" strokeLinecap="round" />
        <path d="M27 37l10-10" stroke="#45d39c" strokeWidth="5" strokeLinecap="round" />
      </svg>
      deadlink
    </span>
  );
}

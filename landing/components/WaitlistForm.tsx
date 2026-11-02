"use client";

import { useId, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; stored: boolean; message: string };

export function WaitlistForm({ storageReady }: { storageReady: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { stored?: boolean; message?: string };
      setState({
        kind: "done",
        stored: Boolean(data.stored),
        message: data.message ?? "Something went wrong. Nothing was saved.",
      });
    } catch {
      setState({ kind: "done", stored: false, message: "We could not reach the server. Nothing was saved." });
    }
  }

  const sending = state.kind === "sending";

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md">
      <label htmlFor={`${id}-email`} className="block text-sm font-medium text-ink">
        Email address
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-describedby={`${id}-help ${id}-status`}
          className="h-11 w-full min-w-0 rounded-xl sm:flex-1 border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-60"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {storageReady ? "Join early access" : "Notify me"}
          {!sending ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </button>
      </div>
      <p id={`${id}-help`} className="mt-2.5 text-sm text-muted">
        {storageReady
          ? "One email when early access opens. No newsletter, no sharing."
          : "Coming soon: the list is not open yet, so this form does not save anything today."}
      </p>
      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        className={
          state.kind === "done"
            ? `mt-3 rounded-xl border px-3.5 py-2.5 text-sm ${state.stored ? "border-fixed/30 bg-fixed-soft text-ink" : "border-pending/30 bg-pending-soft text-ink"}`
            : "sr-only"
        }
      >
        {state.kind === "done" ? state.message : ""}
      </p>
    </form>
  );
}

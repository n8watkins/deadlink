import { NextResponse } from "next/server";

/**
 * Early access list endpoint.
 *
 * There is no storage yet. If WAITLIST_WEBHOOK_URL is set, the email is
 * forwarded there (for example a form backend or a Worker that writes to D1)
 * and only then do we tell the visitor it was saved. Otherwise we say plainly
 * that nothing was stored.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WaitlistResponse =
  | { ok: true; stored: true; message: string }
  | { ok: false; stored: false; message: string };

export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return reply(400, "Send a JSON body with an email field.");
  }

  if (!email || email.length > 254 || !EMAIL.test(email)) {
    return reply(400, "That does not look like an email address.");
  }

  const webhook = process.env.WAITLIST_WEBHOOK_URL;
  if (!webhook) {
    return reply(
      503,
      "Early access sign-ups are not open yet, so we did not save your email. Please check back soon.",
    );
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, source: "landing", at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
  } catch {
    return reply(502, "We could not save your email right now. Nothing was stored; please try again later.");
  }

  return NextResponse.json<WaitlistResponse>({
    ok: true,
    stored: true,
    message: "You are on the list. We will email you once when early access opens.",
  });
}

function reply(status: number, message: string) {
  return NextResponse.json<WaitlistResponse>({ ok: false, stored: false, message }, { status });
}

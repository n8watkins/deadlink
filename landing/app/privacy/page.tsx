import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How the deadlink website handles your data while the product is in development.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="1 November 2026">
      <p>
        deadlink is in development and has no customers or accounts yet. This short notice covers this website only. A full privacy
        policy and data processing agreement will be published before the hosted beta.
      </p>
      <h2>What this website collects</h2>
      <ul>
        <li>No cookies and no analytics or advertising trackers.</li>
        <li>
          The early access form only saves your email address when sign-ups are open, and it tells you whether it did. Today it saves
          nothing.
        </li>
        <li>Our hosting provider may keep standard server logs (such as IP address and user agent) for security, for a short period.</li>
      </ul>
      <h2>What we will do with an early access email</h2>
      <p>Send you one email when early access opens. We will not sell it, share it or add you to a newsletter.</p>
      <h2>Your choices</h2>
      <p>Once sign-ups open, every email we send will include a link to remove your address. A contact address for deletion requests will be listed here when sign-ups open.</p>
      <h2>The product</h2>
      <p>
        The planned product logs, for each caught 404, the requested path, referrer, a browser-or-bot classification and country. It will
        not set cookies or store IP addresses. Self-hosted installations keep all data in the operator&apos;s own Cloudflare account.
      </p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How the Relink website handles your data while the product is in development.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="1 November 2026">
      <p>
        Relink is in development and has no customers or accounts yet. This short notice covers this website only. A full privacy
        policy and data processing agreement will be published before the hosted beta.
      </p>
      <h2>What this website collects</h2>
      <ul>
        <li>No cookies and no advertising trackers.</li>
        <li>
          This website uses Cloudflare Web Analytics, which is cookieless and counts visits without tracking you. It records page views,
          referrers and browser, device and country information, does not store IP addresses and does not fingerprint visitors.
        </li>
        <li>No forms: this website does not collect email addresses or any other details you type.</li>
        <li>Our hosting provider may keep standard server logs (such as IP address and user agent) for security, for a short period.</li>
      </ul>
      <h2>Who processes this data</h2>
      <ul>
        <li>Cloudflare hosts this website and provides Cloudflare Web Analytics.</li>
      </ul>
      <h2>The waitlist</h2>
      <p>
        The waitlist lives on n8builds.dev, where Relink is built in public. If you join it there, n8builds.dev handles your email
        address under its own privacy notice. It is only used to tell you when a release is ready, and it is never sold or shared.
      </p>
      <h2>The product</h2>
      <p>
        The planned product logs, for each caught 404, the requested path, referrer, a browser-or-bot classification and country. It will
        not set cookies or store IP addresses. Self-hosted installations keep all data in the operator&apos;s own Cloudflare account.
      </p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for the Relink website while the product is in development.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="1 November 2026">
      <p>
        These placeholder terms cover this website while Relink is in development. Full terms of service will be published before any
        paid plan or hosted account exists.
      </p>
      <h2>Nothing is for sale yet</h2>
      <p>
        This site describes a product we are building. Features, limits and prices shown are plans and may change. Joining the waitlist on
        n8builds.dev does not create an account, a contract or any obligation for either side.
      </p>
      <h2>Open source</h2>
      <p>
        The Relink core will be released under the GNU Affero General Public License v3.0, and client libraries and plugins under the
        MIT License. The license file in the repository is authoritative once published.
      </p>
      <h2>Comparisons</h2>
      <p>
        Comparisons with other products are based on their public pages on the date shown and are provided in good faith. Product names
        belong to their owners. We will correct anything out of date as soon as we learn of it.
      </p>
      <h2>No warranty</h2>
      <p>This website is provided as is, without warranties of any kind.</p>
    </LegalPage>
  );
}

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Compare, EarlyAccess, FAQ, Features, Hero, HowItWorks, OpenSource, Pricing, Scanner } from "@/components/sections";
import { faqs } from "@/lib/content";
import { site } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: site.name,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web, Cloudflare Workers",
      description: site.description,
      url: site.url,
      license: "https://opensource.org/license/mit",
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <Features />
        <Scanner />
        <OpenSource />
        <Compare />
        <Pricing />
        <FAQ />
        <EarlyAccess />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}

import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Rendered once at build time for the static export.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(site.updated);
  return [
    { url: `${site.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site.url}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}

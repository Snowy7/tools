import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://tools.snowydev.xyz";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/font-creator`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/qr-generator`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/bg-remover`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/image-studio`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  ];
}

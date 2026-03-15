import type { MetadataRoute } from "next";
import { TOOL_DEFINITIONS } from "@/lib/tool-catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://tools.snowydev.xyz";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...TOOL_DEFINITIONS.map((tool) => ({
      url: `${base}${tool.href}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

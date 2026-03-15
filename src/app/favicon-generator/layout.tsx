import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favicon Generator",
  description:
    "Generate favicons in all standard sizes from a single image. Includes Apple touch icons, Android Chrome icons, HTML link tags, and web manifest snippets.",
  alternates: { canonical: "https://tools.snowydev.xyz/favicon-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

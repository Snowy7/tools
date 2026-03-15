import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mockup Generator",
  description:
    "Place screenshots into realistic device mockups — iPhone, Android, iPad, MacBook, browser, and monitor frames. Export clean PNGs for portfolios, presentations, and app store listings. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/mockup-generator" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

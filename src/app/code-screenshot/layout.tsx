import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Code Screenshot",
  description:
    "Create beautiful code screenshots with syntax themes, window chrome, and gradient backgrounds. Supports multiple languages and export to PNG. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/code-screenshot" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

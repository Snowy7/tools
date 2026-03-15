import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Screenshot Beautifier",
  description:
    "Add beautiful backgrounds, shadows, rounded corners, and browser frames to screenshots. Export as PNG. Free browser tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/screenshot-beautifier" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

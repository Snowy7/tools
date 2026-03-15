import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Background Remover",
  description:
    "Remove image backgrounds with AI (ORMBG, BiRefNet, MODNet) or algorithms (chroma key, luminance). Runs 100% in your browser. Free tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/bg-remover" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

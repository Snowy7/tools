import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SVG Cleanup Studio",
};

export default function SvgCleanupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

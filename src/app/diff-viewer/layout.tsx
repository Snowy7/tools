import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diff Viewer",
  description: "Compare text and JSON side by side with a visual diff viewer. Highlights additions, deletions, and changes across split, unified, and inline views.",
};

export default function DiffViewerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

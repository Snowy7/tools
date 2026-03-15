import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Markdown Editor",
  description: "Write and preview Markdown in real time with a split-pane editor. Includes formatting toolbar, live HTML preview, word count, and export options.",
};

export default function MarkdownEditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

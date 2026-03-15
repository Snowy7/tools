import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regex Lab",
  description: "Test and debug regular expressions with live match highlighting, capture groups, and an interactive cheat sheet.",
};

export default function RegexLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}

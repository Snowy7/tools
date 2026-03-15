import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Env File Formatter",
  description:
    "Format, sort, validate, and clean .env files. Group by prefix, remove duplicates, detect issues, view diffs, and convert between .env and JSON formats.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

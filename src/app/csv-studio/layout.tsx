import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CSV Studio",
  description: "Parse, edit, convert, and analyze CSV data directly in your browser.",
};

export default function CsvStudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}

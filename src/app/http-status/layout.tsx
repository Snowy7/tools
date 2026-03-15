import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTTP Status Reference",
  description: "Searchable reference of all HTTP status codes with descriptions, use cases, and example scenarios. Color-coded by category.",
};

export default function HttpStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}

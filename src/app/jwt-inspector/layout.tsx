import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JWT Inspector",
  description:
    "Decode, validate, and inspect JWT tokens. View header, payload, claims, and expiry. Free browser tool by Snowy.",
  alternates: { canonical: "https://tools.snowydev.xyz/jwt-inspector" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

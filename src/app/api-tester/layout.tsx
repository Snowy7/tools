import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Tester",
  description: "Lightweight Postman-style API tester. Send HTTP requests and inspect responses directly in your browser.",
};

export default function ApiTesterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

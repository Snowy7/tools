import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice Generator",
  description: "Create professional branded invoices with line items, tax calculation, and export to PDF-like image or downloadable HTML.",
};

export default function InvoiceGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

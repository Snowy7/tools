import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume Cleaner",
  description: "Paste messy resume text and get a clean, formatted output. Auto-detects sections, fixes formatting, and exports as text or HTML.",
};

export default function ResumeCleanerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

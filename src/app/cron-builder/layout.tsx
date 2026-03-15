import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cron Builder",
  description: "Visual cron expression builder with plain-English descriptions, next run previews, and quick presets.",
};

export default function CronBuilderLayout({ children }: { children: React.ReactNode }) {
  return children;
}

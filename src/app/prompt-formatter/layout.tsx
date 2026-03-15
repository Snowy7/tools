import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Formatter",
  description: "Organize and format AI prompts for Stable Diffusion, Midjourney, DALL-E with tag management, weight control, variables, and template presets.",
};

export default function PromptFormatterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

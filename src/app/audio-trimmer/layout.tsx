import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audio Trimmer",
  description: "Trim, fade, and export audio files with waveform visualization using the Web Audio API.",
};

export default function AudioTrimmerLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Face Cropper",
  description: "Manually crop and frame photos for avatars and profile pictures with circle, square, and rounded shapes, zoom, brightness, and batch processing.",
};

export default function FaceCropperLayout({ children }: { children: React.ReactNode }) {
  return children;
}

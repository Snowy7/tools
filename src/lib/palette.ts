export interface PaletteColor {
  hex: string;
  rgb: [number, number, number];
  weight: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function extractPaletteFromPixels(
  pixels: Uint8ClampedArray,
  maxColors = 8,
  quantizationStep = 24,
): PaletteColor[] {
  const buckets = new Map<string, { rgb: [number, number, number]; count: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 32) continue;
    const r = Math.round(pixels[i] / quantizationStep) * quantizationStep;
    const g = Math.round(pixels[i + 1] / quantizationStep) * quantizationStep;
    const b = Math.round(pixels[i + 2] / quantizationStep) * quantizationStep;
    const key = `${r}-${g}-${b}`;
    const current = buckets.get(key);
    if (current) {
      current.count += 1;
    } else {
      buckets.set(key, {
        rgb: [clampColor(r), clampColor(g), clampColor(b)],
        count: 1,
      });
    }
  }

  const total = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.count, 0) || 1;

  return Array.from(buckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, maxColors)
    .map((bucket) => ({
      rgb: bucket.rgb,
      hex: rgbToHex(bucket.rgb[0], bucket.rgb[1], bucket.rgb[2]),
      weight: bucket.count / total,
    }));
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, value));
}


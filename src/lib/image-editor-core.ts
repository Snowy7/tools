export type OutputFormat = "png" | "jpeg" | "webp";

export interface AdjustmentValues {
  brightness: number;
  contrast: number;
  exposure: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  clarity: number;
  sharpness: number;
}

export interface EffectValues {
  grain: number;
  vignette: number;
  vignetteRoundness: number;
  blur: number;
  pixelate: number;
  noiseReduction: number;
  glow: number;
  posterize: number;
}

export interface ColorValues {
  hueRotate: number;
  shadowR: number;
  shadowG: number;
  shadowB: number;
  midtoneR: number;
  midtoneG: number;
  midtoneB: number;
  highlightR: number;
  highlightG: number;
  highlightB: number;
  splitShadowColor: string;
  splitHighlightColor: string;
  splitBalance: number;
}

export interface TransformValues {
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  scale: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  adjustments: Partial<AdjustmentValues>;
}

export interface DetailWorkspace {
  source: Uint8ClampedArray | null;
  horizontal: Float32Array | null;
  blurred: Uint8ClampedArray | null;
}

interface ResolvedDetailWorkspace {
  source: Uint8ClampedArray;
  horizontal: Float32Array;
  blurred: Uint8ClampedArray;
}

export const DEFAULT_ADJUSTMENTS: AdjustmentValues = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  sharpness: 0,
};

export const DEFAULT_EFFECTS: EffectValues = {
  grain: 0,
  vignette: 0,
  vignetteRoundness: 50,
  blur: 0,
  pixelate: 1,
  noiseReduction: 0,
  glow: 0,
  posterize: 32,
};

export const DEFAULT_COLOR: ColorValues = {
  hueRotate: 0,
  shadowR: 0,
  shadowG: 0,
  shadowB: 0,
  midtoneR: 0,
  midtoneG: 0,
  midtoneB: 0,
  highlightR: 0,
  highlightG: 0,
  highlightB: 0,
  splitShadowColor: "#000044",
  splitHighlightColor: "#ffffcc",
  splitBalance: 50,
};

export const DEFAULT_TRANSFORM: TransformValues = {
  rotate: 0,
  flipH: false,
  flipV: false,
  scale: 100,
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", name: "None", adjustments: {} },
  {
    id: "vintage",
    name: "Vintage",
    adjustments: { temperature: 30, saturation: -30, contrast: -15, brightness: 5, shadows: 10 },
  },
  { id: "cool", name: "Cool", adjustments: { temperature: -40, contrast: 25, brightness: -5 } },
  { id: "warm", name: "Warm", adjustments: { temperature: 35, saturation: 10, contrast: -10, brightness: 5 } },
  { id: "bw", name: "B&W", adjustments: { saturation: -100, contrast: 10 } },
  { id: "sepia", name: "Sepia", adjustments: { saturation: -60, temperature: 40, contrast: -5 } },
  { id: "dramatic", name: "Dramatic", adjustments: { contrast: 40, saturation: -15, shadows: -20, clarity: 30 } },
  { id: "fade", name: "Fade", adjustments: { blacks: 30, saturation: -25, contrast: -15 } },
  { id: "chrome", name: "Chrome", adjustments: { contrast: 30, temperature: -15, saturation: 10, highlights: 15 } },
  { id: "noir", name: "Noir", adjustments: { saturation: -100, contrast: 35, blacks: -20, shadows: -15 } },
  { id: "matte", name: "Matte", adjustments: { blacks: 25, temperature: 15, contrast: -10, saturation: -10 } },
  { id: "film", name: "Film", adjustments: { tint: -15, temperature: 10, contrast: 10, shadows: 10, vibrance: 15 } },
];

export const PREVIEW_MAX_DIMENSION = 800;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.substring(0, 2), 16),
    Number.parseInt(normalized.substring(2, 4), 16),
    Number.parseInt(normalized.substring(4, 6), 16),
  ];
}

export function processPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  adj: AdjustmentValues,
  eff: EffectValues,
  col: ColorValues,
): void {
  const hasExposure = adj.exposure !== 0;
  const hasTemp = adj.temperature !== 0;
  const hasTint = adj.tint !== 0;
  const hasHighlights = adj.highlights !== 0;
  const hasShadows = adj.shadows !== 0;
  const hasWhites = adj.whites !== 0;
  const hasBlacks = adj.blacks !== 0;
  const hasHSB = hasHighlights || hasShadows || hasWhites || hasBlacks;
  const hasVibrance = adj.vibrance !== 0;
  const hasColorBalance =
    col.shadowR !== 0 || col.shadowG !== 0 || col.shadowB !== 0 ||
    col.midtoneR !== 0 || col.midtoneG !== 0 || col.midtoneB !== 0 ||
    col.highlightR !== 0 || col.highlightG !== 0 || col.highlightB !== 0;
  const hasGrain = eff.grain !== 0;
  const hasPosterize = eff.posterize < 32;
  const hasVignette = eff.vignette !== 0;

  if (!hasExposure && !hasTemp && !hasTint && !hasHSB && !hasVibrance && !hasColorBalance && !hasGrain && !hasPosterize && !hasVignette) {
    const [sr, sg, sb] = hexToRgb(col.splitShadowColor);
    const [hr, hg, hb] = hexToRgb(col.splitHighlightColor);
    const splitHasEffect = (sr !== 0 || sg !== 0 || sb !== 68) || (hr !== 255 || hg !== 255 || hb !== 204);
    if (!splitHasEffect) return;
  }

  const exposureFactor = hasExposure ? Math.pow(2, adj.exposure / 50) : 1;
  const tempShift = hasTemp ? adj.temperature * 1.2 : 0;
  const tintShift = hasTint ? adj.tint * 0.8 : 0;
  const vibranceAmt = hasVibrance ? adj.vibrance / 100 : 0;
  const [splitSR, splitSG, splitSB] = hexToRgb(col.splitShadowColor);
  const [splitHR, splitHG, splitHB] = hexToRgb(col.splitHighlightColor);
  const splitBal = col.splitBalance / 100;
  const splitStrength = 0.15;
  const posterizeStep = hasPosterize ? 256 / eff.posterize : 0;
  const grainIntensity = hasGrain ? eff.grain * 0.8 : 0;
  const cx = width / 2;
  const cy = height / 2;
  const vigStrength = hasVignette ? eff.vignette / 100 : 0;
  const vigRound = eff.vignetteRoundness / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (hasExposure) {
        r *= exposureFactor;
        g *= exposureFactor;
        b *= exposureFactor;
      }

      if (hasTemp) {
        r += tempShift;
        b -= tempShift;
      }

      if (hasTint) {
        g -= tintShift;
      }

      if (hasHSB) {
        const lum = (r + g + b) / 3;
        const lumNorm = lum / 255;

        if (hasShadows && lumNorm < 0.5) {
          const shift = adj.shadows * (1 - lumNorm * 2) * 0.8;
          r += shift;
          g += shift;
          b += shift;
        }
        if (hasHighlights && lumNorm > 0.5) {
          const shift = adj.highlights * (lumNorm - 0.5) * 1.6;
          r += shift;
          g += shift;
          b += shift;
        }
        if (hasWhites && lumNorm > 0.75) {
          const shift = adj.whites * (lumNorm - 0.75) * 2.4;
          r += shift;
          g += shift;
          b += shift;
        }
        if (hasBlacks && lumNorm < 0.25) {
          const shift = adj.blacks * (1 - lumNorm * 4) * 0.6;
          r += shift;
          g += shift;
          b += shift;
        }
      }

      if (hasVibrance) {
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
        const boost = vibranceAmt * (1 - saturation) * 0.5;
        const avg = (r + g + b) / 3;
        r += (r - avg) * boost;
        g += (g - avg) * boost;
        b += (b - avg) * boost;
      }

      if (hasColorBalance) {
        const lum = (r + g + b) / 3 / 255;
        const shadowWeight = clamp(1 - lum * 3, 0, 1);
        const midtoneWeight = clamp(1 - Math.abs(lum - 0.5) * 2.5, 0, 1);
        const highlightWeight = clamp((lum - 0.67) * 3, 0, 1);
        r += col.shadowR * shadowWeight * 1.5 + col.midtoneR * midtoneWeight * 1.5 + col.highlightR * highlightWeight * 1.5;
        g += col.shadowG * shadowWeight * 1.5 + col.midtoneG * midtoneWeight * 1.5 + col.highlightG * highlightWeight * 1.5;
        b += col.shadowB * shadowWeight * 1.5 + col.midtoneB * midtoneWeight * 1.5 + col.highlightB * highlightWeight * 1.5;
      }

      const lum = (r + g + b) / 3 / 255;
      const shadowWeight = clamp((1 - lum) * (1 - splitBal) * 2, 0, 1) * splitStrength;
      const highlightWeight = clamp(lum * splitBal * 2, 0, 1) * splitStrength;
      r += (splitSR - 128) * shadowWeight + (splitHR - 128) * highlightWeight;
      g += (splitSG - 128) * shadowWeight + (splitHG - 128) * highlightWeight;
      b += (splitSB - 128) * shadowWeight + (splitHB - 128) * highlightWeight;

      if (hasPosterize) {
        r = Math.round(r / posterizeStep) * posterizeStep;
        g = Math.round(g / posterizeStep) * posterizeStep;
        b = Math.round(b / posterizeStep) * posterizeStep;
      }

      if (hasGrain) {
        const noise = (Math.random() - 0.5) * grainIntensity;
        r += noise;
        g += noise;
        b += noise;
      }

      if (hasVignette) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const circular = Math.sqrt(dx * dx + dy * dy);
        const rectangular = Math.max(Math.abs(dx), Math.abs(dy));
        const distance = vigRound * circular + (1 - vigRound) * rectangular;
        const falloff = 1 - Math.pow(clamp(distance, 0, 1), 2) * vigStrength;
        r *= falloff;
        g *= falloff;
        b *= falloff;
      }

      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}

function ensureWorkspaceBuffers(length: number, workspace: DetailWorkspace): ResolvedDetailWorkspace {
  return {
    source: workspace.source && workspace.source.length === length ? workspace.source : new Uint8ClampedArray(length),
    horizontal: workspace.horizontal && workspace.horizontal.length === length ? workspace.horizontal : new Float32Array(length),
    blurred: workspace.blurred && workspace.blurred.length === length ? workspace.blurred : new Uint8ClampedArray(length),
  };
}

function boxBlurRgb(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  workspace: DetailWorkspace,
): ResolvedDetailWorkspace {
  const buffers = ensureWorkspaceBuffers(source.length, workspace);
  const { horizontal, blurred } = buffers;
  const windowSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sampleX = clamp(offset, 0, width - 1);
        sum += source[(y * width + sampleX) * 4 + channel];
      }

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4 + channel;
        horizontal[idx] = sum / windowSize;

        const removeX = clamp(x - radius, 0, width - 1);
        const addX = clamp(x + radius + 1, 0, width - 1);
        sum += source[(y * width + addX) * 4 + channel] - source[(y * width + removeX) * 4 + channel];
      }
    }

    for (let x = 0; x < width; x++) {
      const alphaIndex = (y * width + x) * 4 + 3;
      horizontal[alphaIndex] = source[alphaIndex];
    }
  }

  for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sampleY = clamp(offset, 0, height - 1);
        sum += horizontal[(sampleY * width + x) * 4 + channel];
      }

      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4 + channel;
        blurred[idx] = clamp(Math.round(sum / windowSize), 0, 255);

        const removeY = clamp(y - radius, 0, height - 1);
        const addY = clamp(y + radius + 1, 0, height - 1);
        sum += horizontal[(addY * width + x) * 4 + channel] - horizontal[(removeY * width + x) * 4 + channel];
      }
    }

    for (let y = 0; y < height; y++) {
      const alphaIndex = (y * width + x) * 4 + 3;
      blurred[alphaIndex] = source[alphaIndex];
    }
  }

  return buffers;
}

export function applyDetailEnhancement(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  clarity: number,
  sharpness: number,
  workspace: DetailWorkspace,
  radius: number,
): DetailWorkspace {
  if (clarity === 0 && sharpness === 0) return workspace;

  const buffers = ensureWorkspaceBuffers(srcData.length, workspace);
  buffers.source.set(srcData);
  const blurredBuffers = boxBlurRgb(buffers.source, width, height, Math.max(1, radius), buffers);
  const clarityAmount = clarity / 100;
  const sharpnessAmount = sharpness / 100;

  for (let i = 0; i < srcData.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const original = blurredBuffers.source[i + channel];
      const blurred = blurredBuffers.blurred[i + channel];
      const highPass = original - blurred;
      const baseBoost = clarityAmount * 1.2;
      const edgeBoost = sharpnessAmount * 1.85;
      srcData[i + channel] = clamp(
        Math.round(original + highPass * baseBoost + highPass * edgeBoost),
        0,
        255,
      );
    }
  }

  return blurredBuffers;
}

"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sun,
  Palette,
  Sparkles,
  Droplets,
  Move,
  Crop,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  FlipHorizontal,
  FlipVertical,
  Eye,
  EyeOff,
  X,
  ImageIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ToolCategory =
  | "adjust"
  | "filters"
  | "effects"
  | "color"
  | "transform"
  | "crop";

type OutputFormat = "png" | "jpeg" | "webp";

interface AdjustmentValues {
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

interface EffectValues {
  grain: number;
  vignette: number;
  vignetteRoundness: number;
  blur: number;
  pixelate: number;
  noiseReduction: number;
  glow: number;
  posterize: number;
}

interface ColorValues {
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

interface TransformValues {
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  scale: number;
}

type AspectRatio = "free" | "1:1" | "4:3" | "16:9" | "3:2" | "2:3";

interface CropValues {
  aspect: AspectRatio;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  adjustments: Partial<AdjustmentValues>;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_ADJUSTMENTS: AdjustmentValues = {
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

const DEFAULT_EFFECTS: EffectValues = {
  grain: 0,
  vignette: 0,
  vignetteRoundness: 50,
  blur: 0,
  pixelate: 1,
  noiseReduction: 0,
  glow: 0,
  posterize: 32,
};

const DEFAULT_COLOR: ColorValues = {
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

const DEFAULT_TRANSFORM: TransformValues = {
  rotate: 0,
  flipH: false,
  flipV: false,
  scale: 100,
};

const DEFAULT_CROP: CropValues = {
  aspect: "free",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  active: false,
};

// ── Filter Presets ─────────────────────────────────────────────────────────────

const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", name: "None", adjustments: {} },
  {
    id: "vintage",
    name: "Vintage",
    adjustments: {
      temperature: 30,
      saturation: -30,
      contrast: -15,
      brightness: 5,
      shadows: 10,
    },
  },
  {
    id: "cool",
    name: "Cool",
    adjustments: { temperature: -40, contrast: 25, brightness: -5 },
  },
  {
    id: "warm",
    name: "Warm",
    adjustments: {
      temperature: 35,
      saturation: 10,
      contrast: -10,
      brightness: 5,
    },
  },
  {
    id: "bw",
    name: "B&W",
    adjustments: { saturation: -100, contrast: 10 },
  },
  {
    id: "sepia",
    name: "Sepia",
    adjustments: { saturation: -60, temperature: 40, contrast: -5 },
  },
  {
    id: "dramatic",
    name: "Dramatic",
    adjustments: { contrast: 40, saturation: -15, shadows: -20, clarity: 30 },
  },
  {
    id: "fade",
    name: "Fade",
    adjustments: { blacks: 30, saturation: -25, contrast: -15 },
  },
  {
    id: "chrome",
    name: "Chrome",
    adjustments: {
      contrast: 30,
      temperature: -15,
      saturation: 10,
      highlights: 15,
    },
  },
  {
    id: "noir",
    name: "Noir",
    adjustments: {
      saturation: -100,
      contrast: 35,
      blacks: -20,
      shadows: -15,
    },
  },
  {
    id: "matte",
    name: "Matte",
    adjustments: { blacks: 25, temperature: 15, contrast: -10, saturation: -10 },
  },
  {
    id: "film",
    name: "Film",
    adjustments: {
      tint: -15,
      temperature: 10,
      contrast: 10,
      shadows: 10,
      vibrance: 15,
    },
  },
];

// ── Pixel Manipulation Helpers ─────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function applyExposure(data: Uint8ClampedArray, exposure: number): void {
  if (exposure === 0) return;
  const factor = Math.pow(2, exposure / 50);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * factor, 0, 255);
    data[i + 1] = clamp(data[i + 1] * factor, 0, 255);
    data[i + 2] = clamp(data[i + 2] * factor, 0, 255);
  }
}

function applyTemperature(data: Uint8ClampedArray, temp: number): void {
  if (temp === 0) return;
  const shift = temp * 1.2;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + shift, 0, 255);
    data[i + 2] = clamp(data[i + 2] - shift, 0, 255);
  }
}

function applyTint(data: Uint8ClampedArray, tint: number): void {
  if (tint === 0) return;
  const shift = tint * 0.8;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 1] = clamp(data[i + 1] - shift, 0, 255);
  }
}

function applyHighlightsShadows(
  data: Uint8ClampedArray,
  highlights: number,
  shadows: number,
  whites: number,
  blacks: number
): void {
  if (highlights === 0 && shadows === 0 && whites === 0 && blacks === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const lumNorm = lum / 255;

    // Shadows affect dark pixels (lum < 0.5)
    if (lumNorm < 0.5) {
      const weight = 1 - lumNorm * 2;
      const shift = shadows * weight * 0.8;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }

    // Highlights affect bright pixels (lum > 0.5)
    if (lumNorm > 0.5) {
      const weight = (lumNorm - 0.5) * 2;
      const shift = highlights * weight * 0.8;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }

    // Whites lift bright end
    if (lumNorm > 0.75) {
      const weight = (lumNorm - 0.75) * 4;
      const shift = whites * weight * 0.6;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }

    // Blacks lift dark end
    if (lumNorm < 0.25) {
      const weight = 1 - lumNorm * 4;
      const shift = blacks * weight * 0.6;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }
}

function applyVibrance(data: Uint8ClampedArray, vibrance: number): void {
  if (vibrance === 0) return;
  const amt = vibrance / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const boost = amt * (1 - sat) * 0.5;
    const avg = (r + g + b) / 3;
    data[i] = clamp(r + (r - avg) * boost, 0, 255);
    data[i + 1] = clamp(g + (g - avg) * boost, 0, 255);
    data[i + 2] = clamp(b + (b - avg) * boost, 0, 255);
  }
}

function applyClarity(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  clarity: number
): void {
  if (clarity === 0) return;
  const amt = clarity / 100;
  const copy = new Uint8ClampedArray(srcData);
  const radius = 2;
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ni = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += copy[ni];
            count++;
          }
        }
        const avg = sum / count;
        const diff = copy[idx + c] - avg;
        srcData[idx + c] = clamp(copy[idx + c] + diff * amt * 2, 0, 255);
      }
    }
  }
}

function applySharpness(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  sharpness: number
): void {
  if (sharpness === 0) return;
  const amt = sharpness / 100;
  const copy = new Uint8ClampedArray(srcData);
  // Simple sharpen kernel
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[idx + c] * 5;
        const top = copy[((y - 1) * width + x) * 4 + c];
        const bottom = copy[((y + 1) * width + x) * 4 + c];
        const left = copy[(y * width + (x - 1)) * 4 + c];
        const right = copy[(y * width + (x + 1)) * 4 + c];
        const sharp = center - top - bottom - left - right;
        srcData[idx + c] = clamp(
          copy[idx + c] + (sharp - copy[idx + c]) * amt,
          0,
          255
        );
      }
    }
  }
}

function applyGrain(data: Uint8ClampedArray, grain: number): void {
  if (grain === 0) return;
  const intensity = grain * 0.8;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity;
    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }
}

function applyVignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  vignette: number,
  roundness: number
): void {
  if (vignette === 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const strength = vignette / 100;
  const round = roundness / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      // Blend between rectangular and circular distance based on roundness
      const circDist = Math.sqrt(dx * dx + dy * dy);
      const rectDist = Math.max(Math.abs(dx), Math.abs(dy));
      const dist = round * circDist + (1 - round) * rectDist;
      const falloff = 1 - Math.pow(clamp(dist, 0, 1), 2) * strength;
      const idx = (y * width + x) * 4;
      data[idx] = clamp(data[idx] * falloff, 0, 255);
      data[idx + 1] = clamp(data[idx + 1] * falloff, 0, 255);
      data[idx + 2] = clamp(data[idx + 2] * falloff, 0, 255);
    }
  }
}

function applyPixelate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelate: number
): void {
  if (pixelate <= 1) return;
  const size = Math.round(pixelate);
  // Downscale then upscale
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = Math.max(1, Math.ceil(width / size));
  tempCanvas.height = Math.max(1, Math.ceil(height / size));
  const tempCtx = tempCanvas.getContext("2d")!;
  tempCtx.imageSmoothingEnabled = false;
  tempCtx.drawImage(ctx.canvas, 0, 0, tempCanvas.width, tempCanvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(tempCanvas, 0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
}

function applyPosterize(data: Uint8ClampedArray, levels: number): void {
  if (levels >= 32) return;
  const step = 256 / levels;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
}

function applyGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  glow: number
): void {
  if (glow === 0) return;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d")!;
  tempCtx.filter = `blur(${glow * 0.3}px) brightness(1.2)`;
  tempCtx.drawImage(ctx.canvas, 0, 0);
  ctx.globalAlpha = glow / 200;
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function applyColorBalance(
  data: Uint8ClampedArray,
  shadowR: number,
  shadowG: number,
  shadowB: number,
  midR: number,
  midG: number,
  midB: number,
  highR: number,
  highG: number,
  highB: number
): void {
  const noShadow = shadowR === 0 && shadowG === 0 && shadowB === 0;
  const noMid = midR === 0 && midG === 0 && midB === 0;
  const noHigh = highR === 0 && highG === 0 && highB === 0;
  if (noShadow && noMid && noHigh) return;

  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;

    // Shadow range 0-0.33
    const sw = clamp(1 - lum * 3, 0, 1);
    // Midtone range 0.17 - 0.83
    const mw = 1 - Math.abs(lum - 0.5) * 2.5;
    const midWeight = clamp(mw, 0, 1);
    // Highlight range 0.67 - 1
    const hw = clamp((lum - 0.67) * 3, 0, 1);

    data[i] = clamp(
      data[i] + shadowR * sw * 1.5 + midR * midWeight * 1.5 + highR * hw * 1.5,
      0,
      255
    );
    data[i + 1] = clamp(
      data[i + 1] +
        shadowG * sw * 1.5 +
        midG * midWeight * 1.5 +
        highG * hw * 1.5,
      0,
      255
    );
    data[i + 2] = clamp(
      data[i + 2] +
        shadowB * sw * 1.5 +
        midB * midWeight * 1.5 +
        highB * hw * 1.5,
      0,
      255
    );
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function applySplitToning(
  data: Uint8ClampedArray,
  shadowColor: string,
  highlightColor: string,
  balance: number
): void {
  const [sr, sg, sb] = hexToRgb(shadowColor);
  const [hr, hg, hb] = hexToRgb(highlightColor);
  // If both are near-black/white defaults skip
  const bal = balance / 100;
  const strength = 0.15;

  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
    const shadowWeight = clamp((1 - lum) * (1 - bal) * 2, 0, 1) * strength;
    const highlightWeight = clamp(lum * bal * 2, 0, 1) * strength;

    data[i] = clamp(
      data[i] + (sr - 128) * shadowWeight + (hr - 128) * highlightWeight,
      0,
      255
    );
    data[i + 1] = clamp(
      data[i + 1] + (sg - 128) * shadowWeight + (hg - 128) * highlightWeight,
      0,
      255
    );
    data[i + 2] = clamp(
      data[i + 2] + (sb - 128) * shadowWeight + (hb - 128) * highlightWeight,
      0,
      255
    );
  }
}

// ── Tool Category Definitions ──────────────────────────────────────────────────

interface ToolCategoryDef {
  id: ToolCategory;
  label: string;
  icon: typeof Sun;
}

const TOOL_CATEGORIES: ToolCategoryDef[] = [
  { id: "adjust", label: "Adjust", icon: Sun },
  { id: "filters", label: "Filters", icon: Palette },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "color", label: "Color", icon: Droplets },
  { id: "transform", label: "Transform", icon: Move },
  { id: "crop", label: "Crop", icon: Crop },
];

// ── Slider Component ───────────────────────────────────────────────────────────

function StudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (val: number) => void;
  suffix?: string;
}) {
  const pct =
    max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {label}
        </span>
        <span
          className="text-xs tabular-nums cursor-pointer select-none"
          style={{ color: "var(--muted)" }}
          onDoubleClick={() => onChange(defaultValue)}
          title="Double-click to reset"
        >
          {value}
          {suffix}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div
          className="absolute h-1 rounded-full w-full"
          style={{ background: "var(--border)" }}
        />
        <div
          className="absolute h-1 rounded-full"
          style={{
            background: "var(--accent)",
            width: `${pct}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={() => onChange(defaultValue)}
          className="absolute w-full h-5 opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 shadow-sm pointer-events-none"
          style={{
            background: "var(--surface)",
            borderColor: "var(--accent)",
            left: `calc(${pct}% - 7px)`,
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}

// ── Collapsible Section ────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        className="flex items-center gap-1.5 w-full text-left mb-2 group cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown size={14} style={{ color: "var(--muted)" }} />
        ) : (
          <ChevronRight size={14} style={{ color: "var(--muted)" }} />
        )}
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          {title}
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: open ? "2000px" : "0px",
          opacity: open ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ImageStudioPage() {
  // ── State ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("adjust");
  const [adjustments, setAdjustments] = useState<AdjustmentValues>(DEFAULT_ADJUSTMENTS);
  const [activeFilter, setActiveFilter] = useState<string>("none");
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [effects, setEffects] = useState<EffectValues>(DEFAULT_EFFECTS);
  const [color, setColor] = useState<ColorValues>(DEFAULT_COLOR);
  const [transform, setTransform] = useState<TransformValues>(DEFAULT_TRANSFORM);
  const [crop, setCrop] = useState<CropValues>(DEFAULT_CROP);
  const [zoom, setZoom] = useState(100);
  const [showOriginal, setShowOriginal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(92);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Crop drag state
  const [cropDragging, setCropDragging] = useState<string | null>(null);
  const [cropDragStart, setCropDragStart] = useState<{
    x: number;
    y: number;
    crop: CropValues;
  } | null>(null);

  // ── Refs ──
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderPendingRef = useRef(false);
  const renderRafRef = useRef<number>(0);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // ── Computed: merged adjustments with filter ──
  const mergedAdjustments = useMemo<AdjustmentValues>(() => {
    const preset = FILTER_PRESETS.find((f) => f.id === activeFilter);
    if (!preset || activeFilter === "none") return adjustments;
    const intensity = filterIntensity / 100;
    const merged = { ...adjustments };
    for (const [key, val] of Object.entries(preset.adjustments)) {
      const k = key as keyof AdjustmentValues;
      merged[k] = adjustments[k] + (val as number) * intensity;
    }
    return merged;
  }, [adjustments, activeFilter, filterIntensity]);

  // ── File Handling ──
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImageUrl(url);
    // Reset everything
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActiveFilter("none");
    setFilterIntensity(100);
    setEffects(DEFAULT_EFFECTS);
    setColor(DEFAULT_COLOR);
    setTransform(DEFAULT_TRANSFORM);
    setCrop(DEFAULT_CROP);
    setZoom(100);

    const img = new Image();
    img.onload = () => {
      sourceImageRef.current = img;
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Render Pipeline ──
  const renderCanvas = useCallback(() => {
    const img = sourceImageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Apply transform to determine canvas size
    const radians = (transform.rotate * Math.PI) / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const scaleFactor = transform.scale / 100;
    const rw = Math.ceil((w * cos + h * sin) * scaleFactor);
    const rh = Math.ceil((w * sin + h * cos) * scaleFactor);

    canvas.width = rw;
    canvas.height = rh;

    // Build CSS filter string
    const adj = mergedAdjustments;
    const brightness = 1 + adj.brightness / 100;
    const contrast = 1 + adj.contrast / 100;
    const saturate = 1 + adj.saturation / 100;
    const hueRot = color.hueRotate;
    const blurPx = effects.blur;

    const filters: string[] = [];
    filters.push(`brightness(${brightness})`);
    filters.push(`contrast(${contrast})`);
    filters.push(`saturate(${saturate})`);
    if (hueRot !== 0) filters.push(`hue-rotate(${hueRot}deg)`);
    if (blurPx > 0) filters.push(`blur(${blurPx}px)`);

    ctx.save();
    ctx.clearRect(0, 0, rw, rh);

    // Transform
    ctx.translate(rw / 2, rh / 2);
    ctx.rotate(radians);
    ctx.scale(
      (transform.flipH ? -1 : 1) * scaleFactor,
      (transform.flipV ? -1 : 1) * scaleFactor
    );

    // Apply CSS filters
    ctx.filter = filters.join(" ");
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Reset filter for pixel operations
    ctx.filter = "none";

    // Now pixel manipulation
    const imageData = ctx.getImageData(0, 0, rw, rh);
    const data = imageData.data;

    applyExposure(data, adj.exposure);
    applyTemperature(data, adj.temperature);
    applyTint(data, adj.tint);
    applyHighlightsShadows(data, adj.highlights, adj.shadows, adj.whites, adj.blacks);
    applyVibrance(data, adj.vibrance);
    applyClarity(data, rw, rh, adj.clarity);
    applySharpness(data, rw, rh, adj.sharpness);
    applyColorBalance(
      data,
      color.shadowR,
      color.shadowG,
      color.shadowB,
      color.midtoneR,
      color.midtoneG,
      color.midtoneB,
      color.highlightR,
      color.highlightG,
      color.highlightB
    );
    applySplitToning(
      data,
      color.splitShadowColor,
      color.splitHighlightColor,
      color.splitBalance
    );
    applyPosterize(data, effects.posterize);
    applyGrain(data, effects.grain);
    applyVignette(data, rw, rh, effects.vignette, effects.vignetteRoundness);

    ctx.putImageData(imageData, 0, 0);

    // Effects that need canvas context
    applyPixelate(ctx, rw, rh, effects.pixelate);
    applyGlow(ctx, rw, rh, effects.glow);

    // Crop overlay is drawn via CSS, not baked in
  }, [mergedAdjustments, effects, color, transform]);

  // ── Debounced Render ──
  useEffect(() => {
    if (!sourceImageRef.current) return;
    if (showOriginal) {
      // Show original
      const img = sourceImageRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      return;
    }

    if (renderPendingRef.current) return;
    renderPendingRef.current = true;
    renderRafRef.current = requestAnimationFrame(() => {
      renderCanvas();
      renderPendingRef.current = false;
    });
    return () => {
      cancelAnimationFrame(renderRafRef.current);
      renderPendingRef.current = false;
    };
  }, [renderCanvas, showOriginal]);

  // ── Export Helpers ──
  const exportImage = useCallback(
    (format: OutputFormat) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // If crop is active, crop the canvas
      let exportCanvas = canvas;
      if (crop.active && (crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100)) {
        const cw = canvas.width;
        const ch = canvas.height;
        const sx = (crop.x / 100) * cw;
        const sy = (crop.y / 100) * ch;
        const sw = (crop.width / 100) * cw;
        const sh = (crop.height / 100) * ch;
        const temp = document.createElement("canvas");
        temp.width = sw;
        temp.height = sh;
        const tCtx = temp.getContext("2d")!;
        tCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        exportCanvas = temp;
      }

      const mimeMap: Record<OutputFormat, string> = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
      };
      const quality = format === "jpeg" ? jpegQuality / 100 : undefined;
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const baseName = imageFile?.name.replace(/\.[^.]+$/, "") ?? "image";
          a.download = `${baseName}-edited.${format}`;
          a.href = url;
          a.click();
          URL.revokeObjectURL(url);
        },
        mimeMap[format],
        quality
      );
      setExportMenuOpen(false);
    },
    [jpegQuality, imageFile, crop]
  );

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png")
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  }, []);

  const resetAll = useCallback(() => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActiveFilter("none");
    setFilterIntensity(100);
    setEffects(DEFAULT_EFFECTS);
    setColor(DEFAULT_COLOR);
    setTransform(DEFAULT_TRANSFORM);
    setCrop(DEFAULT_CROP);
  }, []);

  // ── Close export menu on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  // ── Crop Interaction ──
  const handleCropPointerDown = useCallback(
    (handle: string, e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCropDragging(handle);
      setCropDragStart({ x: e.clientX, y: e.clientY, crop: { ...crop } });
    },
    [crop]
  );

  const handleCropPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!cropDragging || !cropDragStart || !previewContainerRef.current) return;
      const container = previewContainerRef.current;
      const rect = container.getBoundingClientRect();
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;

      // Get the canvas display dimensions
      const canvasRect = canvasEl.getBoundingClientRect();
      const dx = ((e.clientX - cropDragStart.x) / canvasRect.width) * 100;
      const dy = ((e.clientY - cropDragStart.y) / canvasRect.height) * 100;
      const sc = cropDragStart.crop;

      const newCrop = { ...crop };

      if (cropDragging === "move") {
        newCrop.x = clamp(sc.x + dx, 0, 100 - crop.width);
        newCrop.y = clamp(sc.y + dy, 0, 100 - crop.height);
      } else {
        // Handle resize
        if (cropDragging.includes("l")) {
          const newX = clamp(sc.x + dx, 0, sc.x + sc.width - 5);
          newCrop.width = sc.width - (newX - sc.x);
          newCrop.x = newX;
        }
        if (cropDragging.includes("r")) {
          newCrop.width = clamp(sc.width + dx, 5, 100 - sc.x);
        }
        if (cropDragging.includes("t")) {
          const newY = clamp(sc.y + dy, 0, sc.y + sc.height - 5);
          newCrop.height = sc.height - (newY - sc.y);
          newCrop.y = newY;
        }
        if (cropDragging.includes("b")) {
          newCrop.height = clamp(sc.height + dy, 5, 100 - sc.y);
        }

        // Enforce aspect ratio
        if (crop.aspect !== "free") {
          const ratioMap: Record<string, number> = {
            "1:1": 1,
            "4:3": 4 / 3,
            "16:9": 16 / 9,
            "3:2": 3 / 2,
            "2:3": 2 / 3,
          };
          const targetRatio = ratioMap[crop.aspect];
          if (targetRatio) {
            // Adjust height to match width * ratio (in percentage of canvas)
            const canvasAspect = canvasEl.width / canvasEl.height;
            const effectiveRatio = targetRatio / canvasAspect;
            newCrop.height = clamp(newCrop.width / effectiveRatio, 5, 100 - newCrop.y);
          }
        }
      }

      setCrop(newCrop);
    },
    [cropDragging, cropDragStart, crop]
  );

  const handleCropPointerUp = useCallback(() => {
    setCropDragging(null);
    setCropDragStart(null);
  }, []);

  // ── Adjustment helpers ──
  const setAdj = useCallback(
    (key: keyof AdjustmentValues, val: number) => {
      setAdjustments((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const setEff = useCallback(
    (key: keyof EffectValues, val: number) => {
      setEffects((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const setCol = useCallback(
    (key: keyof ColorValues, val: number | string) => {
      setColor((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  // ── Aspect ratio crop reset ──
  const setAspectRatio = useCallback((aspect: AspectRatio) => {
    setCrop((prev) => {
      const newCrop = { ...prev, aspect, active: true };
      if (aspect === "free") return newCrop;
      // Reset crop to center with the chosen ratio
      const ratioMap: Record<string, number> = {
        "1:1": 1,
        "4:3": 4 / 3,
        "16:9": 16 / 9,
        "3:2": 3 / 2,
        "2:3": 2 / 3,
      };
      const r = ratioMap[aspect] ?? 1;
      const canvasEl = canvasRef.current;
      if (!canvasEl) return newCrop;
      const canvasAspect = canvasEl.width / canvasEl.height;
      const effectiveRatio = r / canvasAspect;
      // Fit inside 80% of canvas
      let w = 80;
      let h = w / effectiveRatio;
      if (h > 80) {
        h = 80;
        w = h * effectiveRatio;
      }
      newCrop.width = clamp(w, 10, 100);
      newCrop.height = clamp(h, 10, 100);
      newCrop.x = (100 - newCrop.width) / 2;
      newCrop.y = (100 - newCrop.height) / 2;
      return newCrop;
    });
  }, []);

  // ── Render: Upload State ──
  if (!imageUrl) {
    return (
      <div className="h-screen flex flex-col" style={{ background: "var(--background)" }}>
        {/* Header */}
        <header
          className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <Link
            href="/"
            className="p-1.5 rounded-md transition-colors hover:opacity-80"
            style={{ color: "var(--foreground)" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Image Studio
          </h1>
        </header>

        {/* Upload Zone */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="w-full max-w-lg rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer"
            style={{
              borderColor: isDragging ? "var(--accent)" : "var(--border)",
              background: isDragging ? "var(--accent)/5" : "var(--surface)",
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div
              className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "var(--accent)", opacity: 0.1 }}
            >
              <Upload
                size={28}
                style={{ color: "var(--accent)", opacity: 10 }}
              />
            </div>
            <div
              className="relative mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ marginTop: "-84px" }}
            >
              <Upload size={28} style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-base font-medium mb-1" style={{ color: "var(--foreground)" }}>
              Drop an image here or click to upload
            </p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Supports PNG, JPEG, WebP, AVIF, TIFF
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      </div>
    );
  }

  // ── Render: Main Editor ──
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-md transition-colors hover:opacity-80"
          style={{ color: "var(--foreground)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Image Studio
        </h1>
        <span
          className="text-xs truncate max-w-48"
          style={{ color: "var(--muted)" }}
        >
          {imageFile?.name}
        </span>

        <div className="flex-1" />

        {/* Upload new */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--foreground)",
            background: "var(--surface-hover)",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          Upload
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {/* Copy */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--foreground)",
            background: "var(--surface-hover)",
          }}
          onClick={copyToClipboard}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>

        {/* Reset */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--foreground)",
            background: "var(--surface-hover)",
          }}
          onClick={resetAll}
        >
          <RotateCcw size={14} />
          Reset
        </button>

        {/* Download */}
        <div className="relative" ref={exportMenuRef}>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
            style={{
              color: "white",
              background: "var(--accent)",
            }}
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
          >
            <Download size={14} />
            Download
            <ChevronDown size={12} />
          </button>
          {exportMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-56 rounded-lg border shadow-lg p-2 z-50"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <button
                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer hover:opacity-80"
                style={{ color: "var(--foreground)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                onClick={() => exportImage("png")}
              >
                PNG (lossless)
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer hover:opacity-80"
                style={{ color: "var(--foreground)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                onClick={() => exportImage("jpeg")}
              >
                JPEG
              </button>
              <div className="px-3 py-1.5">
                <StudioSlider
                  label="JPEG Quality"
                  value={jpegQuality}
                  min={10}
                  max={100}
                  defaultValue={92}
                  onChange={setJpegQuality}
                  suffix="%"
                />
              </div>
              <button
                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer hover:opacity-80"
                style={{ color: "var(--foreground)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                onClick={() => exportImage("webp")}
              >
                WebP
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <div
          className="w-12 shrink-0 flex flex-col items-center py-2 gap-1 border-r"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          {TOOL_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                style={{
                  background: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "white" : "var(--muted)",
                }}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.label}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        {/* Center: Canvas Preview */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{ background: "#1a1a1a" }}
        >
          <div
            ref={previewContainerRef}
            className="flex-1 flex items-center justify-center overflow-auto p-6 relative"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              backgroundColor: "#2a2a2a",
            }}
            onPointerMove={
              cropDragging ? handleCropPointerMove : undefined
            }
            onPointerUp={cropDragging ? handleCropPointerUp : undefined}
          >
            <div
              className="relative"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease",
              }}
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full rounded shadow-2xl"
                style={{
                  maxWidth: "calc(100vw - 384px - 48px - 48px)",
                  maxHeight: "calc(100vh - 48px - 48px - 48px)",
                  objectFit: "contain",
                }}
              />

              {/* Crop Overlay */}
              {crop.active && activeCategory === "crop" && (
                <div
                  className="absolute inset-0"
                  style={{ pointerEvents: "none" }}
                >
                  {/* Dim outside crop */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.y}%, ${crop.x}% ${crop.y}%, ${crop.x}% ${crop.y + crop.height}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, ${crop.x + crop.width}% ${crop.y}%, 100% ${crop.y}%, 100% 100%, 0% 100%)`,
                      pointerEvents: "none",
                    }}
                  />
                  {/* Crop border */}
                  <div
                    className="absolute border-2 border-white"
                    style={{
                      left: `${crop.x}%`,
                      top: `${crop.y}%`,
                      width: `${crop.width}%`,
                      height: `${crop.height}%`,
                      pointerEvents: "auto",
                      cursor: "move",
                    }}
                    onPointerDown={(e) => handleCropPointerDown("move", e)}
                  >
                    {/* Rule of thirds grid */}
                    <div
                      className="absolute w-full border-t border-white/30"
                      style={{ top: "33.33%" }}
                    />
                    <div
                      className="absolute w-full border-t border-white/30"
                      style={{ top: "66.66%" }}
                    />
                    <div
                      className="absolute h-full border-l border-white/30"
                      style={{ left: "33.33%" }}
                    />
                    <div
                      className="absolute h-full border-l border-white/30"
                      style={{ left: "66.66%" }}
                    />

                    {/* Corner handles */}
                    {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                      const pos: Record<string, React.CSSProperties> = {
                        tl: { top: -4, left: -4, cursor: "nwse-resize" },
                        tr: { top: -4, right: -4, cursor: "nesw-resize" },
                        bl: { bottom: -4, left: -4, cursor: "nesw-resize" },
                        br: { bottom: -4, right: -4, cursor: "nwse-resize" },
                      };
                      const handleMap: Record<string, string> = {
                        tl: "tl",
                        tr: "tr",
                        bl: "bl",
                        br: "br",
                      };
                      return (
                        <div
                          key={corner}
                          className="absolute w-3 h-3 bg-white rounded-sm shadow"
                          style={{
                            ...pos[corner],
                            pointerEvents: "auto",
                          }}
                          onPointerDown={(e) =>
                            handleCropPointerDown(handleMap[corner], e)
                          }
                        />
                      );
                    })}
                    {/* Edge handles */}
                    {(["t", "b", "l", "r"] as const).map((edge) => {
                      const style: Record<string, React.CSSProperties> = {
                        t: {
                          top: -3,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 24,
                          height: 6,
                          cursor: "ns-resize",
                        },
                        b: {
                          bottom: -3,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 24,
                          height: 6,
                          cursor: "ns-resize",
                        },
                        l: {
                          left: -3,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 6,
                          height: 24,
                          cursor: "ew-resize",
                        },
                        r: {
                          right: -3,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 6,
                          height: 24,
                          cursor: "ew-resize",
                        },
                      };
                      return (
                        <div
                          key={edge}
                          className="absolute bg-white rounded-sm shadow"
                          style={{
                            ...style[edge],
                            pointerEvents: "auto",
                          }}
                          onPointerDown={(e) =>
                            handleCropPointerDown(edge, e)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Bar: Zoom + Before/After */}
          <div
            className="flex items-center justify-between px-4 h-10 shrink-0 border-t"
            style={{
              borderColor: "rgba(255,255,255,0.1)",
              background: "#1a1a1a",
            }}
          >
            {/* Before/After */}
            <button
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
              style={{
                color: showOriginal ? "#fff" : "rgba(255,255,255,0.6)",
                background: showOriginal
                  ? "var(--accent)"
                  : "rgba(255,255,255,0.08)",
              }}
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
            >
              {showOriginal ? <EyeOff size={13} /> : <Eye size={13} />}
              {showOriginal ? "Original" : "Hold to compare"}
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                className="p-1 rounded transition-colors cursor-pointer"
                style={{ color: "rgba(255,255,255,0.6)" }}
                onClick={() => setZoom((z) => Math.max(25, z - 25))}
              >
                <ZoomOut size={15} />
              </button>
              <span
                className="text-xs tabular-nums w-10 text-center"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {zoom}%
              </span>
              <button
                className="p-1 rounded transition-colors cursor-pointer"
                style={{ color: "rgba(255,255,255,0.6)" }}
                onClick={() => setZoom((z) => Math.min(400, z + 25))}
              >
                <ZoomIn size={15} />
              </button>
              <button
                className="p-1 rounded transition-colors cursor-pointer"
                style={{ color: "rgba(255,255,255,0.6)" }}
                onClick={() => setZoom(100)}
                title="Fit to screen"
              >
                <Maximize size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          className="w-72 shrink-0 border-l overflow-y-auto"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <div className="p-3">
            {/* Panel Title */}
            <div className="flex items-center gap-2 mb-4">
              {(() => {
                const cat = TOOL_CATEGORIES.find(
                  (c) => c.id === activeCategory
                )!;
                const Icon = cat.icon;
                return (
                  <>
                    <Icon size={16} style={{ color: "var(--accent)" }} />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {cat.label}
                    </span>
                  </>
                );
              })()}
            </div>

            {/* ── Adjustments Panel ── */}
            {activeCategory === "adjust" && (
              <>
                <CollapsibleSection title="Light">
                  <StudioSlider
                    label="Brightness"
                    value={adjustments.brightness}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("brightness", v)}
                  />
                  <StudioSlider
                    label="Contrast"
                    value={adjustments.contrast}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("contrast", v)}
                  />
                  <StudioSlider
                    label="Exposure"
                    value={adjustments.exposure}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("exposure", v)}
                  />
                  <StudioSlider
                    label="Highlights"
                    value={adjustments.highlights}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("highlights", v)}
                  />
                  <StudioSlider
                    label="Shadows"
                    value={adjustments.shadows}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("shadows", v)}
                  />
                  <StudioSlider
                    label="Whites"
                    value={adjustments.whites}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("whites", v)}
                  />
                  <StudioSlider
                    label="Blacks"
                    value={adjustments.blacks}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("blacks", v)}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Color">
                  <StudioSlider
                    label="Temperature"
                    value={adjustments.temperature}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("temperature", v)}
                  />
                  <StudioSlider
                    label="Tint"
                    value={adjustments.tint}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("tint", v)}
                  />
                  <StudioSlider
                    label="Vibrance"
                    value={adjustments.vibrance}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("vibrance", v)}
                  />
                  <StudioSlider
                    label="Saturation"
                    value={adjustments.saturation}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("saturation", v)}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Detail">
                  <StudioSlider
                    label="Clarity"
                    value={adjustments.clarity}
                    min={-100}
                    max={100}
                    onChange={(v) => setAdj("clarity", v)}
                  />
                  <StudioSlider
                    label="Sharpness"
                    value={adjustments.sharpness}
                    min={0}
                    max={100}
                    onChange={(v) => setAdj("sharpness", v)}
                  />
                </CollapsibleSection>
              </>
            )}

            {/* ── Filters Panel ── */}
            {activeCategory === "filters" && (
              <>
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all cursor-pointer"
                      style={{
                        background:
                          activeFilter === preset.id
                            ? "var(--accent)"
                            : "var(--surface-hover)",
                        color:
                          activeFilter === preset.id
                            ? "white"
                            : "var(--foreground)",
                      }}
                      onClick={() => setActiveFilter(preset.id)}
                    >
                      <div
                        className="w-full aspect-square rounded-md flex items-center justify-center overflow-hidden"
                        style={{
                          background:
                            activeFilter === preset.id
                              ? "rgba(255,255,255,0.15)"
                              : "var(--border)",
                        }}
                      >
                        <ImageIcon
                          size={16}
                          style={{
                            color:
                              activeFilter === preset.id
                                ? "rgba(255,255,255,0.7)"
                                : "var(--muted)",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium truncate w-full text-center">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
                {activeFilter !== "none" && (
                  <StudioSlider
                    label="Filter Intensity"
                    value={filterIntensity}
                    min={0}
                    max={100}
                    defaultValue={100}
                    onChange={setFilterIntensity}
                    suffix="%"
                  />
                )}
              </>
            )}

            {/* ── Effects Panel ── */}
            {activeCategory === "effects" && (
              <>
                <CollapsibleSection title="Film">
                  <StudioSlider
                    label="Grain"
                    value={effects.grain}
                    min={0}
                    max={100}
                    onChange={(v) => setEff("grain", v)}
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Vignette">
                  <StudioSlider
                    label="Amount"
                    value={effects.vignette}
                    min={0}
                    max={100}
                    onChange={(v) => setEff("vignette", v)}
                  />
                  <StudioSlider
                    label="Roundness"
                    value={effects.vignetteRoundness}
                    min={0}
                    max={100}
                    defaultValue={50}
                    onChange={(v) => setEff("vignetteRoundness", v)}
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Blur & Distortion">
                  <StudioSlider
                    label="Blur"
                    value={effects.blur}
                    min={0}
                    max={30}
                    onChange={(v) => setEff("blur", v)}
                    suffix="px"
                  />
                  <StudioSlider
                    label="Pixelate"
                    value={effects.pixelate}
                    min={1}
                    max={50}
                    defaultValue={1}
                    onChange={(v) => setEff("pixelate", v)}
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Enhancement">
                  <StudioSlider
                    label="Noise Reduction"
                    value={effects.noiseReduction}
                    min={0}
                    max={100}
                    onChange={(v) => setEff("noiseReduction", v)}
                  />
                  <StudioSlider
                    label="Glow"
                    value={effects.glow}
                    min={0}
                    max={100}
                    onChange={(v) => setEff("glow", v)}
                  />
                  <StudioSlider
                    label="Posterize"
                    value={effects.posterize}
                    min={2}
                    max={32}
                    defaultValue={32}
                    onChange={(v) => setEff("posterize", v)}
                  />
                </CollapsibleSection>
              </>
            )}

            {/* ── Color Panel ── */}
            {activeCategory === "color" && (
              <>
                <CollapsibleSection title="Hue">
                  <StudioSlider
                    label="Hue Rotate"
                    value={color.hueRotate}
                    min={0}
                    max={360}
                    defaultValue={0}
                    onChange={(v) => setCol("hueRotate", v)}
                    suffix="deg"
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Color Balance - Shadows">
                  <StudioSlider
                    label="Red"
                    value={color.shadowR}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("shadowR", v)}
                  />
                  <StudioSlider
                    label="Green"
                    value={color.shadowG}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("shadowG", v)}
                  />
                  <StudioSlider
                    label="Blue"
                    value={color.shadowB}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("shadowB", v)}
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Color Balance - Midtones">
                  <StudioSlider
                    label="Red"
                    value={color.midtoneR}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("midtoneR", v)}
                  />
                  <StudioSlider
                    label="Green"
                    value={color.midtoneG}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("midtoneG", v)}
                  />
                  <StudioSlider
                    label="Blue"
                    value={color.midtoneB}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("midtoneB", v)}
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Color Balance - Highlights">
                  <StudioSlider
                    label="Red"
                    value={color.highlightR}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("highlightR", v)}
                  />
                  <StudioSlider
                    label="Green"
                    value={color.highlightG}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("highlightG", v)}
                  />
                  <StudioSlider
                    label="Blue"
                    value={color.highlightB}
                    min={-50}
                    max={50}
                    onChange={(v) => setCol("highlightB", v)}
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Split Toning">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <label
                        className="text-xs font-medium block mb-1"
                        style={{ color: "var(--foreground)" }}
                      >
                        Shadows
                      </label>
                      <input
                        type="color"
                        value={color.splitShadowColor}
                        onChange={(e) =>
                          setCol("splitShadowColor", e.target.value)
                        }
                        className="w-full h-8 rounded cursor-pointer border-0 p-0"
                        style={{ background: "transparent" }}
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        className="text-xs font-medium block mb-1"
                        style={{ color: "var(--foreground)" }}
                      >
                        Highlights
                      </label>
                      <input
                        type="color"
                        value={color.splitHighlightColor}
                        onChange={(e) =>
                          setCol("splitHighlightColor", e.target.value)
                        }
                        className="w-full h-8 rounded cursor-pointer border-0 p-0"
                        style={{ background: "transparent" }}
                      />
                    </div>
                  </div>
                  <StudioSlider
                    label="Balance"
                    value={color.splitBalance}
                    min={0}
                    max={100}
                    defaultValue={50}
                    onChange={(v) => setCol("splitBalance", v)}
                  />
                </CollapsibleSection>
              </>
            )}

            {/* ── Transform Panel ── */}
            {activeCategory === "transform" && (
              <>
                <CollapsibleSection title="Rotation">
                  <StudioSlider
                    label="Rotate"
                    value={transform.rotate}
                    min={-180}
                    max={180}
                    defaultValue={0}
                    onChange={(v) =>
                      setTransform((prev) => ({ ...prev, rotate: v }))
                    }
                    suffix="deg"
                  />
                </CollapsibleSection>
                <CollapsibleSection title="Flip">
                  <div className="flex gap-2 mb-3">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      style={{
                        background: transform.flipH
                          ? "var(--accent)"
                          : "var(--surface-hover)",
                        color: transform.flipH
                          ? "white"
                          : "var(--foreground)",
                      }}
                      onClick={() =>
                        setTransform((prev) => ({
                          ...prev,
                          flipH: !prev.flipH,
                        }))
                      }
                    >
                      <FlipHorizontal size={14} />
                      Horizontal
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      style={{
                        background: transform.flipV
                          ? "var(--accent)"
                          : "var(--surface-hover)",
                        color: transform.flipV
                          ? "white"
                          : "var(--foreground)",
                      }}
                      onClick={() =>
                        setTransform((prev) => ({
                          ...prev,
                          flipV: !prev.flipV,
                        }))
                      }
                    >
                      <FlipVertical size={14} />
                      Vertical
                    </button>
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="Scale">
                  <StudioSlider
                    label="Scale"
                    value={transform.scale}
                    min={50}
                    max={200}
                    defaultValue={100}
                    onChange={(v) =>
                      setTransform((prev) => ({ ...prev, scale: v }))
                    }
                    suffix="%"
                  />
                </CollapsibleSection>
              </>
            )}

            {/* ── Crop Panel ── */}
            {activeCategory === "crop" && (
              <>
                <CollapsibleSection title="Aspect Ratio">
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {(
                      ["free", "1:1", "4:3", "16:9", "3:2", "2:3"] as const
                    ).map((ar) => (
                      <button
                        key={ar}
                        className="px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                        style={{
                          background:
                            crop.aspect === ar
                              ? "var(--accent)"
                              : "var(--surface-hover)",
                          color:
                            crop.aspect === ar
                              ? "white"
                              : "var(--foreground)",
                        }}
                        onClick={() => setAspectRatio(ar)}
                      >
                        {ar === "free" ? "Free" : ar}
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>
                <CollapsibleSection title="Crop Region">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      style={{
                        background: crop.active
                          ? "var(--accent)"
                          : "var(--surface-hover)",
                        color: crop.active ? "white" : "var(--foreground)",
                      }}
                      onClick={() =>
                        setCrop((prev) => ({ ...prev, active: !prev.active }))
                      }
                    >
                      <Crop size={14} />
                      {crop.active ? "Crop Active" : "Enable Crop"}
                    </button>
                    {crop.active && (
                      <button
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                        style={{
                          background: "var(--surface-hover)",
                          color: "var(--foreground)",
                        }}
                        onClick={() => setCrop(DEFAULT_CROP)}
                      >
                        <X size={14} />
                        Reset
                      </button>
                    )}
                  </div>
                  {crop.active && (
                    <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                      Drag the handles on the image to adjust the crop area.
                      The cropped region will be applied when you export.
                    </p>
                  )}
                </CollapsibleSection>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

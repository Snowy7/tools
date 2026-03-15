"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  Palette,
  Redo2,
  RotateCcw,
  Undo2,
  Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PaletteEntry {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
  count: number;
}

interface ColorMapping {
  from: PaletteEntry;
  to: { r: number; g: number; b: number; a: number; hex: string };
}

interface HistoryState {
  mappings: ColorMapping[];
  hueShift: number;
  satShift: number;
  lightShift: number;
}

/* ------------------------------------------------------------------ */
/*  Color utilities                                                    */
/* ------------------------------------------------------------------ */

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
      : cleaned;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const hn = h / 360;
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function contrastText(r: number, g: number, b: number): string {
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? "#000000" : "#ffffff";
}

/* ------------------------------------------------------------------ */
/*  Palette extraction                                                 */
/* ------------------------------------------------------------------ */

function extractPalette(imageData: ImageData, maxColors: number = 256): PaletteEntry[] {
  const data = imageData.data;
  const colorMap = new Map<string, { r: number; g: number; b: number; a: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;
    const key = `${r},${g},${b},${a}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, a, count: 1 });
    }
  }

  const sorted = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  const limited = sorted.slice(0, maxColors);

  return limited.map((c) => ({
    r: c.r,
    g: c.g,
    b: c.b,
    a: c.a,
    hex: rgbToHex(c.r, c.g, c.b),
    count: c.count,
  }));
}

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                 */
/* ------------------------------------------------------------------ */

type PresetFn = (h: number, s: number, l: number) => [number, number, number];

const PRESETS: { name: string; fn: PresetFn }[] = [
  {
    name: "Warm",
    fn: (h, s, l) => [((h + 20) % 360), clamp(s + 10, 0, 100), l],
  },
  {
    name: "Cool",
    fn: (h, s, l) => [((h + 200) % 360), clamp(s + 5, 0, 100), l],
  },
  {
    name: "Inverted",
    fn: (h, s, l) => [((h + 180) % 360), s, 100 - l],
  },
  {
    name: "Grayscale",
    fn: (_h, _s, l) => [0, 0, l],
  },
  {
    name: "Sepia",
    fn: (_h, _s, l) => [30, clamp(40, 0, 100), l],
  },
  {
    name: "Neon",
    fn: (h, _s, l) => [h, 100, clamp(l + 15, 0, 100)],
  },
  {
    name: "Pastel",
    fn: (h, _s, l) => [h, clamp(35, 0, 100), clamp(l + 20, 0, 100)],
  },
];

/* ------------------------------------------------------------------ */
/*  Remap engine (pure Canvas API)                                     */
/* ------------------------------------------------------------------ */

function remapImage(
  sourceData: ImageData,
  mappings: ColorMapping[],
  tolerance: number
): ImageData {
  const src = sourceData.data;
  const out = new ImageData(
    new Uint8ClampedArray(src.length),
    sourceData.width,
    sourceData.height
  );
  const dst = out.data;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];

    if (a === 0) {
      dst[i] = 0;
      dst[i + 1] = 0;
      dst[i + 2] = 0;
      dst[i + 3] = 0;
      continue;
    }

    let bestDist = Infinity;
    let secondDist = Infinity;
    let bestIdx = -1;
    let secondIdx = -1;

    for (let j = 0; j < mappings.length; j++) {
      const f = mappings[j].from;
      const dist = colorDistance(r, g, b, f.r, f.g, f.b);
      if (dist < bestDist) {
        secondDist = bestDist;
        secondIdx = bestIdx;
        bestDist = dist;
        bestIdx = j;
      } else if (dist < secondDist) {
        secondDist = dist;
        secondIdx = j;
      }
    }

    const maxTolerance = tolerance * Math.sqrt(3);

    if (bestIdx >= 0 && bestDist <= maxTolerance) {
      const to = mappings[bestIdx].to;

      if (bestDist < 1) {
        // Exact match
        dst[i] = to.r;
        dst[i + 1] = to.g;
        dst[i + 2] = to.b;
        dst[i + 3] = a;
      } else if (secondIdx >= 0 && secondDist <= maxTolerance && secondDist > 0) {
        // Anti-aliased pixel: interpolate between two closest mappings
        const total = bestDist + secondDist;
        const w1 = 1 - bestDist / total;
        const w2 = 1 - secondDist / total;
        const wSum = w1 + w2;
        const to2 = mappings[secondIdx].to;
        dst[i] = Math.round((to.r * w1 + to2.r * w2) / wSum);
        dst[i + 1] = Math.round((to.g * w1 + to2.g * w2) / wSum);
        dst[i + 2] = Math.round((to.b * w1 + to2.b * w2) / wSum);
        dst[i + 3] = a;
      } else {
        dst[i] = to.r;
        dst[i + 1] = to.g;
        dst[i + 2] = to.b;
        dst[i + 3] = a;
      }
    } else {
      // Outside tolerance: keep original
      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function PaletteSwapPage() {
  /* Source image state */
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceData, setSourceData] = useState<ImageData | null>(null);
  const [palette, setPalette] = useState<PaletteEntry[]>([]);
  const [mappings, setMappings] = useState<ColorMapping[]>([]);

  /* Global shifts */
  const [hueShift, setHueShift] = useState(0);
  const [satShift, setSatShift] = useState(0);
  const [lightShift, setLightShift] = useState(0);
  const [tolerance, setTolerance] = useState(10);

  /* History */
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const skipHistoryRef = useRef(false);

  /* Refs */
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Copy feedback */
  const [copied, setCopied] = useState(false);

  /* ---- Push history ---- */
  const pushHistory = useCallback(
    (newMappings: ColorMapping[], h: number, s: number, l: number) => {
      if (skipHistoryRef.current) return;
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIdx + 1);
        const entry: HistoryState = {
          mappings: newMappings.map((m) => ({ ...m, to: { ...m.to } })),
          hueShift: h,
          satShift: s,
          lightShift: l,
        };
        return [...truncated, entry];
      });
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx]
  );

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[historyIdx - 1];
    skipHistoryRef.current = true;
    setMappings(prev.mappings);
    setHueShift(prev.hueShift);
    setSatShift(prev.satShift);
    setLightShift(prev.lightShift);
    setHistoryIdx((i) => i - 1);
    skipHistoryRef.current = false;
  }, [canUndo, history, historyIdx]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const next = history[historyIdx + 1];
    skipHistoryRef.current = true;
    setMappings(next.mappings);
    setHueShift(next.hueShift);
    setSatShift(next.satShift);
    setLightShift(next.lightShift);
    setHistoryIdx((i) => i + 1);
    skipHistoryRef.current = false;
  }, [canRedo, history, historyIdx]);

  /* ---- Load image ---- */
  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height);
      setSourceData(data);

      const pal = extractPalette(data, 256);
      setPalette(pal);

      const initialMappings: ColorMapping[] = pal.map((entry) => ({
        from: entry,
        to: { r: entry.r, g: entry.g, b: entry.b, a: entry.a, hex: entry.hex },
      }));
      setMappings(initialMappings);
      setHueShift(0);
      setSatShift(0);
      setLightShift(0);
      setTolerance(10);

      const initialState: HistoryState = {
        mappings: initialMappings,
        hueShift: 0,
        satShift: 0,
        lightShift: 0,
      };
      setHistory([initialState]);
      setHistoryIdx(0);

      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadImage(file);
    },
    [loadImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) loadImage(file);
    },
    [loadImage]
  );

  /* ---- Draw original canvas ---- */
  useEffect(() => {
    if (!sourceImage || !originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceImage, 0, 0);
  }, [sourceImage]);

  /* ---- Draw remapped preview ---- */
  useEffect(() => {
    if (!sourceData || !previewCanvasRef.current || mappings.length === 0) return;
    const canvas = previewCanvasRef.current;
    canvas.width = sourceData.width;
    canvas.height = sourceData.height;
    const ctx = canvas.getContext("2d")!;

    const remapped = remapImage(sourceData, mappings, tolerance);
    ctx.putImageData(remapped, 0, 0);
  }, [sourceData, mappings, tolerance]);

  /* ---- Apply global shifts ---- */
  const applyGlobalShifts = useCallback(
    (h: number, s: number, l: number) => {
      if (palette.length === 0) return;
      const newMappings: ColorMapping[] = palette.map((entry) => {
        const [oh, os, ol] = rgbToHsl(entry.r, entry.g, entry.b);
        const nh = (oh + h + 360) % 360;
        const ns = clamp(os + s, 0, 100);
        const nl = clamp(ol + l, 0, 100);
        const [nr, ng, nb] = hslToRgb(nh, ns, nl);
        return {
          from: entry,
          to: { r: nr, g: ng, b: nb, a: entry.a, hex: rgbToHex(nr, ng, nb) },
        };
      });
      setMappings(newMappings);
      pushHistory(newMappings, h, s, l);
    },
    [palette, pushHistory]
  );

  const handleHueShift = useCallback(
    (v: number) => {
      setHueShift(v);
      applyGlobalShifts(v, satShift, lightShift);
    },
    [satShift, lightShift, applyGlobalShifts]
  );

  const handleSatShift = useCallback(
    (v: number) => {
      setSatShift(v);
      applyGlobalShifts(hueShift, v, lightShift);
    },
    [hueShift, lightShift, applyGlobalShifts]
  );

  const handleLightShift = useCallback(
    (v: number) => {
      setLightShift(v);
      applyGlobalShifts(hueShift, satShift, v);
    },
    [hueShift, satShift, applyGlobalShifts]
  );

  /* ---- Single color change ---- */
  const handleColorChange = useCallback(
    (index: number, newHex: string) => {
      const [r, g, b] = hexToRgb(newHex);
      setMappings((prev) => {
        const next = prev.map((m, i) =>
          i === index ? { ...m, to: { r, g, b, a: m.from.a, hex: rgbToHex(r, g, b) } } : m
        );
        pushHistory(next, hueShift, satShift, lightShift);
        return next;
      });
    },
    [hueShift, satShift, lightShift, pushHistory]
  );

  /* ---- Apply preset ---- */
  const applyPreset = useCallback(
    (fn: PresetFn) => {
      if (palette.length === 0) return;
      const newMappings: ColorMapping[] = palette.map((entry) => {
        const [h, s, l] = rgbToHsl(entry.r, entry.g, entry.b);
        const [nh, ns, nl] = fn(h, s, l);
        const [nr, ng, nb] = hslToRgb(nh, clamp(ns, 0, 100), clamp(nl, 0, 100));
        return {
          from: entry,
          to: { r: nr, g: ng, b: nb, a: entry.a, hex: rgbToHex(nr, ng, nb) },
        };
      });
      setMappings(newMappings);
      setHueShift(0);
      setSatShift(0);
      setLightShift(0);
      pushHistory(newMappings, 0, 0, 0);
    },
    [palette, pushHistory]
  );

  /* ---- Reset to original ---- */
  const resetMappings = useCallback(() => {
    if (palette.length === 0) return;
    const newMappings: ColorMapping[] = palette.map((entry) => ({
      from: entry,
      to: { r: entry.r, g: entry.g, b: entry.b, a: entry.a, hex: entry.hex },
    }));
    setMappings(newMappings);
    setHueShift(0);
    setSatShift(0);
    setLightShift(0);
    pushHistory(newMappings, 0, 0, 0);
  }, [palette, pushHistory]);

  /* ---- Export ---- */
  const exportPng = useCallback(() => {
    if (!previewCanvasRef.current) return;
    const link = document.createElement("a");
    link.download = "palette-swapped.png";
    link.href = previewCanvasRef.current.toDataURL("image/png");
    link.click();
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!previewCanvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        previewCanvasRef.current!.toBlob(resolve, "image/png")
      );
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* clipboard API may not be available */
    }
  }, []);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  /* ---- Canvas display sizing ---- */
  const canvasStyle = useMemo(
    () => ({
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain" as const,
      imageRendering: "pixelated" as const,
    }),
    []
  );

  const checkerBg = `
    repeating-conic-gradient(
      var(--border) 0% 25%,
      var(--surface) 0% 50%
    ) 50% / 16px 16px
  `.trim();

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="Back to tools"
        >
          <ArrowLeft size={18} />
        </Link>
        <Palette size={18} style={{ color: "var(--accent)" }} />
        <h1 className="text-sm font-semibold tracking-tight">Palette Swap</h1>
        <div className="flex-1" />

        {sourceImage && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <Redo2 size={16} />
            </button>
            <div
              className="w-px h-5 mx-1"
              style={{ background: "var(--border)" }}
            />
            <button
              type="button"
              onClick={resetMappings}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
              title="Reset to original"
              aria-label="Reset to original"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
              title="Copy to clipboard"
              aria-label="Copy to clipboard"
            >
              {copied ? (
                <Check size={16} style={{ color: "#16a34a" }} />
              ) : (
                <Clipboard size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={exportPng}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: "var(--accent)" }}
              aria-label="Download PNG"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: preview area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!sourceImage ? (
            /* Upload zone */
            <div
              className="flex-1 flex items-center justify-center p-8"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <Upload
                  size={40}
                  style={{ color: "var(--muted)" }}
                />
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--foreground)" }}
                  >
                    Upload a sprite image
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    PNG recommended. Drag and drop or click to browse.
                  </span>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/gif,image/bmp,image/webp"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload sprite image"
              />
            </div>
          ) : (
            /* Side-by-side preview */
            <div className="flex-1 flex overflow-hidden">
              {/* Original */}
              <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: "var(--border)" }}>
                <div
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 border-b"
                  style={{
                    color: "var(--muted)",
                    borderColor: "var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  Original
                  {sourceImage && (
                    <span className="ml-2 font-normal">
                      {sourceImage.width} x {sourceImage.height}
                    </span>
                  )}
                </div>
                <div
                  className="flex-1 flex items-center justify-center overflow-auto p-4"
                  style={{ background: checkerBg }}
                >
                  <canvas ref={originalCanvasRef} style={canvasStyle} />
                </div>
              </div>

              {/* Recolored */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 border-b"
                  style={{
                    color: "var(--muted)",
                    borderColor: "var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  Recolored
                </div>
                <div
                  className="flex-1 flex items-center justify-center overflow-auto p-4"
                  style={{ background: checkerBg }}
                >
                  <canvas ref={previewCanvasRef} style={canvasStyle} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {sourceImage && (
          <aside
            className="w-72 shrink-0 flex flex-col overflow-hidden border-l"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="flex-1 overflow-y-auto">
              {/* Presets */}
              <div className="px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                  Presets
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset.fn)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors hover:bg-[var(--surface-hover)]"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global shifts */}
              <div className="px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                  Global Shifts
                </div>
                <div className="flex flex-col gap-2.5">
                  {/* Hue */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
                        Hue
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                        {hueShift}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={hueShift}
                      onChange={(e) => handleHueShift(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: "var(--accent)",
                        background: `linear-gradient(to right,
                          hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
                          hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))`,
                      }}
                      aria-label="Hue shift"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
                        Saturation
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                        {satShift > 0 ? "+" : ""}{satShift}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={satShift}
                      onChange={(e) => handleSatShift(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: "var(--accent)",
                        background: `linear-gradient(to right, var(--border) 0%, var(--accent) 50%, var(--accent) 100%)`,
                      }}
                      aria-label="Saturation shift"
                    />
                  </div>

                  {/* Lightness */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>
                        Lightness
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                        {lightShift > 0 ? "+" : ""}{lightShift}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={lightShift}
                      onChange={(e) => handleLightShift(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: "var(--accent)",
                        background: `linear-gradient(to right, #000 0%, var(--border) 50%, #fff 100%)`,
                      }}
                      aria-label="Lightness shift"
                    />
                  </div>
                </div>
              </div>

              {/* Tolerance */}
              <div className="px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Tolerance
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                    {tolerance}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    accentColor: "var(--accent)",
                    background: `linear-gradient(to right, var(--accent) ${(tolerance / 30) * 100}%, var(--border) ${(tolerance / 30) * 100}%)`,
                  }}
                  aria-label="Color tolerance"
                />
                <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
                  How close a pixel must be to a palette entry to be remapped. Increase for anti-aliased sprites.
                </p>
              </div>

              {/* Palette mappings */}
              <div className="px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                  Color Map ({palette.length} colors)
                </div>
                <div className="flex flex-col gap-1">
                  {mappings.map((mapping, index) => (
                    <div
                      key={mapping.from.hex + index}
                      className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors group"
                    >
                      {/* Original swatch */}
                      <div
                        className="w-6 h-6 rounded border shrink-0"
                        style={{
                          backgroundColor: mapping.from.hex,
                          borderColor: "var(--border)",
                        }}
                        title={`Original: ${mapping.from.hex}`}
                      />

                      {/* Arrow */}
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {"\u2192"}
                      </span>

                      {/* New color swatch (wraps a color input) */}
                      <label
                        className="w-6 h-6 rounded border shrink-0 cursor-pointer relative overflow-hidden"
                        style={{
                          backgroundColor: mapping.to.hex,
                          borderColor: "var(--border)",
                        }}
                        title={`New: ${mapping.to.hex}`}
                      >
                        <input
                          type="color"
                          value={mapping.to.hex}
                          onChange={(e) => handleColorChange(index, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          aria-label={`Remap color ${mapping.from.hex}`}
                        />
                      </label>

                      {/* Hex labels */}
                      <span
                        className="text-[9px] font-mono flex-1 truncate"
                        style={{ color: "var(--muted)" }}
                      >
                        {mapping.from.hex}
                      </span>

                      {/* Pixel count */}
                      <span
                        className="text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--muted)" }}
                      >
                        {mapping.from.count.toLocaleString()}px
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Hidden file input for re-upload */}
      {!sourceImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/gif,image/bmp,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload sprite image"
        />
      )}
    </div>
  );
}

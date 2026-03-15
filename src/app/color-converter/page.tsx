"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Pipette } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Conversion functions                                               */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
      : cleaned;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
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

function rgbToHsb(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const brightness = max;
  const saturation = max === 0 ? 0 : d / max;
  let hue = 0;
  if (d !== 0) {
    if (max === rn) hue = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) hue = ((bn - rn) / d + 2) / 6;
    else hue = ((rn - gn) / d + 4) / 6;
  }
  return [Math.round(hue * 360), Math.round(saturation * 100), Math.round(brightness * 100)];
}

function hsbToRgb(h: number, s: number, b: number): [number, number, number] {
  const sn = s / 100;
  const bn = b / 100;
  const hn = h / 360;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = bn * (1 - sn);
  const q = bn * (1 - f * sn);
  const t = bn * (1 - (1 - f) * sn);
  let rn: number, gn: number, bln: number;
  switch (i % 6) {
    case 0: rn = bn; gn = t; bln = p; break;
    case 1: rn = q; gn = bn; bln = p; break;
    case 2: rn = p; gn = bn; bln = t; break;
    case 3: rn = p; gn = q; bln = bn; break;
    case 4: rn = t; gn = p; bln = bn; break;
    default: rn = bn; gn = p; bln = q; break;
  }
  return [Math.round(rn * 255), Math.round(gn * 255), Math.round(bln * 255)];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  if (r === 0 && g === 0 && b === 0) return [0, 0, 0, 100];
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return [Math.round(c * 100), Math.round(m * 100), Math.round(y * 100), Math.round(k * 100)];
}

function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const cn = c / 100;
  const mn = m / 100;
  const yn = y / 100;
  const kn = k / 100;
  return [
    Math.round(255 * (1 - cn) * (1 - kn)),
    Math.round(255 * (1 - mn) * (1 - kn)),
    Math.round(255 * (1 - yn) * (1 - kn)),
  ];
}

/* ------------------------------------------------------------------ */
/*  Tailwind color palette                                             */
/* ------------------------------------------------------------------ */

const TAILWIND_COLORS: Record<string, Record<string, string>> = {
  slate: { "50": "#f8fafc", "100": "#f1f5f9", "200": "#e2e8f0", "300": "#cbd5e1", "400": "#94a3b8", "500": "#64748b", "600": "#475569", "700": "#334155", "800": "#1e293b", "900": "#0f172a", "950": "#020617" },
  gray: { "50": "#f9fafb", "100": "#f3f4f6", "200": "#e5e7eb", "300": "#d1d5db", "400": "#9ca3af", "500": "#6b7280", "600": "#4b5563", "700": "#374151", "800": "#1f2937", "900": "#111827", "950": "#030712" },
  zinc: { "50": "#fafafa", "100": "#f4f4f5", "200": "#e4e4e7", "300": "#d4d4d8", "400": "#a1a1aa", "500": "#71717a", "600": "#52525b", "700": "#3f3f46", "800": "#27272a", "900": "#18181b", "950": "#09090b" },
  neutral: { "50": "#fafafa", "100": "#f5f5f5", "200": "#e5e5e5", "300": "#d4d4d4", "400": "#a3a3a3", "500": "#737373", "600": "#525252", "700": "#404040", "800": "#262626", "900": "#171717", "950": "#0a0a0a" },
  stone: { "50": "#fafaf9", "100": "#f5f5f4", "200": "#e7e5e4", "300": "#d6d3d1", "400": "#a8a29e", "500": "#78716c", "600": "#57534e", "700": "#44403c", "800": "#292524", "900": "#1c1917", "950": "#0c0a09" },
  red: { "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5", "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c", "800": "#991b1b", "900": "#7f1d1d", "950": "#450a0a" },
  orange: { "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74", "400": "#fb923c", "500": "#f97316", "600": "#ea580c", "700": "#c2410c", "800": "#9a3412", "900": "#7c2d12", "950": "#431407" },
  amber: { "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f", "950": "#451a03" },
  yellow: { "50": "#fefce8", "100": "#fef9c3", "200": "#fef08a", "300": "#fde047", "400": "#facc15", "500": "#eab308", "600": "#ca8a04", "700": "#a16207", "800": "#854d0e", "900": "#713f12", "950": "#422006" },
  lime: { "50": "#f7fee7", "100": "#ecfccb", "200": "#d9f99d", "300": "#bef264", "400": "#a3e635", "500": "#84cc16", "600": "#65a30d", "700": "#4d7c0f", "800": "#3f6212", "900": "#365314", "950": "#1a2e05" },
  green: { "50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac", "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d", "800": "#166534", "900": "#14532d", "950": "#052e16" },
  emerald: { "50": "#ecfdf5", "100": "#d1fae5", "200": "#a7f3d0", "300": "#6ee7b7", "400": "#34d399", "500": "#10b981", "600": "#059669", "700": "#047857", "800": "#065f46", "900": "#064e3b", "950": "#022c22" },
  teal: { "50": "#f0fdfa", "100": "#ccfbf1", "200": "#99f6e4", "300": "#5eead4", "400": "#2dd4bf", "500": "#14b8a6", "600": "#0d9488", "700": "#0f766e", "800": "#115e59", "900": "#134e4a", "950": "#042f2e" },
  cyan: { "50": "#ecfeff", "100": "#cffafe", "200": "#a5f3fc", "300": "#67e8f9", "400": "#22d3ee", "500": "#06b6d4", "600": "#0891b2", "700": "#0e7490", "800": "#155e75", "900": "#164e63", "950": "#083344" },
  sky: { "50": "#f0f9ff", "100": "#e0f2fe", "200": "#bae6fd", "300": "#7dd3fc", "400": "#38bdf8", "500": "#0ea5e9", "600": "#0284c7", "700": "#0369a1", "800": "#075985", "900": "#0c4a6e", "950": "#082f49" },
  blue: { "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd", "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a", "950": "#172554" },
  indigo: { "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc", "400": "#818cf8", "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca", "800": "#3730a3", "900": "#312e81", "950": "#1e1b4b" },
  violet: { "50": "#f5f3ff", "100": "#ede9fe", "200": "#ddd6fe", "300": "#c4b5fd", "400": "#a78bfa", "500": "#8b5cf6", "600": "#7c3aed", "700": "#6d28d9", "800": "#5b21b6", "900": "#4c1d95", "950": "#2e1065" },
  purple: { "50": "#faf5ff", "100": "#f3e8ff", "200": "#e9d5ff", "300": "#d8b4fe", "400": "#c084fc", "500": "#a855f7", "600": "#9333ea", "700": "#7e22ce", "800": "#6b21a8", "900": "#581c87", "950": "#3b0764" },
  fuchsia: { "50": "#fdf4ff", "100": "#fae8ff", "200": "#f5d0fe", "300": "#f0abfc", "400": "#e879f9", "500": "#d946ef", "600": "#c026d3", "700": "#a21caf", "800": "#86198f", "900": "#701a75", "950": "#4a044e" },
  pink: { "50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4", "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d", "800": "#9d174d", "900": "#831843", "950": "#500724" },
  rose: { "50": "#fff1f2", "100": "#ffe4e6", "200": "#fecdd3", "300": "#fda4af", "400": "#fb7185", "500": "#f43f5e", "600": "#e11d48", "700": "#be123c", "800": "#9f1239", "900": "#881337", "950": "#4c0519" },
};

interface TailwindMatch {
  name: string;
  hex: string;
  distance: number;
}

function findNearestTailwind(r: number, g: number, b: number, count: number = 6): TailwindMatch[] {
  const results: TailwindMatch[] = [];
  for (const [family, shades] of Object.entries(TAILWIND_COLORS)) {
    for (const [shade, hex] of Object.entries(shades)) {
      const [tr, tg, tb] = hexToRgb(hex);
      const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
      results.push({ name: `${family}-${shade}`, hex, distance: dist });
    }
  }
  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, count);
}

/* ------------------------------------------------------------------ */
/*  Color harmony functions                                            */
/* ------------------------------------------------------------------ */

function getComplementary(h: number, s: number, l: number): [number, number, number][] {
  return [[(h + 180) % 360, s, l]];
}

function getAnalogous(h: number, s: number, l: number): [number, number, number][] {
  return [
    [(h + 30) % 360, s, l],
    [(h + 330) % 360, s, l],
  ];
}

function getTriadic(h: number, s: number, l: number): [number, number, number][] {
  return [
    [(h + 120) % 360, s, l],
    [(h + 240) % 360, s, l],
  ];
}

function getSplitComplementary(h: number, s: number, l: number): [number, number, number][] {
  return [
    [(h + 150) % 360, s, l],
    [(h + 210) % 360, s, l],
  ];
}

/* ------------------------------------------------------------------ */
/*  Copy button component                                              */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)] shrink-0"
      aria-label={`Copy ${text}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check size={14} style={{ color: "#16a34a" }} />
      ) : (
        <Copy size={14} style={{ color: "var(--muted)" }} />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Slider input component                                             */
/* ------------------------------------------------------------------ */

function SliderInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  trackColor,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
  trackColor?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium w-5 text-[var(--muted)] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: trackColor || "var(--accent)",
          background: `linear-gradient(to right, ${trackColor || "var(--accent)"} ${((value - min) / (max - min)) * 100}%, var(--border) ${((value - min) / (max - min)) * 100}%)`,
        }}
        aria-label={`${label} value`}
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-14 px-1.5 py-1 rounded-md border text-xs font-mono text-center"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
        aria-label={`${label} numeric input`}
      />
      {suffix && <span className="text-[10px] text-[var(--muted)] w-3 shrink-0">{suffix}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Format card component                                              */
/* ------------------------------------------------------------------ */

function FormatCard({
  title,
  copyValue,
  children,
}: {
  title: string;
  copyValue: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          <code
            className="text-[11px] font-mono px-2 py-0.5 rounded-md"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          >
            {copyValue}
          </code>
          <CopyButton text={copyValue} />
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Harmony swatch component                                           */
/* ------------------------------------------------------------------ */

function HarmonySection({
  label,
  colors,
  onSelect,
}: {
  label: string;
  colors: [number, number, number][];
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <div className="flex gap-1.5">
        {colors.map((hsl, i) => {
          const [r, g, b] = hslToRgb(hsl[0], hsl[1], hsl[2]);
          const hex = rgbToHex(r, g, b);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(hex)}
              className="w-8 h-8 rounded-lg border cursor-pointer transition-transform hover:scale-110"
              style={{ backgroundColor: hex, borderColor: "var(--border)" }}
              title={hex}
              aria-label={`Select ${label} color ${hex}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

function normalizeHex(hex: string): string {
  let h = hex.startsWith("#") ? hex : "#" + hex;
  if (h.length === 4) {
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return h.toLowerCase();
}

export default function ColorConverterPage() {
  const [rgb, setRgbState] = useState<[number, number, number]>([37, 99, 235]);
  const [hexInput, setHexInput] = useState("#2563eb");

  const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
  const hsl = useMemo(() => rgbToHsl(rgb[0], rgb[1], rgb[2]), [rgb]);
  const hsb = useMemo(() => rgbToHsb(rgb[0], rgb[1], rgb[2]), [rgb]);
  const cmyk = useMemo(() => rgbToCmyk(rgb[0], rgb[1], rgb[2]), [rgb]);
  const tailwindMatches = useMemo(() => findNearestTailwind(rgb[0], rgb[1], rgb[2], 8), [rgb]);

  const harmonies = useMemo(() => {
    return {
      complementary: getComplementary(hsl[0], hsl[1], hsl[2]),
      analogous: getAnalogous(hsl[0], hsl[1], hsl[2]),
      triadic: getTriadic(hsl[0], hsl[1], hsl[2]),
      splitComplementary: getSplitComplementary(hsl[0], hsl[1], hsl[2]),
    };
  }, [hsl]);

  /* Unified update helpers */
  const updateFromRgb = useCallback((r: number, g: number, b: number) => {
    setRgbState([r, g, b]);
    setHexInput(rgbToHex(r, g, b));
  }, []);

  const updateFromHex = useCallback((h: string) => {
    setHexInput(h);
    if (isValidHex(h)) {
      const normalized = normalizeHex(h);
      const [r, g, b] = hexToRgb(normalized);
      setRgbState([r, g, b]);
    }
  }, []);

  const updateFromHsl = useCallback((h: number, s: number, l: number) => {
    const [r, g, b] = hslToRgb(h, s, l);
    setRgbState([r, g, b]);
    setHexInput(rgbToHex(r, g, b));
  }, []);

  const updateFromHsb = useCallback((h: number, s: number, bv: number) => {
    const [r, g, b] = hsbToRgb(h, s, bv);
    setRgbState([r, g, b]);
    setHexInput(rgbToHex(r, g, b));
  }, []);

  const updateFromCmyk = useCallback((c: number, m: number, y: number, k: number) => {
    const [r, g, b] = cmykToRgb(c, m, y, k);
    setRgbState([r, g, b]);
    setHexInput(rgbToHex(r, g, b));
  }, []);

  const selectHarmonyColor = useCallback(
    (hexVal: string) => {
      const [r, g, b] = hexToRgb(hexVal);
      updateFromRgb(r, g, b);
    },
    [updateFromRgb],
  );

  /* Contrast text for the swatch */
  const textColor = useMemo(() => {
    const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }, [rgb]);

  /* Format strings */
  const rgbString = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  const hslString = `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`;
  const hsbString = `hsb(${hsb[0]}, ${hsb[1]}%, ${hsb[2]}%)`;
  const cmykString = `cmyk(${cmyk[0]}%, ${cmyk[1]}%, ${cmyk[2]}%, ${cmyk[3]}%)`;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="Back to tools"
        >
          <ArrowLeft size={20} />
        </Link>
        <Pipette size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-lg font-semibold tracking-tight">Color Converter</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-6 flex flex-col gap-5">
          {/* Large color swatch preview */}
          <div
            className="w-full rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: hex, height: 200 }}
          >
            <span
              className="text-2xl font-mono font-bold tracking-wider select-all"
              style={{ color: textColor }}
            >
              {hex}
            </span>
          </div>

          {/* Color picker row */}
          <div className="flex items-center gap-3">
            <label
              className="w-12 h-12 rounded-xl border cursor-pointer shrink-0 relative overflow-hidden"
              style={{ backgroundColor: hex, borderColor: "var(--border)" }}
            >
              <input
                type="color"
                value={hex}
                onChange={(e) => {
                  const [r, g, b] = hexToRgb(e.target.value);
                  updateFromRgb(r, g, b);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Color picker"
              />
            </label>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => updateFromHex(e.target.value)}
              onBlur={() => setHexInput(hex)}
              className="flex-1 px-3 py-2.5 rounded-xl border text-sm font-mono"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
              }}
              placeholder="#000000"
              spellCheck={false}
              aria-label="Hex color input"
            />
          </div>

          {/* Color Harmony */}
          <div
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Color Harmony
            </span>
            <div className="flex flex-wrap gap-4">
              <HarmonySection
                label="Complementary"
                colors={harmonies.complementary}
                onSelect={selectHarmonyColor}
              />
              <HarmonySection
                label="Analogous"
                colors={harmonies.analogous}
                onSelect={selectHarmonyColor}
              />
              <HarmonySection
                label="Triadic"
                colors={harmonies.triadic}
                onSelect={selectHarmonyColor}
              />
              <HarmonySection
                label="Split-Comp."
                colors={harmonies.splitComplementary}
                onSelect={selectHarmonyColor}
              />
            </div>
          </div>

          {/* HEX */}
          <FormatCard title="HEX" copyValue={hex}>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => updateFromHex(e.target.value)}
              onBlur={() => setHexInput(hex)}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
              spellCheck={false}
              aria-label="Hex value"
            />
          </FormatCard>

          {/* RGB */}
          <FormatCard title="RGB" copyValue={rgbString}>
            <div className="flex flex-col gap-2">
              <SliderInput
                label="R"
                value={rgb[0]}
                min={0}
                max={255}
                trackColor="#ef4444"
                onChange={(v) => updateFromRgb(v, rgb[1], rgb[2])}
              />
              <SliderInput
                label="G"
                value={rgb[1]}
                min={0}
                max={255}
                trackColor="#22c55e"
                onChange={(v) => updateFromRgb(rgb[0], v, rgb[2])}
              />
              <SliderInput
                label="B"
                value={rgb[2]}
                min={0}
                max={255}
                trackColor="#3b82f6"
                onChange={(v) => updateFromRgb(rgb[0], rgb[1], v)}
              />
            </div>
          </FormatCard>

          {/* HSL */}
          <FormatCard title="HSL" copyValue={hslString}>
            <div className="flex flex-col gap-2">
              <SliderInput
                label="H"
                value={hsl[0]}
                min={0}
                max={360}
                suffix={"\u00B0"}
                onChange={(v) => updateFromHsl(v, hsl[1], hsl[2])}
              />
              <SliderInput
                label="S"
                value={hsl[1]}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => updateFromHsl(hsl[0], v, hsl[2])}
              />
              <SliderInput
                label="L"
                value={hsl[2]}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => updateFromHsl(hsl[0], hsl[1], v)}
              />
            </div>
          </FormatCard>

          {/* HSB/HSV */}
          <FormatCard title="HSB / HSV" copyValue={hsbString}>
            <div className="flex flex-col gap-2">
              <SliderInput
                label="H"
                value={hsb[0]}
                min={0}
                max={360}
                suffix={"\u00B0"}
                onChange={(v) => updateFromHsb(v, hsb[1], hsb[2])}
              />
              <SliderInput
                label="S"
                value={hsb[1]}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => updateFromHsb(hsb[0], v, hsb[2])}
              />
              <SliderInput
                label="B"
                value={hsb[2]}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => updateFromHsb(hsb[0], hsb[1], v)}
              />
            </div>
          </FormatCard>

          {/* CMYK */}
          <FormatCard title="CMYK" copyValue={cmykString}>
            <div className="flex flex-col gap-2">
              <SliderInput
                label="C"
                value={cmyk[0]}
                min={0}
                max={100}
                suffix="%"
                trackColor="#06b6d4"
                onChange={(v) => updateFromCmyk(v, cmyk[1], cmyk[2], cmyk[3])}
              />
              <SliderInput
                label="M"
                value={cmyk[1]}
                min={0}
                max={100}
                suffix="%"
                trackColor="#ec4899"
                onChange={(v) => updateFromCmyk(cmyk[0], v, cmyk[2], cmyk[3])}
              />
              <SliderInput
                label="Y"
                value={cmyk[2]}
                min={0}
                max={100}
                suffix="%"
                trackColor="#eab308"
                onChange={(v) => updateFromCmyk(cmyk[0], cmyk[1], v, cmyk[3])}
              />
              <SliderInput
                label="K"
                value={cmyk[3]}
                min={0}
                max={100}
                suffix="%"
                trackColor="#171717"
                onChange={(v) => updateFromCmyk(cmyk[0], cmyk[1], cmyk[2], v)}
              />
            </div>
          </FormatCard>

          {/* Tailwind */}
          <div
            className="rounded-xl border p-4 flex flex-col gap-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Tailwind
              </span>
              {tailwindMatches[0] && (
                <div className="flex items-center gap-1.5">
                  <code
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                    style={{ background: "var(--background)", color: "var(--foreground)" }}
                  >
                    {tailwindMatches[0].name}
                  </code>
                  <CopyButton text={tailwindMatches[0].name} />
                </div>
              )}
            </div>

            {/* Closest match */}
            {tailwindMatches[0] && (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border shrink-0"
                  style={{ backgroundColor: tailwindMatches[0].hex, borderColor: "var(--border)" }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {tailwindMatches[0].name}
                  </span>
                  <span className="text-xs font-mono text-[var(--muted)]">
                    {tailwindMatches[0].hex}
                    {tailwindMatches[0].distance > 0 &&
                      ` (distance: ${tailwindMatches[0].distance.toFixed(1)})`}
                  </span>
                </div>
              </div>
            )}

            {/* Nearby palette */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Nearby Colors
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tailwindMatches.map((match) => (
                  <button
                    key={match.name}
                    type="button"
                    onClick={() => selectHarmonyColor(match.hex)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border)" }}
                    title={`${match.name} ${match.hex}`}
                  >
                    <div
                      className="w-4 h-4 rounded shrink-0"
                      style={{ backgroundColor: match.hex }}
                    />
                    <span className="font-mono text-[11px]" style={{ color: "var(--foreground)" }}>
                      {match.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Spacer at bottom */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

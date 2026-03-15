"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Check, Eye, Sparkles, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Color utility functions                                            */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2]
      : cleaned;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => {
        const clamped = Math.max(0, Math.min(255, Math.round(c)));
        return clamped.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
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
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/** Adjust foreground lightness to meet a target contrast ratio against a background */
function autoFixForeground(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
  targetRatio: number,
): { r: number; g: number; b: number } {
  const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
  const { h, s } = rgbToHsl(fg.r, fg.g, fg.b);

  // Try darkening first, then lightening; pick the one closest to original lightness
  const candidates: { r: number; g: number; b: number }[] = [];

  // Search darker direction
  for (let l = 0; l <= 1; l += 0.001) {
    const rgb = hslToRgb(h, s, l);
    const fgLum = relativeLuminance(rgb.r, rgb.g, rgb.b);
    if (contrastRatio(fgLum, bgLum) >= targetRatio) {
      candidates.push(rgb);
      break;
    }
  }

  // Search lighter direction
  for (let l = 1; l >= 0; l -= 0.001) {
    const rgb = hslToRgb(h, s, l);
    const fgLum = relativeLuminance(rgb.r, rgb.g, rgb.b);
    if (contrastRatio(fgLum, bgLum) >= targetRatio) {
      candidates.push(rgb);
      break;
    }
  }

  if (candidates.length === 0) return fg;

  // Pick the candidate closest to the original lightness
  const originalL = rgbToHsl(fg.r, fg.g, fg.b).l;
  let best = candidates[0];
  let bestDist = Math.abs(rgbToHsl(best.r, best.g, best.b).l - originalL);
  for (const c of candidates) {
    const dist = Math.abs(rgbToHsl(c.r, c.g, c.b).l - originalL);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }

  return best;
}

function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

function clampChannel(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(255, num));
}

/* ------------------------------------------------------------------ */
/*  WCAG criteria                                                      */
/* ------------------------------------------------------------------ */

interface WcagResult {
  label: string;
  required: number;
  pass: boolean;
}

function getWcagResults(ratio: number): WcagResult[] {
  return [
    { label: "AA Normal Text", required: 4.5, pass: ratio >= 4.5 },
    { label: "AA Large Text", required: 3, pass: ratio >= 3 },
    { label: "AAA Normal Text", required: 7, pass: ratio >= 7 },
    { label: "AAA Large Text", required: 4.5, pass: ratio >= 4.5 },
  ];
}

/* ------------------------------------------------------------------ */
/*  Color picker panel component                                       */
/* ------------------------------------------------------------------ */

function ColorPanel({
  label,
  color,
  onChange,
}: {
  label: string;
  color: { r: number; g: number; b: number };
  onChange: (c: { r: number; g: number; b: number }) => void;
}) {
  const hex = rgbToHex(color.r, color.g, color.b);
  const [hexInput, setHexInput] = useState(hex);

  // Keep local hex input in sync when color changes externally
  const currentHex = rgbToHex(color.r, color.g, color.b);
  if (currentHex !== hexInput && isValidHex(hexInput) && rgbToHex(...Object.values(hexToRgb(hexInput)) as [number, number, number]) !== currentHex) {
    setHexInput(currentHex);
  }

  return (
    <div
      className="flex-1 rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>

      {/* Swatch + color picker */}
      <div className="flex items-center gap-3">
        <label
          className="w-14 h-14 rounded-lg border cursor-pointer shrink-0 relative overflow-hidden"
          style={{ backgroundColor: hex, borderColor: "var(--border)" }}
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              setHexInput(e.target.value);
              onChange(rgb);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label={`${label} color picker`}
          />
        </label>

        {/* Hex input */}
        <div className="flex-1">
          <label className="block text-[11px] text-[var(--muted)] mb-1">HEX</label>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              const val = e.target.value;
              setHexInput(val);
              const check = val.startsWith("#") ? val : "#" + val;
              if (isValidHex(check)) {
                onChange(hexToRgb(check));
              }
            }}
            onBlur={() => setHexInput(rgbToHex(color.r, color.g, color.b))}
            className="w-full px-2.5 py-1.5 rounded-lg border text-sm font-mono"
            style={{
              borderColor: "var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
            }}
            spellCheck={false}
            aria-label={`${label} hex value`}
          />
        </div>
      </div>

      {/* RGB inputs */}
      <div className="grid grid-cols-3 gap-2">
        {(["r", "g", "b"] as const).map((ch) => (
          <div key={ch}>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{ch.toUpperCase()}</label>
            <input
              type="number"
              min={0}
              max={255}
              value={color[ch]}
              onChange={(e) => {
                onChange({ ...color, [ch]: clampChannel(e.target.value) });
                setHexInput(rgbToHex(
                  ch === "r" ? clampChannel(e.target.value) : color.r,
                  ch === "g" ? clampChannel(e.target.value) : color.g,
                  ch === "b" ? clampChannel(e.target.value) : color.b,
                ));
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border text-sm font-mono text-center"
              style={{
                borderColor: "var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
              aria-label={`${label} ${ch.toUpperCase()} channel`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function ContrastCheckerPage() {
  const [fg, setFg] = useState({ r: 33, g: 33, b: 33 });
  const [bg, setBg] = useState({ r: 255, g: 255, b: 255 });

  const fgLum = useMemo(() => relativeLuminance(fg.r, fg.g, fg.b), [fg]);
  const bgLum = useMemo(() => relativeLuminance(bg.r, bg.g, bg.b), [bg]);
  const ratio = useMemo(() => contrastRatio(fgLum, bgLum), [fgLum, bgLum]);
  const wcag = useMemo(() => getWcagResults(ratio), [ratio]);

  const passCount = wcag.filter((w) => w.pass).length;
  const ratioColor = passCount === 4 ? "#16a34a" : passCount > 0 ? "#ca8a04" : "#dc2626";

  const swapColors = useCallback(() => {
    setFg(bg);
    setBg(fg);
  }, [fg, bg]);

  const handleAutoFix = useCallback(() => {
    const fixed = autoFixForeground(fg, bg, 4.5);
    setFg(fixed);
  }, [fg, bg]);

  const fgHex = rgbToHex(fg.r, fg.g, fg.b);
  const bgHex = rgbToHex(bg.r, bg.g, bg.b);

  const suggestion = useMemo(() => {
    if (ratio >= 4.5) return null;
    const fixed = autoFixForeground(fg, bg, 4.5);
    return rgbToHex(fixed.r, fixed.g, fixed.b);
  }, [fg, bg, ratio]);

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
        <Eye size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-lg font-semibold tracking-tight">Contrast Checker</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 flex flex-col gap-6">
          {/* Color pickers row */}
          <div className="flex items-stretch gap-3">
            <ColorPanel label="Foreground" color={fg} onChange={setFg} />

            {/* Swap button */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={swapColors}
                className="p-2.5 rounded-xl border transition-colors hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                aria-label="Swap foreground and background colors"
              >
                <ArrowLeftRight size={18} />
              </button>
            </div>

            <ColorPanel label="Background" color={bg} onChange={setBg} />
          </div>

          {/* Contrast ratio display */}
          <div
            className="rounded-xl border p-6 flex flex-col items-center gap-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {/* Large ratio number */}
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] mb-2">
                Contrast Ratio
              </p>
              <p
                className="text-5xl md:text-6xl font-bold tabular-nums tracking-tight"
                style={{ color: ratioColor }}
              >
                {ratio.toFixed(2)}
                <span className="text-2xl md:text-3xl font-semibold">:1</span>
              </p>
            </div>

            {/* WCAG badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {wcag.map((result) => (
                <span
                  key={result.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{
                    background: result.pass ? "#16a34a" : "#dc2626",
                  }}
                >
                  {result.pass ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                  {result.label}
                  <span className="opacity-75 ml-0.5">({result.required}:1)</span>
                </span>
              ))}
            </div>

            {/* Suggestion / auto-fix */}
            {suggestion && (
              <div
                className="flex items-center gap-3 mt-2 px-4 py-2.5 rounded-lg border"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <span
                  className="w-6 h-6 rounded shrink-0 border"
                  style={{ backgroundColor: suggestion, borderColor: "var(--border)" }}
                />
                <span className="text-sm text-[var(--muted)]">
                  Suggested foreground: <span className="font-mono font-medium text-[var(--foreground)]">{suggestion}</span>
                </span>
                <button
                  type="button"
                  onClick={handleAutoFix}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white transition-colors"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <Sparkles size={13} />
                  Auto-fix
                </button>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-2.5 border-b"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                Live Preview
              </span>
            </div>

            {/* Text preview area */}
            <div
              className="p-8 md:p-10 flex flex-col gap-4"
              style={{ backgroundColor: bgHex }}
            >
              <p style={{ color: fgHex, fontSize: "24px", fontWeight: 700, lineHeight: 1.3 }}>
                Large Text Preview (24px Bold)
              </p>
              <p style={{ color: fgHex, fontSize: "18px", fontWeight: 700, lineHeight: 1.4 }}>
                Large Text Preview (18px Bold)
              </p>
              <p style={{ color: fgHex, fontSize: "16px", fontWeight: 400, lineHeight: 1.5 }}>
                Normal text preview at 16px. The quick brown fox jumps over the lazy dog. This
                demonstrates how your text will appear with the selected color combination.
              </p>
              <p style={{ color: fgHex, fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }}>
                Small body text at 14px for secondary content and captions. Ensure adequate contrast
                for comfortable reading across all text sizes.
              </p>
            </div>

            {/* Color swatches */}
            <div
              className="flex border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex-1 flex items-center gap-3 px-4 py-3" style={{ background: "var(--surface)" }}>
                <span
                  className="w-10 h-10 rounded-lg border shrink-0"
                  style={{ backgroundColor: fgHex, borderColor: "var(--border)" }}
                />
                <span className="flex flex-col">
                  <span className="text-[11px] text-[var(--muted)]">Foreground</span>
                  <span className="text-sm font-mono font-medium">{fgHex}</span>
                </span>
              </div>
              <div
                className="w-px"
                style={{ background: "var(--border)" }}
              />
              <div className="flex-1 flex items-center gap-3 px-4 py-3" style={{ background: "var(--surface)" }}>
                <span
                  className="w-10 h-10 rounded-lg border shrink-0"
                  style={{ backgroundColor: bgHex, borderColor: "var(--border)" }}
                />
                <span className="flex flex-col">
                  <span className="text-[11px] text-[var(--muted)]">Background</span>
                  <span className="text-sm font-mono font-medium">{bgHex}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

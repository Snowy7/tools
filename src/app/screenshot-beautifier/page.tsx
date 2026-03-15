"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Download,
  Monitor,
  Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface GradientPreset {
  name: string;
  colors: [string, string];
  angle: number;
}

type BgType = "solid" | "gradient" | "preset";
type FrameType = "none" | "browser" | "window" | "phone";
type FrameTheme = "light" | "dark";
type WatermarkPosition = "bottom-left" | "bottom-center" | "bottom-right";
type AspectPreset = "auto" | "16:9" | "4:3" | "1:1" | "twitter" | "instagram";

const GRADIENT_PRESETS: GradientPreset[] = [
  { name: "Ocean", colors: ["#667eea", "#764ba2"], angle: 135 },
  { name: "Sunset", colors: ["#f093fb", "#f5576c"], angle: 135 },
  { name: "Mint", colors: ["#43e97b", "#38f9d7"], angle: 135 },
  { name: "Fire", colors: ["#f83600", "#f9d423"], angle: 135 },
  { name: "Night", colors: ["#0f0c29", "#302b63"], angle: 135 },
  { name: "Sky", colors: ["#2196f3", "#21cbf3"], angle: 135 },
  { name: "Peach", colors: ["#ffecd2", "#fcb69f"], angle: 135 },
  { name: "Lavender", colors: ["#a18cd1", "#fbc2eb"], angle: 135 },
  { name: "Emerald", colors: ["#11998e", "#38ef7d"], angle: 135 },
  { name: "Rose", colors: ["#ee9ca7", "#ffdde1"], angle: 135 },
  { name: "Slate", colors: ["#2c3e50", "#4ca1af"], angle: 135 },
  { name: "Carbon", colors: ["#1a1a2e", "#16213e"], angle: 135 },
];

const ASPECT_RATIOS: Record<AspectPreset, { w: number; h: number } | null> = {
  auto: null,
  "16:9": { w: 16, h: 9 },
  "4:3": { w: 4, h: 3 },
  "1:1": { w: 1, h: 1 },
  twitter: { w: 1200, h: 675 },
  instagram: { w: 1080, h: 1080 },
};

/* ------------------------------------------------------------------ */
/*  Settings state                                                     */
/* ------------------------------------------------------------------ */

interface Settings {
  bgType: BgType;
  bgSolid: string;
  bgGradientA: string;
  bgGradientB: string;
  bgGradientAngle: number;
  bgPresetIndex: number;
  padding: number;

  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;

  cornerRadius: number;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;

  frameType: FrameType;
  frameTheme: FrameTheme;

  canvasWidth: number;
  aspectPreset: AspectPreset;

  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkFontSize: number;
  watermarkOpacity: number;
}

const DEFAULT_SETTINGS: Settings = {
  bgType: "preset",
  bgSolid: "#6366f1",
  bgGradientA: "#667eea",
  bgGradientB: "#764ba2",
  bgGradientAngle: 135,
  bgPresetIndex: 0,
  padding: 60,

  shadowEnabled: true,
  shadowColor: "rgba(0,0,0,0.3)",
  shadowBlur: 40,
  shadowOffsetX: 0,
  shadowOffsetY: 0,

  cornerRadius: 12,
  borderEnabled: false,
  borderColor: "#ffffff",
  borderWidth: 2,

  frameType: "none",
  frameTheme: "light",

  canvasWidth: 1200,
  aspectPreset: "auto",

  watermarkText: "",
  watermarkPosition: "bottom-right",
  watermarkFontSize: 14,
  watermarkOpacity: 50,
};

/* ------------------------------------------------------------------ */
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function Section({
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
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small reusable UI pieces                                           */
/* ------------------------------------------------------------------ */

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono tabular-nums">{value}</span>
        <input
          type="color"
          value={value.startsWith("rgba") ? "#000000" : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
          style={{ borderColor: "var(--border)" }}
        />
      </div>
    </label>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: value ? "var(--accent)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: value ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex rounded-lg p-0.5 gap-0.5"
      style={{ background: "var(--background)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="flex-1 text-[11px] font-medium py-1.5 rounded-md transition-colors"
          style={{
            background: value === opt.value ? "var(--surface)" : "transparent",
            color: value === opt.value ? "var(--foreground)" : "var(--muted)",
            boxShadow: value === opt.value ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas rendering helpers                                           */
/* ------------------------------------------------------------------ */

function resolveCanvasSize(
  s: Settings,
  imgW: number,
  imgH: number,
): { width: number; height: number } {
  const ratio = ASPECT_RATIOS[s.aspectPreset];
  if (!ratio) {
    // auto: derive from image + padding
    const frameExtra = s.frameType !== "none" ? (s.frameType === "phone" ? 40 : 36) : 0;
    const w = s.canvasWidth;
    const innerW = w - s.padding * 2;
    const scale = innerW / imgW;
    const innerH = imgH * scale + frameExtra;
    return { width: w, height: Math.round(innerH + s.padding * 2) };
  }
  if (s.aspectPreset === "twitter") return { width: 1200, height: 675 };
  if (s.aspectPreset === "instagram") return { width: 1080, height: 1080 };
  const h = Math.round(s.canvasWidth / (ratio.w / ratio.h));
  return { width: s.canvasWidth, height: h };
}

function drawGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colorA: string,
  colorB: string,
  angleDeg: number,
) {
  const rad = (angleDeg * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.sqrt(w * w + h * h) / 2;
  const x0 = cx - Math.cos(rad) * len;
  const y0 = cy - Math.sin(rad) * len;
  const x1 = cx + Math.cos(rad) * len;
  const y1 = cy + Math.sin(rad) * len;
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBrowserFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  barH: number,
  radius: number,
  theme: FrameTheme,
) {
  const bg = theme === "light" ? "#f0f0f0" : "#2a2a2a";
  const urlBg = theme === "light" ? "#ffffff" : "#1a1a1a";
  const urlText = theme === "light" ? "#999999" : "#666666";

  // Title bar background
  ctx.save();
  roundedRectPath(ctx, x, y, w, barH, radius);
  // Square off the bottom corners
  ctx.rect(x, y + barH - radius, w, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();

  // Traffic lights
  const dotY = y + barH / 2;
  const dotR = 5.5;
  const dotColors = ["#ff5f57", "#febc2e", "#28c840"];
  dotColors.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(x + 16 + i * 20, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });

  // URL bar
  const urlBarX = x + 80;
  const urlBarW = w - 160;
  const urlBarH = 22;
  const urlBarY = y + (barH - urlBarH) / 2;
  roundedRectPath(ctx, urlBarX, urlBarY, urlBarW, urlBarH, 6);
  ctx.fillStyle = urlBg;
  ctx.fill();

  ctx.fillStyle = urlText;
  ctx.font = "12px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("https://example.com", urlBarX + urlBarW / 2, urlBarY + urlBarH / 2);
}

function drawWindowFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  barH: number,
  radius: number,
  theme: FrameTheme,
) {
  const bg = theme === "light" ? "#e8e8e8" : "#333333";
  const btnColor = theme === "light" ? "#cccccc" : "#555555";

  ctx.save();
  roundedRectPath(ctx, x, y, w, barH, radius);
  ctx.rect(x, y + barH - radius, w, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();

  // Close / minimize / maximize
  const btnY = y + barH / 2;
  const symbols = ["\u00d7", "\u2013", "+"];
  symbols.forEach((s, i) => {
    const bx = x + w - 18 - i * 28;
    ctx.beginPath();
    ctx.arc(bx, btnY, 8, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "#ff5f57" : btnColor;
    ctx.fill();
    ctx.fillStyle = theme === "light" ? "#666" : "#aaa";
    ctx.font = "bold 11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s, bx, btnY);
  });
}

function drawPhoneFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FrameTheme,
) {
  const border = theme === "light" ? "#d0d0d0" : "#444444";
  const notchBg = theme === "light" ? "#222222" : "#111111";
  const bezel = 8;
  const outerR = 28;

  // Outer bezel
  ctx.strokeStyle = border;
  ctx.lineWidth = bezel;
  roundedRectPath(ctx, x - bezel / 2, y - bezel / 2, w + bezel, h + bezel, outerR);
  ctx.stroke();

  // Notch
  const notchW = w * 0.35;
  const notchH = 18;
  const notchX = x + (w - notchW) / 2;
  const notchY = y - bezel / 2;
  roundedRectPath(ctx, notchX, notchY, notchW, notchH, 8);
  ctx.fillStyle = notchBg;
  ctx.fill();
}

function renderCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  s: Settings,
) {
  const { width: cw, height: ch } = resolveCanvasSize(s, img.naturalWidth, img.naturalHeight);
  ctx.canvas.width = cw;
  ctx.canvas.height = ch;

  // 1. Background
  if (s.bgType === "solid") {
    ctx.fillStyle = s.bgSolid;
    ctx.fillRect(0, 0, cw, ch);
  } else if (s.bgType === "gradient") {
    drawGradient(ctx, cw, ch, s.bgGradientA, s.bgGradientB, s.bgGradientAngle);
  } else {
    const preset = GRADIENT_PRESETS[s.bgPresetIndex] ?? GRADIENT_PRESETS[0];
    drawGradient(ctx, cw, ch, preset.colors[0], preset.colors[1], preset.angle);
  }

  // 2. Calculate screenshot position
  const frameBarH = s.frameType === "browser" || s.frameType === "window" ? 36 : 0;
  const phoneExtra = s.frameType === "phone" ? 20 : 0;
  const maxImgW = cw - s.padding * 2;
  const maxImgH = ch - s.padding * 2 - frameBarH - phoneExtra * 2;
  const scale = Math.min(maxImgW / img.naturalWidth, maxImgH / img.naturalHeight, 1);
  const imgW = img.naturalWidth * scale;
  const imgH = img.naturalHeight * scale;
  const imgX = (cw - imgW) / 2;
  const imgY = (ch - imgH - frameBarH) / 2 + frameBarH;

  // Combined frame rect (frame bar + image)
  const frameX = imgX;
  const frameY = imgY - frameBarH;
  const frameW = imgW;
  const frameH = imgH + frameBarH;

  // 3. Shadow
  if (s.shadowEnabled) {
    ctx.save();
    ctx.shadowColor = s.shadowColor;
    ctx.shadowBlur = s.shadowBlur;
    ctx.shadowOffsetX = s.shadowOffsetX;
    ctx.shadowOffsetY = s.shadowOffsetY;
    roundedRectPath(ctx, frameX, frameY, frameW, frameH, s.cornerRadius);
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fill();
    ctx.restore();
  }

  // 4. Frame
  if (s.frameType === "browser") {
    drawBrowserFrame(ctx, frameX, frameY, frameW, frameBarH, s.cornerRadius, s.frameTheme);
  } else if (s.frameType === "window") {
    drawWindowFrame(ctx, frameX, frameY, frameW, frameBarH, s.cornerRadius, s.frameTheme);
  }

  // 5. Draw screenshot with rounded corners
  ctx.save();
  const clipY = frameBarH > 0 ? imgY : imgY;
  const clipR = s.cornerRadius;
  const bottomR = clipR;
  const topR = frameBarH > 0 ? 0 : clipR;

  ctx.beginPath();
  ctx.moveTo(imgX + topR, clipY);
  ctx.lineTo(imgX + imgW - topR, clipY);
  if (topR > 0) ctx.quadraticCurveTo(imgX + imgW, clipY, imgX + imgW, clipY + topR);
  else ctx.lineTo(imgX + imgW, clipY);
  ctx.lineTo(imgX + imgW, clipY + imgH - bottomR);
  ctx.quadraticCurveTo(imgX + imgW, clipY + imgH, imgX + imgW - bottomR, clipY + imgH);
  ctx.lineTo(imgX + bottomR, clipY + imgH);
  ctx.quadraticCurveTo(imgX, clipY + imgH, imgX, clipY + imgH - bottomR);
  ctx.lineTo(imgX, clipY + topR);
  if (topR > 0) ctx.quadraticCurveTo(imgX, clipY, imgX + topR, clipY);
  else ctx.lineTo(imgX, clipY);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, imgX, clipY, imgW, imgH);
  ctx.restore();

  // 5b. Border
  if (s.borderEnabled) {
    ctx.save();
    ctx.strokeStyle = s.borderColor;
    ctx.lineWidth = s.borderWidth;
    roundedRectPath(ctx, frameX, frameY, frameW, frameH, s.cornerRadius);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Phone frame (drawn over the image)
  if (s.frameType === "phone") {
    drawPhoneFrame(ctx, imgX, imgY, imgW, imgH, s.frameTheme);
  }

  // 7. Watermark
  if (s.watermarkText.trim()) {
    ctx.save();
    ctx.globalAlpha = s.watermarkOpacity / 100;
    ctx.font = `${s.watermarkFontSize}px -apple-system, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "bottom";
    const wPad = 20;
    const wY = ch - wPad;
    if (s.watermarkPosition === "bottom-left") {
      ctx.textAlign = "left";
      ctx.fillText(s.watermarkText, wPad, wY);
    } else if (s.watermarkPosition === "bottom-center") {
      ctx.textAlign = "center";
      ctx.fillText(s.watermarkText, cw / 2, wY);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(s.watermarkText, cw - wPad, wY);
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ScreenshotBeautifierPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const set = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /* ---- Load image ---- */
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (imageRef.current) URL.revokeObjectURL(imageRef.current.src);
      imageRef.current = img;
      setImage(img);
    };
    img.src = url;
  }, []);

  /* ---- Paste handler ---- */
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) loadFile(file);
          break;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  /* ---- Render loop ---- */
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      renderCanvas(ctx, image, settings);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [image, settings]);

  /* ---- Export ---- */
  function exportPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "screenshot-beautified.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function copyToClipboard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/png"),
    );
    if (blob) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    }
  }

  /* ---- Drag/drop ---- */
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  /* ---- Render ---- */
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--background)" }}
    >
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
        <Monitor size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-lg font-semibold tracking-tight">
          Screenshot Beautifier
        </h1>
        <div className="flex-1" />
        {image && (
          <>
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderColor: "var(--border)" }}
            >
              <Clipboard size={15} />
              Copy
            </button>
            <button
              type="button"
              onClick={exportPNG}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--accent)", color: "#fff" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent)")
              }
            >
              <Download size={15} />
              Export PNG
            </button>
          </>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = "";
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {!image ? (
          /* Drop zone */
          <div
            className="flex-1 flex items-center justify-center p-4 md:p-8"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`w-full max-w-lg rounded-2xl border-2 border-dashed p-10 md:p-14 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-200 ${
                  isDragging
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                <Upload size={28} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm mb-0.5">
                  Drop screenshot here or click to upload
                </p>
                <p className="text-xs text-[var(--muted)]">
                  PNG, JPG, WebP -- or paste from clipboard (Ctrl+V)
                </p>
              </div>
            </button>
          </div>
        ) : (
          <>
            {/* Left: Canvas preview */}
            <div
              className="flex-[3] flex items-center justify-center overflow-auto p-4 md:p-8"
              style={{ background: "var(--background)" }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain rounded-lg"
                style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.12)" }}
              />
            </div>

            {/* Right: Settings sidebar */}
            <aside
              className="flex-[2] max-w-sm shrink-0 border-l overflow-y-auto flex flex-col"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
              }}
            >
              {/* Upload new button */}
              <div className="px-4 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Upload size={15} />
                  Upload new image
                </button>
              </div>

              {/* 1. Background */}
              <Section title="Background">
                <SegmentedControl
                  options={[
                    { label: "Solid", value: "solid" as BgType },
                    { label: "Gradient", value: "gradient" as BgType },
                    { label: "Preset", value: "preset" as BgType },
                  ]}
                  value={settings.bgType}
                  onChange={(v) => set("bgType", v)}
                />

                {settings.bgType === "solid" && (
                  <ColorRow
                    label="Color"
                    value={settings.bgSolid}
                    onChange={(v) => set("bgSolid", v)}
                  />
                )}

                {settings.bgType === "gradient" && (
                  <>
                    <ColorRow
                      label="Color A"
                      value={settings.bgGradientA}
                      onChange={(v) => set("bgGradientA", v)}
                    />
                    <ColorRow
                      label="Color B"
                      value={settings.bgGradientB}
                      onChange={(v) => set("bgGradientB", v)}
                    />
                    <SliderRow
                      label="Angle"
                      value={settings.bgGradientAngle}
                      min={0}
                      max={360}
                      onChange={(v) => set("bgGradientAngle", v)}
                    />
                  </>
                )}

                {settings.bgType === "preset" && (
                  <div className="grid grid-cols-4 gap-2">
                    {GRADIENT_PRESETS.map((preset, i) => (
                      <button
                        key={preset.name}
                        type="button"
                        title={preset.name}
                        onClick={() => set("bgPresetIndex", i)}
                        className="aspect-square rounded-lg transition-all"
                        style={{
                          background: `linear-gradient(${preset.angle}deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                          outline:
                            settings.bgPresetIndex === i
                              ? "2px solid var(--accent)"
                              : "2px solid transparent",
                          outlineOffset: "1px",
                        }}
                      />
                    ))}
                  </div>
                )}

                <SliderRow
                  label="Padding"
                  value={settings.padding}
                  min={20}
                  max={200}
                  onChange={(v) => set("padding", v)}
                />
              </Section>

              {/* 2. Shadow */}
              <Section title="Shadow">
                <ToggleRow
                  label="Enabled"
                  value={settings.shadowEnabled}
                  onChange={(v) => set("shadowEnabled", v)}
                />
                {settings.shadowEnabled && (
                  <>
                    <ColorRow
                      label="Color"
                      value={settings.shadowColor}
                      onChange={(v) => set("shadowColor", v)}
                    />
                    <SliderRow
                      label="Blur"
                      value={settings.shadowBlur}
                      min={0}
                      max={100}
                      onChange={(v) => set("shadowBlur", v)}
                    />
                    <SliderRow
                      label="Offset X"
                      value={settings.shadowOffsetX}
                      min={-50}
                      max={50}
                      onChange={(v) => set("shadowOffsetX", v)}
                    />
                    <SliderRow
                      label="Offset Y"
                      value={settings.shadowOffsetY}
                      min={-50}
                      max={50}
                      onChange={(v) => set("shadowOffsetY", v)}
                    />
                  </>
                )}
              </Section>

              {/* 3. Border & Corners */}
              <Section title="Border & Corners">
                <SliderRow
                  label="Corner radius"
                  value={settings.cornerRadius}
                  min={0}
                  max={40}
                  onChange={(v) => set("cornerRadius", v)}
                />
                <ToggleRow
                  label="Border"
                  value={settings.borderEnabled}
                  onChange={(v) => set("borderEnabled", v)}
                />
                {settings.borderEnabled && (
                  <>
                    <ColorRow
                      label="Border color"
                      value={settings.borderColor}
                      onChange={(v) => set("borderColor", v)}
                    />
                    <SliderRow
                      label="Border width"
                      value={settings.borderWidth}
                      min={1}
                      max={5}
                      onChange={(v) => set("borderWidth", v)}
                    />
                  </>
                )}
              </Section>

              {/* 4. Frame */}
              <Section title="Frame" defaultOpen={false}>
                <SegmentedControl
                  options={[
                    { label: "None", value: "none" as FrameType },
                    { label: "Browser", value: "browser" as FrameType },
                    { label: "Window", value: "window" as FrameType },
                    { label: "Phone", value: "phone" as FrameType },
                  ]}
                  value={settings.frameType}
                  onChange={(v) => set("frameType", v)}
                />
                {settings.frameType !== "none" && (
                  <SegmentedControl
                    options={[
                      { label: "Light", value: "light" as FrameTheme },
                      { label: "Dark", value: "dark" as FrameTheme },
                    ]}
                    value={settings.frameTheme}
                    onChange={(v) => set("frameTheme", v)}
                  />
                )}
              </Section>

              {/* 5. Canvas Size */}
              <Section title="Canvas Size" defaultOpen={false}>
                <SliderRow
                  label="Width"
                  value={settings.canvasWidth}
                  min={800}
                  max={2400}
                  step={50}
                  onChange={(v) => set("canvasWidth", v)}
                />
                <div>
                  <span className="text-xs text-[var(--muted)] mb-1.5 block">
                    Aspect ratio
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { label: "Auto", value: "auto" },
                        { label: "16:9", value: "16:9" },
                        { label: "4:3", value: "4:3" },
                        { label: "1:1", value: "1:1" },
                        { label: "Twitter", value: "twitter" },
                        { label: "Instagram", value: "instagram" },
                      ] as { label: string; value: AspectPreset }[]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("aspectPreset", opt.value)}
                        className="text-[11px] font-medium py-1.5 rounded-md border transition-colors"
                        style={{
                          borderColor:
                            settings.aspectPreset === opt.value
                              ? "var(--accent)"
                              : "var(--border)",
                          background:
                            settings.aspectPreset === opt.value
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            settings.aspectPreset === opt.value
                              ? "#fff"
                              : "var(--foreground)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* 6. Watermark */}
              <Section title="Watermark" defaultOpen={false}>
                <div>
                  <span className="text-xs text-[var(--muted)] mb-1 block">
                    Text
                  </span>
                  <input
                    type="text"
                    value={settings.watermarkText}
                    onChange={(e) => set("watermarkText", e.target.value)}
                    placeholder="e.g. @yourhandle"
                    className="w-full px-3 py-1.5 rounded-lg border text-sm bg-[var(--background)]"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] mb-1.5 block">
                    Position
                  </span>
                  <SegmentedControl
                    options={[
                      {
                        label: "Left",
                        value: "bottom-left" as WatermarkPosition,
                      },
                      {
                        label: "Center",
                        value: "bottom-center" as WatermarkPosition,
                      },
                      {
                        label: "Right",
                        value: "bottom-right" as WatermarkPosition,
                      },
                    ]}
                    value={settings.watermarkPosition}
                    onChange={(v) => set("watermarkPosition", v)}
                  />
                </div>
                <SliderRow
                  label="Font size"
                  value={settings.watermarkFontSize}
                  min={10}
                  max={36}
                  onChange={(v) => set("watermarkFontSize", v)}
                />
                <SliderRow
                  label="Opacity"
                  value={settings.watermarkOpacity}
                  min={10}
                  max={100}
                  onChange={(v) => set("watermarkOpacity", v)}
                />
              </Section>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

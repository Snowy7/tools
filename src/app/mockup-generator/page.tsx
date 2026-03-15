"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Monitor,
  Download,
  Copy,
  Check,
  Upload,
  Smartphone,
  Tablet,
  Laptop,
  Globe,
  Square,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type DeviceType =
  | "iphone"
  | "android"
  | "ipad"
  | "macbook"
  | "browser"
  | "monitor"
  | "floating";

type ScreenFit = "cover" | "contain" | "stretch";
type BgType = "solid" | "gradient" | "transparent";

interface DeviceColor {
  label: string;
  value: string;
  body: string;
  bezel?: string;
}

interface DeviceDef {
  id: DeviceType;
  label: string;
  icon: typeof Smartphone;
  colors: DeviceColor[];
  aspectRatio: number; // width/height of the device body
}

interface GradientPreset {
  label: string;
  from: string;
  to: string;
  angle: number;
}

interface CanvasPreset {
  label: string;
  width: number;
  height: number;
}

// ── Device definitions ───────────────────────────────────────────────────────

const DEVICES: DeviceDef[] = [
  {
    id: "iphone",
    label: "iPhone",
    icon: Smartphone,
    aspectRatio: 0.49,
    colors: [
      { label: "Space Black", value: "black", body: "#1a1a1a" },
      { label: "Silver", value: "silver", body: "#e5e5e5" },
      { label: "Gold", value: "gold", body: "#f5e6d0" },
    ],
  },
  {
    id: "android",
    label: "Android",
    icon: Smartphone,
    aspectRatio: 0.47,
    colors: [
      { label: "Black", value: "black", body: "#1a1a1a" },
      { label: "White", value: "white", body: "#f0f0f0" },
    ],
  },
  {
    id: "ipad",
    label: "iPad",
    icon: Tablet,
    aspectRatio: 0.75,
    colors: [
      { label: "Space Gray", value: "gray", body: "#2d2d2d" },
      { label: "Silver", value: "silver", body: "#e5e5e5" },
    ],
  },
  {
    id: "macbook",
    label: "MacBook",
    icon: Laptop,
    aspectRatio: 1.6,
    colors: [
      { label: "Space Gray", value: "gray", body: "#2d2d2d" },
      { label: "Silver", value: "silver", body: "#e0e0e0" },
    ],
  },
  {
    id: "browser",
    label: "Browser",
    icon: Globe,
    aspectRatio: 1.6,
    colors: [
      { label: "Light", value: "light", body: "#ffffff", bezel: "#f0f0f0" },
      { label: "Dark", value: "dark", body: "#1e1e1e", bezel: "#2a2a2a" },
    ],
  },
  {
    id: "monitor",
    label: "Monitor",
    icon: Monitor,
    aspectRatio: 1.78,
    colors: [
      { label: "Black", value: "black", body: "#1a1a1a" },
      { label: "Silver", value: "silver", body: "#d4d4d4" },
    ],
  },
  {
    id: "floating",
    label: "Floating",
    icon: Square,
    aspectRatio: 1.6,
    colors: [
      { label: "Default", value: "default", body: "transparent" },
    ],
  },
];

const GRADIENT_PRESETS: GradientPreset[] = [
  { label: "Sunset", from: "#f97316", to: "#ec4899", angle: 135 },
  { label: "Ocean", from: "#06b6d4", to: "#3b82f6", angle: 135 },
  { label: "Forest", from: "#22c55e", to: "#14b8a6", angle: 135 },
  { label: "Lavender", from: "#a78bfa", to: "#ec4899", angle: 135 },
  { label: "Midnight", from: "#1e1b4b", to: "#312e81", angle: 135 },
  { label: "Peach", from: "#fbbf24", to: "#f97316", angle: 135 },
  { label: "Sky", from: "#7dd3fc", to: "#2563eb", angle: 180 },
  { label: "Slate", from: "#475569", to: "#1e293b", angle: 135 },
];

const CANVAS_PRESETS: CanvasPreset[] = [
  { label: "Auto", width: 0, height: 0 },
  { label: "1920x1080", width: 1920, height: 1080 },
  { label: "1200x630", width: 1200, height: 630 },
  { label: "1080x1080", width: 1080, height: 1080 },
];

// ── Slider Component ─────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
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
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
          {label}
        </span>
        <span
          className="text-xs tabular-nums cursor-pointer select-none"
          style={{ color: "var(--muted)" }}
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
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
          style={{ background: "var(--accent)", width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
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

// ── Collapsible Section ──────────────────────────────────────────────────────

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
        style={{ maxHeight: open ? "2000px" : "0px", opacity: open ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Device Drawing Functions ─────────────────────────────────────────────────

function drawIPhone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  colorDef: DeviceColor,
  fit: ScreenFit
) {
  const radius = w * 0.12;
  const bezel = w * 0.04;
  const topBezel = bezel * 2.5;
  const bottomBezel = bezel * 1.5;
  const screenX = x + bezel;
  const screenY = y + topBezel;
  const screenW = w - bezel * 2;
  const screenH = h - topBezel - bottomBezel;

  // Body
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Side buttons (left: mute + volume, right: power)
  ctx.fillStyle = colorDef.body === "#1a1a1a" ? "#111111" : "#c4c4c4";
  // Mute toggle
  ctx.fillRect(x - 2, y + h * 0.12, 2, h * 0.035);
  // Volume up
  ctx.fillRect(x - 2, y + h * 0.19, 2, h * 0.06);
  // Volume down
  ctx.fillRect(x - 2, y + h * 0.27, 2, h * 0.06);
  // Power
  ctx.fillRect(x + w, y + h * 0.2, 2, h * 0.08);

  // Screen area
  const screenRadius = w * 0.08;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
  ctx.clip();

  // Screen background
  ctx.fillStyle = "#000000";
  ctx.fillRect(screenX, screenY, screenW, screenH);

  // Draw image
  drawImageFitted(ctx, screenImg, screenX, screenY, screenW, screenH, fit);
  ctx.restore();

  // Notch
  const notchW = w * 0.35;
  const notchH = h * 0.027;
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.roundRect(x + (w - notchW) / 2, screenY - 1, notchW, notchH, notchH / 2);
  ctx.fill();

  // Camera dot in notch
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(x + w * 0.56, screenY + notchH * 0.3, w * 0.018, 0, Math.PI * 2);
  ctx.fill();

  // Home indicator
  ctx.fillStyle =
    colorDef.value === "black" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.3, y + h - bottomBezel * 0.7, w * 0.4, 4, 2);
  ctx.fill();
}

function drawAndroid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  colorDef: DeviceColor,
  fit: ScreenFit
) {
  const radius = w * 0.1;
  const bezel = w * 0.025;
  const topBezel = bezel * 2;
  const bottomBezel = bezel * 1.2;
  const screenX = x + bezel;
  const screenY = y + topBezel;
  const screenW = w - bezel * 2;
  const screenH = h - topBezel - bottomBezel;

  // Body
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Power + volume buttons
  ctx.fillStyle = colorDef.body === "#1a1a1a" ? "#111111" : "#c4c4c4";
  ctx.fillRect(x + w, y + h * 0.22, 2, h * 0.07);
  ctx.fillRect(x + w, y + h * 0.32, 2, h * 0.1);

  // Screen
  const screenRadius = w * 0.06;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
  ctx.clip();
  ctx.fillStyle = "#000000";
  ctx.fillRect(screenX, screenY, screenW, screenH);
  drawImageFitted(ctx, screenImg, screenX, screenY, screenW, screenH, fit);
  ctx.restore();

  // Camera hole punch
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(x + w * 0.5, screenY + w * 0.04, w * 0.015, 0, Math.PI * 2);
  ctx.fill();
}

function drawIPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  colorDef: DeviceColor,
  fit: ScreenFit
) {
  const radius = w * 0.04;
  const bezel = w * 0.03;
  const topBezel = bezel * 1.5;
  const bottomBezel = bezel * 1.5;
  const screenX = x + bezel;
  const screenY = y + topBezel;
  const screenW = w - bezel * 2;
  const screenH = h - topBezel - bottomBezel;

  // Body
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Screen
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, 4);
  ctx.clip();
  ctx.fillStyle = "#000000";
  ctx.fillRect(screenX, screenY, screenW, screenH);
  drawImageFitted(ctx, screenImg, screenX, screenY, screenW, screenH, fit);
  ctx.restore();

  // Front camera
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + topBezel * 0.5, w * 0.008, 0, Math.PI * 2);
  ctx.fill();
}

function drawMacBook(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  colorDef: DeviceColor,
  fit: ScreenFit
) {
  // The screen portion takes about 72% of height, base takes the rest
  const screenPartH = h * 0.72;
  const baseH = h * 0.28;
  const screenBezel = w * 0.03;
  const topBezel = screenPartH * 0.04;
  const bottomBezel = screenPartH * 0.08;

  // Screen lid
  const lidRadius = w * 0.02;
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, screenPartH, lidRadius);
  ctx.fill();

  // Inner screen
  const innerX = x + screenBezel;
  const innerY = y + topBezel;
  const innerW = w - screenBezel * 2;
  const innerH = screenPartH - topBezel - bottomBezel;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(innerX, innerY, innerW, innerH, 4);
  ctx.clip();
  ctx.fillStyle = "#000000";
  ctx.fillRect(innerX, innerY, innerW, innerH);
  drawImageFitted(ctx, screenImg, innerX, innerY, innerW, innerH, fit);
  ctx.restore();

  // Camera dot
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + topBezel * 0.5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Logo area (bottom bezel of screen)
  ctx.fillStyle = colorDef.body === "#2d2d2d" ? "#3a3a3a" : "#ccc";
  ctx.beginPath();
  ctx.arc(
    x + w * 0.5,
    y + screenPartH - bottomBezel * 0.5,
    w * 0.015,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Base / keyboard area
  const baseY = y + screenPartH;
  const baseInset = w * 0.02;

  // Hinge line
  ctx.fillStyle = colorDef.body === "#2d2d2d" ? "#222" : "#bbb";
  ctx.fillRect(x + baseInset, baseY, w - baseInset * 2, 2);

  // Keyboard base (trapezoid-ish with rounded bottom)
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.moveTo(x + baseInset, baseY + 2);
  ctx.lineTo(x + w - baseInset, baseY + 2);
  ctx.lineTo(x + w - baseInset * 0.5, baseY + baseH);
  ctx.quadraticCurveTo(x + w * 0.5, baseY + baseH + 4, x + baseInset * 0.5, baseY + baseH);
  ctx.closePath();
  ctx.fill();

  // Trackpad
  const tpW = w * 0.35;
  const tpH = baseH * 0.5;
  const tpX = x + (w - tpW) / 2;
  const tpY = baseY + baseH * 0.28;
  ctx.strokeStyle = colorDef.body === "#2d2d2d" ? "#444" : "#c0c0c0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tpX, tpY, tpW, tpH, 4);
  ctx.stroke();

  // Keyboard grid (decorative)
  const kbX = x + w * 0.08;
  const kbY = baseY + 8;
  const kbW = w * 0.84;
  const kbH = baseH * 0.2;
  ctx.fillStyle = colorDef.body === "#2d2d2d" ? "#222" : "#d5d5d5";
  const keyRows = 3;
  const keyCols = 12;
  const keyGap = 2;
  const keyW = (kbW - keyGap * (keyCols - 1)) / keyCols;
  const keyH = (kbH - keyGap * (keyRows - 1)) / keyRows;
  for (let r = 0; r < keyRows; r++) {
    for (let c = 0; c < keyCols; c++) {
      ctx.beginPath();
      ctx.roundRect(
        kbX + c * (keyW + keyGap),
        kbY + r * (keyH + keyGap),
        keyW,
        keyH,
        1.5
      );
      ctx.fill();
    }
  }
}

function drawBrowser(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  colorDef: DeviceColor,
  fit: ScreenFit
) {
  const titleBarH = Math.max(36, h * 0.05);
  const radius = 10;
  const isDark = colorDef.value === "dark";

  // Window body
  ctx.fillStyle = isDark ? "#1e1e1e" : "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Window border
  ctx.strokeStyle = isDark ? "#333" : "#d4d4d4";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();

  // Title bar
  ctx.fillStyle = isDark ? "#2a2a2a" : "#f0f0f0";
  ctx.beginPath();
  ctx.roundRect(x, y, w, titleBarH, [radius, radius, 0, 0]);
  ctx.fill();

  // Title bar bottom border
  ctx.strokeStyle = isDark ? "#333" : "#d4d4d4";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + titleBarH);
  ctx.lineTo(x + w, y + titleBarH);
  ctx.stroke();

  // Traffic lights
  const dotY = y + titleBarH / 2;
  const dotStartX = x + 16;
  const dotR = 6;
  const colors = ["#ff5f57", "#febc2e", "#28c840"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(dotStartX + i * 20, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // URL bar
  const urlBarX = x + 80;
  const urlBarW = w - 160;
  const urlBarH = titleBarH * 0.55;
  const urlBarY = y + (titleBarH - urlBarH) / 2;
  ctx.fillStyle = isDark ? "#1a1a1a" : "#e5e5e5";
  ctx.beginPath();
  ctx.roundRect(urlBarX, urlBarY, urlBarW, urlBarH, urlBarH / 2);
  ctx.fill();

  // URL text
  ctx.fillStyle = isDark ? "#888" : "#737373";
  ctx.font = `${Math.max(10, titleBarH * 0.3)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("example.com", x + w / 2, y + titleBarH / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Content area
  const contentY = y + titleBarH;
  const contentH = h - titleBarH;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, contentY, w, contentH, [0, 0, radius, radius]);
  ctx.clip();
  ctx.fillStyle = isDark ? "#1e1e1e" : "#ffffff";
  ctx.fillRect(x, contentY, w, contentH);
  drawImageFitted(ctx, screenImg, x, contentY, w, contentH, fit);
  ctx.restore();
}

function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  colorDef: DeviceColor,
  fit: ScreenFit
) {
  // Screen takes about 78% of height; rest is chin + stand
  const screenH = h * 0.75;
  const chinH = h * 0.03;
  const standNeckH = h * 0.12;
  const standBaseH = h * 0.1;
  const bezel = w * 0.015;
  const radius = w * 0.015;
  const isDark = colorDef.value === "black";

  // Monitor body
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, screenH + chinH, radius);
  ctx.fill();

  // Screen
  const screenX = x + bezel;
  const screenY = y + bezel;
  const innerW = w - bezel * 2;
  const innerH = screenH - bezel;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, innerW, innerH, 2);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(screenX, screenY, innerW, innerH);
  drawImageFitted(ctx, screenImg, screenX, screenY, innerW, innerH, fit);
  ctx.restore();

  // Chin logo
  ctx.fillStyle = isDark ? "#333" : "#bbb";
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + screenH + chinH * 0.5, chinH * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Stand neck
  const neckW = w * 0.08;
  const neckX = x + (w - neckW) / 2;
  const neckY = y + screenH + chinH;
  ctx.fillStyle = colorDef.body;
  ctx.fillRect(neckX, neckY, neckW, standNeckH);

  // Stand base
  const baseW = w * 0.3;
  const baseX = x + (w - baseW) / 2;
  const baseY = neckY + standNeckH;
  ctx.fillStyle = colorDef.body;
  ctx.beginPath();
  ctx.ellipse(
    baseX + baseW / 2,
    baseY + standBaseH * 0.4,
    baseW / 2,
    standBaseH * 0.4,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawFloating(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screenImg: HTMLImageElement,
  _colorDef: DeviceColor,
  fit: ScreenFit,
  shadowEnabled: boolean,
  shadowBlur: number,
  shadowOpacity: number
) {
  const radius = 12;

  if (shadowEnabled) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${shadowOpacity / 100})`;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadowBlur * 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);
  drawImageFitted(ctx, screenImg, x, y, w, h, fit);
  ctx.restore();
}

// ── Image fitting ────────────────────────────────────────────────────────────

function drawImageFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  fit: ScreenFit
) {
  if (fit === "stretch") {
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const areaRatio = dw / dh;
  let sw: number, sh: number, sx: number, sy: number;

  if (fit === "cover") {
    if (imgRatio > areaRatio) {
      sh = img.naturalHeight;
      sw = sh * areaRatio;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = img.naturalWidth;
      sh = sw / areaRatio;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    // contain
    let renderW: number, renderH: number;
    if (imgRatio > areaRatio) {
      renderW = dw;
      renderH = dw / imgRatio;
    } else {
      renderH = dh;
      renderW = dh * imgRatio;
    }
    const offsetX = dx + (dw - renderW) / 2;
    const offsetY = dy + (dh - renderH) / 2;
    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  }
}

// ── Compute device dimensions for canvas ─────────────────────────────────────

function getDeviceDimensions(
  device: DeviceDef,
  img: HTMLImageElement,
  scale: number,
  canvasW: number,
  canvasH: number
): { devW: number; devH: number } {
  // Calculate device size based on image size and device aspect ratio
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  let devW: number;
  let devH: number;

  if (device.id === "floating") {
    devW = imgW;
    devH = imgH;
  } else if (device.id === "macbook") {
    // Screen area is roughly 94% width and 65% of total height
    devW = imgW / 0.94;
    devH = devW / device.aspectRatio;
  } else if (device.id === "browser") {
    devW = imgW;
    devH = imgH + Math.max(36, imgH * 0.05);
  } else if (device.id === "monitor") {
    const bezel = imgW * 0.015 / (1 - 0.03);
    devW = imgW + bezel * 2;
    devH = devW / device.aspectRatio;
  } else {
    // Phone / tablet: image fills screen area (inset by bezel)
    const bezelFactor = device.id === "android" ? 0.05 : 0.08;
    devW = imgW / (1 - bezelFactor);
    devH = devW / device.aspectRatio;
  }

  // Scale
  devW *= scale / 100;
  devH *= scale / 100;

  // Fit within canvas if canvas is fixed
  if (canvasW > 0 && canvasH > 0) {
    const maxW = canvasW * 0.85;
    const maxH = canvasH * 0.85;
    const fitScale = Math.min(maxW / devW, maxH / devH, 1);
    devW *= fitScale;
    devH *= fitScale;
  }

  return { devW: Math.round(devW), devH: Math.round(devH) };
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MockupGeneratorPage() {
  // State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [device, setDevice] = useState<DeviceType>("iphone");
  const [deviceColorIdx, setDeviceColorIdx] = useState(0);
  const [fit, setFit] = useState<ScreenFit>("cover");
  const [bgType, setBgType] = useState<BgType>("solid");
  const [bgColor, setBgColor] = useState("#f5f5f5");
  const [gradFrom, setGradFrom] = useState("#f97316");
  const [gradTo, setGradTo] = useState("#ec4899");
  const [gradAngle, setGradAngle] = useState(135);
  const [shadowEnabled, setShadowEnabled] = useState(true);
  const [shadowBlur, setShadowBlur] = useState(30);
  const [shadowOpacity, setShadowOpacity] = useState(40);
  const [scale, setScale] = useState(100);
  const [canvasPresetIdx, setCanvasPresetIdx] = useState(0);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  const currentDevice = DEVICES.find((d) => d.id === device)!;
  const currentColor = currentDevice.colors[deviceColorIdx] ?? currentDevice.colors[0];
  const currentCanvasPreset = CANVAS_PRESETS[canvasPresetIdx];

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = url;

    const img = new Image();
    img.onload = () => {
      sourceImageRef.current = img;
      setImageFile(file);
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // ── Canvas rendering ───────────────────────────────────────────────────────

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = sourceImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d")!;

    // Determine canvas size
    let cw: number;
    let ch: number;
    if (canvasPresetIdx === 0) {
      // Auto: base on device size + padding
      const { devW, devH } = getDeviceDimensions(currentDevice, img, scale, 0, 0);
      const padding = Math.max(devW, devH) * 0.15;
      cw = Math.round(devW + padding * 2);
      ch = Math.round(devH + padding * 2);
    } else if (canvasPresetIdx > CANVAS_PRESETS.length - 1) {
      cw = customW;
      ch = customH;
    } else {
      cw = currentCanvasPreset.width;
      ch = currentCanvasPreset.height;
    }

    // Limit to reasonable size
    const maxDim = 4096;
    if (cw > maxDim || ch > maxDim) {
      const s = maxDim / Math.max(cw, ch);
      cw = Math.round(cw * s);
      ch = Math.round(ch * s);
    }

    canvas.width = cw;
    canvas.height = ch;

    // Background
    if (bgType === "transparent") {
      ctx.clearRect(0, 0, cw, ch);
      // Draw checkerboard for preview
      const tileSize = 16;
      for (let ry = 0; ry < ch; ry += tileSize) {
        for (let rx = 0; rx < cw; rx += tileSize) {
          const isLight = ((rx / tileSize) + (ry / tileSize)) % 2 === 0;
          ctx.fillStyle = isLight ? "#e0e0e0" : "#c0c0c0";
          ctx.fillRect(rx, ry, tileSize, tileSize);
        }
      }
    } else if (bgType === "gradient") {
      const angle = (gradAngle * Math.PI) / 180;
      const cx = cw / 2;
      const cy = ch / 2;
      const len = Math.sqrt(cw * cw + ch * ch) / 2;
      const grad = ctx.createLinearGradient(
        cx - Math.cos(angle) * len,
        cy - Math.sin(angle) * len,
        cx + Math.cos(angle) * len,
        cy + Math.sin(angle) * len
      );
      grad.addColorStop(0, gradFrom);
      grad.addColorStop(1, gradTo);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cw, ch);
    }

    // Device
    const { devW, devH } = getDeviceDimensions(currentDevice, img, scale, cw, ch);
    const devX = Math.round((cw - devW) / 2);
    const devY = Math.round((ch - devH) / 2);

    // Shadow (for non-floating devices)
    if (shadowEnabled && device !== "floating") {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${shadowOpacity / 100})`;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowBlur * 0.25;
      // Draw a filled shape for the shadow to attach to
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.beginPath();
      ctx.roundRect(devX, devY, devW, devH, 10);
      ctx.fill();
      ctx.restore();
    }

    // Draw device
    switch (device) {
      case "iphone":
        drawIPhone(ctx, devX, devY, devW, devH, img, currentColor, fit);
        break;
      case "android":
        drawAndroid(ctx, devX, devY, devW, devH, img, currentColor, fit);
        break;
      case "ipad":
        drawIPad(ctx, devX, devY, devW, devH, img, currentColor, fit);
        break;
      case "macbook":
        drawMacBook(ctx, devX, devY, devW, devH, img, currentColor, fit);
        break;
      case "browser":
        drawBrowser(ctx, devX, devY, devW, devH, img, currentColor, fit);
        break;
      case "monitor":
        drawMonitor(ctx, devX, devY, devW, devH, img, currentColor, fit);
        break;
      case "floating":
        drawFloating(
          ctx,
          devX,
          devY,
          devW,
          devH,
          img,
          currentColor,
          fit,
          shadowEnabled,
          shadowBlur,
          shadowOpacity
        );
        break;
    }
  }, [
    device,
    deviceColorIdx,
    currentDevice,
    currentColor,
    fit,
    bgType,
    bgColor,
    gradFrom,
    gradTo,
    gradAngle,
    shadowEnabled,
    shadowBlur,
    shadowOpacity,
    scale,
    canvasPresetIdx,
    customW,
    customH,
    currentCanvasPreset,
  ]);

  useEffect(() => {
    if (!sourceImageRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderCanvas);
  }, [renderCanvas, imageFile]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // If transparent background, re-render without checkerboard
    if (bgType === "transparent") {
      const offscreen = document.createElement("canvas");
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const ctx = offscreen.getContext("2d")!;
      ctx.clearRect(0, 0, offscreen.width, offscreen.height);

      // Redraw device only (copy the logic but skip checkerboard)
      const img = sourceImageRef.current!;
      const { devW, devH } = getDeviceDimensions(
        currentDevice,
        img,
        scale,
        offscreen.width,
        offscreen.height
      );
      const devX = Math.round((offscreen.width - devW) / 2);
      const devY = Math.round((offscreen.height - devH) / 2);

      if (shadowEnabled && device !== "floating") {
        ctx.save();
        ctx.shadowColor = `rgba(0,0,0,${shadowOpacity / 100})`;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = shadowBlur * 0.25;
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.beginPath();
        ctx.roundRect(devX, devY, devW, devH, 10);
        ctx.fill();
        ctx.restore();
      }

      switch (device) {
        case "iphone":
          drawIPhone(ctx, devX, devY, devW, devH, img, currentColor, fit);
          break;
        case "android":
          drawAndroid(ctx, devX, devY, devW, devH, img, currentColor, fit);
          break;
        case "ipad":
          drawIPad(ctx, devX, devY, devW, devH, img, currentColor, fit);
          break;
        case "macbook":
          drawMacBook(ctx, devX, devY, devW, devH, img, currentColor, fit);
          break;
        case "browser":
          drawBrowser(ctx, devX, devY, devW, devH, img, currentColor, fit);
          break;
        case "monitor":
          drawMonitor(ctx, devX, devY, devW, devH, img, currentColor, fit);
          break;
        case "floating":
          drawFloating(ctx, devX, devY, devW, devH, img, currentColor, fit, shadowEnabled, shadowBlur, shadowOpacity);
          break;
      }

      offscreen.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mockup.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } else {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mockup.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
  }, [bgType, device, currentDevice, currentColor, fit, scale, shadowEnabled, shadowBlur, shadowOpacity]);

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, []);

  // ── Device selector thumbnail ──────────────────────────────────────────────

  function DeviceThumb({ dev }: { dev: DeviceDef }) {
    const Icon = dev.icon;
    const isActive = device === dev.id;
    return (
      <button
        className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors cursor-pointer"
        style={{
          background: isActive ? "var(--accent)" : "var(--surface-hover)",
          color: isActive ? "white" : "var(--foreground)",
        }}
        onClick={() => {
          setDevice(dev.id);
          setDeviceColorIdx(0);
        }}
      >
        <Icon size={20} />
        <span className="text-[10px] font-medium leading-tight">{dev.label}</span>
      </button>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasImage = !!imageFile;

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
        <Monitor size={18} style={{ color: "var(--accent)" }} />
        <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Mockup Generator
        </h1>

        <div className="flex-1" />

        {/* Copy */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--foreground)",
            background: "var(--surface-hover)",
            opacity: hasImage ? 1 : 0.4,
          }}
          onClick={copyToClipboard}
          disabled={!hasImage}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>

        {/* Download */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "white",
            background: "var(--accent)",
            opacity: hasImage ? 1 : 0.4,
          }}
          onClick={exportPNG}
          disabled={!hasImage}
        >
          <Download size={14} />
          Download
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Preview */}
        <div
          className="flex-[3] flex items-center justify-center overflow-auto relative"
          style={{ background: "var(--background)" }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {!hasImage ? (
            <div
              className="flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed transition-colors cursor-pointer"
              style={{
                borderColor: isDragging ? "var(--accent)" : "var(--border)",
                background: isDragging ? "var(--surface-hover)" : "transparent",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload
                size={40}
                style={{ color: "var(--muted)" }}
              />
              <div className="text-center">
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "var(--foreground)" }}
                >
                  Drop a screenshot here
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  or click to upload — paste from clipboard also works
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{ objectFit: "contain" }}
              />
            </div>
          )}

          {/* Drag overlay */}
          {isDragging && hasImage && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: "rgba(0,0,0,0.5)" }}
            >
              <div
                className="px-6 py-3 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                Drop to replace image
              </div>
            </div>
          )}
        </div>

        {/* Settings Sidebar */}
        <div
          className="flex-[2] max-w-xs border-l overflow-y-auto p-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Upload button */}
          <button
            className="flex items-center justify-center gap-2 w-full py-2 mb-4 rounded-md text-xs font-medium transition-colors cursor-pointer"
            style={{
              color: "var(--foreground)",
              background: "var(--surface-hover)",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={14} />
            {hasImage ? "Replace Image" : "Upload Image"}
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

          {/* Device */}
          <CollapsibleSection title="Device">
            <div className="grid grid-cols-3 gap-1.5">
              {DEVICES.map((d) => (
                <DeviceThumb key={d.id} dev={d} />
              ))}
            </div>
          </CollapsibleSection>

          {/* Device Color */}
          {currentDevice.colors.length > 1 && (
            <CollapsibleSection title="Device Color">
              <div className="flex gap-1.5 flex-wrap">
                {currentDevice.colors.map((c, i) => (
                  <button
                    key={c.value}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      background:
                        deviceColorIdx === i
                          ? "var(--accent)"
                          : "var(--surface-hover)",
                      color:
                        deviceColorIdx === i ? "white" : "var(--foreground)",
                    }}
                    onClick={() => setDeviceColorIdx(i)}
                  >
                    <span
                      className="w-3 h-3 rounded-full border"
                      style={{
                        background: c.body,
                        borderColor: "var(--border)",
                      }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Screen Fit */}
          <CollapsibleSection title="Screen Fit">
            <div className="flex gap-1.5">
              {(["cover", "contain", "stretch"] as ScreenFit[]).map((f) => (
                <button
                  key={f}
                  className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer capitalize"
                  style={{
                    background:
                      fit === f ? "var(--accent)" : "var(--surface-hover)",
                    color: fit === f ? "white" : "var(--foreground)",
                  }}
                  onClick={() => setFit(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* Background */}
          <CollapsibleSection title="Background">
            <div className="flex gap-1.5 mb-3">
              {(["solid", "gradient", "transparent"] as BgType[]).map((t) => (
                <button
                  key={t}
                  className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer capitalize"
                  style={{
                    background:
                      bgType === t ? "var(--accent)" : "var(--surface-hover)",
                    color: bgType === t ? "white" : "var(--foreground)",
                  }}
                  onClick={() => setBgType(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {bgType === "solid" && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 px-2 py-1 rounded-md text-xs font-mono border"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            )}

            {bgType === "gradient" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gradFrom}
                    onChange={(e) => setGradFrom(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <input
                    type="color"
                    value={gradTo}
                    onChange={(e) => setGradTo(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    From / To
                  </span>
                </div>
                <Slider
                  label="Angle"
                  value={gradAngle}
                  min={0}
                  max={360}
                  defaultValue={135}
                  onChange={setGradAngle}
                  suffix="deg"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {GRADIENT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      className="h-7 rounded-md cursor-pointer border transition-transform hover:scale-105"
                      style={{
                        background: `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})`,
                        borderColor: "var(--border)",
                      }}
                      title={p.label}
                      onClick={() => {
                        setGradFrom(p.from);
                        setGradTo(p.to);
                        setGradAngle(p.angle);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Shadow */}
          <CollapsibleSection title="Shadow">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shadowEnabled}
                onChange={(e) => setShadowEnabled(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Enable shadow
              </span>
            </label>
            {shadowEnabled && (
              <>
                <Slider
                  label="Blur"
                  value={shadowBlur}
                  min={0}
                  max={60}
                  defaultValue={30}
                  onChange={setShadowBlur}
                  suffix="px"
                />
                <Slider
                  label="Opacity"
                  value={shadowOpacity}
                  min={0}
                  max={100}
                  defaultValue={40}
                  onChange={setShadowOpacity}
                  suffix="%"
                />
              </>
            )}
          </CollapsibleSection>

          {/* Scale */}
          <CollapsibleSection title="Scale">
            <Slider
              label="Device Scale"
              value={scale}
              min={50}
              max={150}
              defaultValue={100}
              onChange={setScale}
              suffix="%"
            />
          </CollapsibleSection>

          {/* Canvas Size */}
          <CollapsibleSection title="Canvas Size">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CANVAS_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    background:
                      canvasPresetIdx === i
                        ? "var(--accent)"
                        : "var(--surface-hover)",
                    color:
                      canvasPresetIdx === i ? "white" : "var(--foreground)",
                  }}
                  onClick={() => setCanvasPresetIdx(i)}
                >
                  {p.label}
                </button>
              ))}
              <button
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background:
                    canvasPresetIdx === CANVAS_PRESETS.length
                      ? "var(--accent)"
                      : "var(--surface-hover)",
                  color:
                    canvasPresetIdx === CANVAS_PRESETS.length
                      ? "white"
                      : "var(--foreground)",
                }}
                onClick={() => setCanvasPresetIdx(CANVAS_PRESETS.length)}
              >
                Custom
              </button>
            </div>
            {canvasPresetIdx === CANVAS_PRESETS.length && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-md text-xs font-mono border"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  min={100}
                  max={4096}
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  x
                </span>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-md text-xs font-mono border"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  min={100}
                  max={4096}
                />
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Layers,
  Download,
  Copy,
  Check,
  Shuffle,
  ChevronDown,
  Image,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TextureType =
  | "perlin"
  | "grain"
  | "paper"
  | "halftone"
  | "checkerboard"
  | "stripes"
  | "crosshatch"
  | "gradient-noise"
  | "dots"
  | "triangles";

interface PerlinSettings {
  scale: number;
  octaves: number;
  persistence: number;
}

interface GrainSettings {
  density: number;
  size: number;
  monochrome: boolean;
  tint: string;
}

interface PaperSettings {
  roughness: number;
  color: "cream" | "white" | "gray";
  fiberDensity: number;
}

interface HalftoneSettings {
  dotSize: number;
  spacing: number;
  angle: number;
  shape: "circle" | "square" | "diamond";
  foreground: string;
  background: string;
}

interface CheckerboardSettings {
  cellSize: number;
  color1: string;
  color2: string;
  rounded: boolean;
}

interface StripesSettings {
  width: number;
  gap: number;
  angle: number;
  color1: string;
  color2: string;
}

interface CrosshatchSettings {
  lineWidth: number;
  spacing: number;
  angle1: number;
  angle2: number;
  color: string;
  opacity: number;
}

interface GradientNoiseSettings {
  scale: number;
  color1: string;
  color2: string;
  turbulence: number;
}

interface DotsSettings {
  dotSize: number;
  spacing: number;
  color: string;
  background: string;
  randomize: boolean;
}

interface TrianglesSettings {
  size: number;
  color1: string;
  color2: string;
  stroke: boolean;
}

interface TextureSettings {
  perlin: PerlinSettings;
  grain: GrainSettings;
  paper: PaperSettings;
  halftone: HalftoneSettings;
  checkerboard: CheckerboardSettings;
  stripes: StripesSettings;
  crosshatch: CrosshatchSettings;
  "gradient-noise": GradientNoiseSettings;
  dots: DotsSettings;
  triangles: TrianglesSettings;
}

const TEXTURE_LABELS: Record<TextureType, string> = {
  perlin: "Perlin Noise",
  grain: "Film Grain",
  paper: "Paper",
  halftone: "Halftone",
  checkerboard: "Checkerboard",
  stripes: "Stripes",
  crosshatch: "Crosshatch",
  "gradient-noise": "Gradient Noise",
  dots: "Dots",
  triangles: "Triangles",
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaults(): TextureSettings {
  return {
    perlin: { scale: 40, octaves: 4, persistence: 0.5 },
    grain: { density: 50, size: 1, monochrome: true, tint: "#ffffff" },
    paper: { roughness: 50, color: "cream", fiberDensity: 50 },
    halftone: {
      dotSize: 6,
      spacing: 12,
      angle: 45,
      shape: "circle",
      foreground: "#000000",
      background: "#ffffff",
    },
    checkerboard: {
      cellSize: 32,
      color1: "#000000",
      color2: "#ffffff",
      rounded: false,
    },
    stripes: {
      width: 10,
      gap: 10,
      angle: 45,
      color1: "#000000",
      color2: "#ffffff",
    },
    crosshatch: {
      lineWidth: 1,
      spacing: 8,
      angle1: 45,
      angle2: 135,
      color: "#000000",
      opacity: 80,
    },
    "gradient-noise": {
      scale: 40,
      color1: "#1a1a2e",
      color2: "#e94560",
      turbulence: 3,
    },
    dots: {
      dotSize: 3,
      spacing: 12,
      color: "#000000",
      background: "#ffffff",
      randomize: false,
    },
    triangles: {
      size: 30,
      color1: "#2563eb",
      color2: "#60a5fa",
      stroke: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Noise helpers
// ---------------------------------------------------------------------------

function noise2D(x: number, y: number, seed: number): number {
  const dot = x * 12.9898 + y * 78.233 + seed * 43758.5453;
  const s = Math.sin(dot) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = noise2D(ix, iy, seed);
  const b = noise2D(ix + 1, iy, seed);
  const c = noise2D(ix, iy + 1, seed);
  const d = noise2D(ix + 1, iy + 1, seed);

  const ab = a + ux * (b - a);
  const cd = c + ux * (d - c);
  return ab + uy * (cd - ab);
}

function perlin(
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  seed: number,
): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += smoothNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxValue;
}

// ---------------------------------------------------------------------------
// Texture rendering functions
// ---------------------------------------------------------------------------

function renderPerlin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: PerlinSettings,
  seed: number,
) {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = perlin(x / s.scale, y / s.scale, s.octaves, s.persistence, seed);
      const c = Math.floor(v * 255);
      const i = (y * w + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function renderGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: GrainSettings,
  seed: number,
) {
  const img = ctx.createImageData(w, h);
  const r = parseInt(s.tint.slice(1, 3), 16);
  const g = parseInt(s.tint.slice(3, 5), 16);
  const b = parseInt(s.tint.slice(5, 7), 16);
  const rng = mulberry32(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rng() * 100 < s.density) {
        if (s.monochrome) {
          const v = Math.floor(rng() * 255);
          img.data[i] = v;
          img.data[i + 1] = v;
          img.data[i + 2] = v;
        } else {
          const brightness = rng();
          img.data[i] = Math.floor(r * brightness);
          img.data[i + 1] = Math.floor(g * brightness);
          img.data[i + 2] = Math.floor(b * brightness);
        }
        img.data[i + 3] = 255;
      } else {
        img.data[i] = 0;
        img.data[i + 1] = 0;
        img.data[i + 2] = 0;
        img.data[i + 3] = 0;
      }
    }
  }
  // For larger grain sizes, scale up
  if (s.size > 1) {
    ctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const smallW = Math.ceil(w / s.size);
    const smallH = Math.ceil(h / s.size);
    ctx.drawImage(tmpCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
  } else {
    ctx.putImageData(img, 0, 0);
  }
}

function renderPaper(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: PaperSettings,
  seed: number,
) {
  const bgColors = { cream: "#f5f0e8", white: "#fafafa", gray: "#d4d4d4" };
  ctx.fillStyle = bgColors[s.color];
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed);
  const roughFactor = s.roughness / 100;
  const img = ctx.getImageData(0, 0, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = (rng() - 0.5) * roughFactor * 40;
      img.data[i] = clamp(img.data[i] + noise);
      img.data[i + 1] = clamp(img.data[i + 1] + noise);
      img.data[i + 2] = clamp(img.data[i + 2] + noise);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Fiber lines
  const fiberCount = Math.floor((s.fiberDensity / 100) * w * 2);
  ctx.strokeStyle = `rgba(0,0,0,${0.02 + roughFactor * 0.04})`;
  ctx.lineWidth = 0.5;
  for (let f = 0; f < fiberCount; f++) {
    const sx = rng() * w;
    const sy = rng() * h;
    const len = 5 + rng() * 20;
    const angle = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    ctx.stroke();
  }
}

function renderHalftone(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: HalftoneSettings,
) {
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = s.foreground;

  const rad = (s.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const diag = Math.sqrt(w * w + h * h);
  const halfDiag = diag / 2;
  const cx = w / 2;
  const cy = h / 2;

  for (let gy = -halfDiag; gy < halfDiag; gy += s.spacing) {
    for (let gx = -halfDiag; gx < halfDiag; gx += s.spacing) {
      const rx = gx * cos - gy * sin + cx;
      const ry = gx * sin + gy * cos + cy;
      if (rx < -s.dotSize || rx > w + s.dotSize || ry < -s.dotSize || ry > h + s.dotSize) continue;
      const r = s.dotSize / 2;
      if (s.shape === "circle") {
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.shape === "square") {
        ctx.fillRect(rx - r, ry - r, s.dotSize, s.dotSize);
      } else {
        ctx.beginPath();
        ctx.moveTo(rx, ry - r);
        ctx.lineTo(rx + r, ry);
        ctx.lineTo(rx, ry + r);
        ctx.lineTo(rx - r, ry);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function renderCheckerboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: CheckerboardSettings,
) {
  ctx.fillStyle = s.color2;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = s.color1;
  const r = s.rounded ? Math.min(s.cellSize * 0.2, 8) : 0;
  for (let y = 0; y < h; y += s.cellSize) {
    for (let x = 0; x < w; x += s.cellSize) {
      const col = Math.floor(x / s.cellSize);
      const row = Math.floor(y / s.cellSize);
      if ((col + row) % 2 === 0) {
        if (r > 0) {
          roundRect(ctx, x, y, s.cellSize, s.cellSize, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, s.cellSize, s.cellSize);
        }
      }
    }
  }
}

function renderStripes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: StripesSettings,
) {
  ctx.fillStyle = s.color2;
  ctx.fillRect(0, 0, w, h);

  const rad = (s.angle * Math.PI) / 180;
  const diag = Math.sqrt(w * w + h * h);
  const period = s.width + s.gap;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.fillStyle = s.color1;

  for (let p = -diag; p < diag; p += period) {
    ctx.fillRect(p, -diag, s.width, diag * 2);
  }
  ctx.restore();
}

function renderCrosshatch(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: CrosshatchSettings,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const alpha = s.opacity / 100;
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = s.lineWidth;
  const diag = Math.sqrt(w * w + h * h);

  for (const angle of [s.angle1, s.angle2]) {
    const rad = (angle * Math.PI) / 180;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    for (let p = -diag; p < diag; p += s.spacing) {
      ctx.beginPath();
      ctx.moveTo(p, -diag);
      ctx.lineTo(p, diag);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderGradientNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: GradientNoiseSettings,
  seed: number,
) {
  const r1 = parseInt(s.color1.slice(1, 3), 16);
  const g1 = parseInt(s.color1.slice(3, 5), 16);
  const b1 = parseInt(s.color1.slice(5, 7), 16);
  const r2 = parseInt(s.color2.slice(1, 3), 16);
  const g2 = parseInt(s.color2.slice(3, 5), 16);
  const b2 = parseInt(s.color2.slice(5, 7), 16);

  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = perlin(x / s.scale, y / s.scale, s.turbulence, 0.5, seed);
      const i = (y * w + x) * 4;
      img.data[i] = Math.floor(r1 + (r2 - r1) * v);
      img.data[i + 1] = Math.floor(g1 + (g2 - g1) * v);
      img.data[i + 2] = Math.floor(b1 + (b2 - b1) * v);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function renderDots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: DotsSettings,
  seed: number,
) {
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = s.color;
  const rng = mulberry32(seed);

  for (let y = s.spacing / 2; y < h; y += s.spacing) {
    for (let x = s.spacing / 2; x < w; x += s.spacing) {
      const dx = s.randomize ? (rng() - 0.5) * s.spacing * 0.6 : 0;
      const dy = s.randomize ? (rng() - 0.5) * s.spacing * 0.6 : 0;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, s.dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderTriangles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: TrianglesSettings,
  seed: number,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const rng = mulberry32(seed);
  const triH = (s.size * Math.sqrt(3)) / 2;

  for (let row = -1; row < h / triH + 1; row++) {
    for (let col = -1; col < w / (s.size / 2) + 1; col++) {
      const isUp = (row + col) % 2 === 0;
      const x = col * (s.size / 2);
      const y = row * triH;

      ctx.beginPath();
      if (isUp) {
        ctx.moveTo(x, y + triH);
        ctx.lineTo(x + s.size / 2, y);
        ctx.lineTo(x + s.size, y + triH);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + s.size / 2, y + triH);
        ctx.lineTo(x + s.size, y);
      }
      ctx.closePath();

      const useColor1 = rng() > 0.5;
      if (s.stroke) {
        ctx.strokeStyle = useColor1 ? s.color1 : s.color2;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = useColor1 ? s.color1 : s.color2;
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TextureGeneratorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textureType, setTextureType] = useState<TextureType>("perlin");
  const [settings, setSettings] = useState<TextureSettings>(defaults);
  const [canvasWidth, setCanvasWidth] = useState(512);
  const [canvasHeight, setCanvasHeight] = useState(512);
  const [tilePreview, setTilePreview] = useState(true);
  const [seed, setSeed] = useState(42);
  const [opacity, setOpacity] = useState(100);
  const [copied, setCopied] = useState(false);

  const update = useCallback(
    <K extends TextureType>(type: K, patch: Partial<TextureSettings[K]>) => {
      setSettings((prev) => ({
        ...prev,
        [type]: { ...prev[type], ...patch },
      }));
    },
    [],
  );

  // ---- Render texture to canvas ----

  const renderTexture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    switch (textureType) {
      case "perlin":
        renderPerlin(ctx, canvasWidth, canvasHeight, settings.perlin, seed);
        break;
      case "grain":
        renderGrain(ctx, canvasWidth, canvasHeight, settings.grain, seed);
        break;
      case "paper":
        renderPaper(ctx, canvasWidth, canvasHeight, settings.paper, seed);
        break;
      case "halftone":
        renderHalftone(ctx, canvasWidth, canvasHeight, settings.halftone);
        break;
      case "checkerboard":
        renderCheckerboard(ctx, canvasWidth, canvasHeight, settings.checkerboard);
        break;
      case "stripes":
        renderStripes(ctx, canvasWidth, canvasHeight, settings.stripes);
        break;
      case "crosshatch":
        renderCrosshatch(ctx, canvasWidth, canvasHeight, settings.crosshatch);
        break;
      case "gradient-noise":
        renderGradientNoise(ctx, canvasWidth, canvasHeight, settings["gradient-noise"], seed);
        break;
      case "dots":
        renderDots(ctx, canvasWidth, canvasHeight, settings.dots, seed);
        break;
      case "triangles":
        renderTriangles(ctx, canvasWidth, canvasHeight, settings.triangles, seed);
        break;
    }
  }, [textureType, settings, canvasWidth, canvasHeight, seed]);

  useEffect(() => {
    renderTexture();
  }, [renderTexture]);

  // ---- Export ----

  const downloadPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `texture-${textureType}-${seed}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [textureType, seed]);

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

  const downloadTile = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `tile-${textureType}-${canvasWidth}x${canvasHeight}-${seed}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [textureType, canvasWidth, canvasHeight, seed]);

  const randomizeSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  // ---- Controls per texture type ----

  function renderControls() {
    switch (textureType) {
      case "perlin": {
        const s = settings.perlin;
        return (
          <>
            <SliderRow label="Scale" value={s.scale} min={1} max={100} onChange={(v) => update("perlin", { scale: v })} />
            <SliderRow label="Octaves" value={s.octaves} min={1} max={6} step={1} onChange={(v) => update("perlin", { octaves: v })} />
            <SliderRow label="Persistence" value={s.persistence} min={0} max={1} step={0.05} onChange={(v) => update("perlin", { persistence: v })} />
          </>
        );
      }
      case "grain": {
        const s = settings.grain;
        return (
          <>
            <SliderRow label="Density" value={s.density} min={0} max={100} suffix="%" onChange={(v) => update("grain", { density: v })} />
            <SliderRow label="Size" value={s.size} min={1} max={5} step={1} suffix="px" onChange={(v) => update("grain", { size: v })} />
            <ToggleRow label="Monochrome" value={s.monochrome} onChange={(v) => update("grain", { monochrome: v })} />
            {!s.monochrome && (
              <ColorRow label="Tint" value={s.tint} onChange={(v) => update("grain", { tint: v })} />
            )}
          </>
        );
      }
      case "paper": {
        const s = settings.paper;
        return (
          <>
            <SliderRow label="Roughness" value={s.roughness} min={0} max={100} onChange={(v) => update("paper", { roughness: v })} />
            <div className="flex flex-col gap-1">
              <Label>Color</Label>
              <div className="flex gap-2">
                {(["cream", "white", "gray"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => update("paper", { color: c })}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors capitalize ${
                      s.color === c
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <SliderRow label="Fiber Density" value={s.fiberDensity} min={0} max={100} onChange={(v) => update("paper", { fiberDensity: v })} />
          </>
        );
      }
      case "halftone": {
        const s = settings.halftone;
        return (
          <>
            <SliderRow label="Dot Size" value={s.dotSize} min={2} max={20} suffix="px" onChange={(v) => update("halftone", { dotSize: v })} />
            <SliderRow label="Spacing" value={s.spacing} min={4} max={40} suffix="px" onChange={(v) => update("halftone", { spacing: v })} />
            <SliderRow label="Angle" value={s.angle} min={0} max={180} suffix="deg" onChange={(v) => update("halftone", { angle: v })} />
            <div className="flex flex-col gap-1">
              <Label>Shape</Label>
              <div className="flex gap-2">
                {(["circle", "square", "diamond"] as const).map((sh) => (
                  <button
                    key={sh}
                    onClick={() => update("halftone", { shape: sh })}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors capitalize ${
                      s.shape === sh
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {sh}
                  </button>
                ))}
              </div>
            </div>
            <ColorRow label="Foreground" value={s.foreground} onChange={(v) => update("halftone", { foreground: v })} />
            <ColorRow label="Background" value={s.background} onChange={(v) => update("halftone", { background: v })} />
          </>
        );
      }
      case "checkerboard": {
        const s = settings.checkerboard;
        return (
          <>
            <SliderRow label="Cell Size" value={s.cellSize} min={4} max={64} suffix="px" onChange={(v) => update("checkerboard", { cellSize: v })} />
            <ColorRow label="Color 1" value={s.color1} onChange={(v) => update("checkerboard", { color1: v })} />
            <ColorRow label="Color 2" value={s.color2} onChange={(v) => update("checkerboard", { color2: v })} />
            <ToggleRow label="Rounded Corners" value={s.rounded} onChange={(v) => update("checkerboard", { rounded: v })} />
          </>
        );
      }
      case "stripes": {
        const s = settings.stripes;
        return (
          <>
            <SliderRow label="Width" value={s.width} min={2} max={40} suffix="px" onChange={(v) => update("stripes", { width: v })} />
            <SliderRow label="Gap" value={s.gap} min={0} max={40} suffix="px" onChange={(v) => update("stripes", { gap: v })} />
            <SliderRow label="Angle" value={s.angle} min={0} max={180} suffix="deg" onChange={(v) => update("stripes", { angle: v })} />
            <ColorRow label="Color 1" value={s.color1} onChange={(v) => update("stripes", { color1: v })} />
            <ColorRow label="Color 2" value={s.color2} onChange={(v) => update("stripes", { color2: v })} />
          </>
        );
      }
      case "crosshatch": {
        const s = settings.crosshatch;
        return (
          <>
            <SliderRow label="Line Width" value={s.lineWidth} min={1} max={5} suffix="px" onChange={(v) => update("crosshatch", { lineWidth: v })} />
            <SliderRow label="Spacing" value={s.spacing} min={4} max={30} suffix="px" onChange={(v) => update("crosshatch", { spacing: v })} />
            <SliderRow label="Angle 1" value={s.angle1} min={0} max={180} suffix="deg" onChange={(v) => update("crosshatch", { angle1: v })} />
            <SliderRow label="Angle 2" value={s.angle2} min={0} max={180} suffix="deg" onChange={(v) => update("crosshatch", { angle2: v })} />
            <ColorRow label="Color" value={s.color} onChange={(v) => update("crosshatch", { color: v })} />
            <SliderRow label="Opacity" value={s.opacity} min={0} max={100} suffix="%" onChange={(v) => update("crosshatch", { opacity: v })} />
          </>
        );
      }
      case "gradient-noise": {
        const s = settings["gradient-noise"];
        return (
          <>
            <SliderRow label="Scale" value={s.scale} min={1} max={100} onChange={(v) => update("gradient-noise", { scale: v })} />
            <ColorRow label="Color 1" value={s.color1} onChange={(v) => update("gradient-noise", { color1: v })} />
            <ColorRow label="Color 2" value={s.color2} onChange={(v) => update("gradient-noise", { color2: v })} />
            <SliderRow label="Turbulence" value={s.turbulence} min={1} max={8} step={1} onChange={(v) => update("gradient-noise", { turbulence: v })} />
          </>
        );
      }
      case "dots": {
        const s = settings.dots;
        return (
          <>
            <SliderRow label="Dot Size" value={s.dotSize} min={1} max={10} suffix="px" onChange={(v) => update("dots", { dotSize: v })} />
            <SliderRow label="Spacing" value={s.spacing} min={5} max={30} suffix="px" onChange={(v) => update("dots", { spacing: v })} />
            <ColorRow label="Color" value={s.color} onChange={(v) => update("dots", { color: v })} />
            <ColorRow label="Background" value={s.background} onChange={(v) => update("dots", { background: v })} />
            <ToggleRow label="Randomize Positions" value={s.randomize} onChange={(v) => update("dots", { randomize: v })} />
          </>
        );
      }
      case "triangles": {
        const s = settings.triangles;
        return (
          <>
            <SliderRow label="Size" value={s.size} min={10} max={60} suffix="px" onChange={(v) => update("triangles", { size: v })} />
            <ColorRow label="Color 1" value={s.color1} onChange={(v) => update("triangles", { color1: v })} />
            <ColorRow label="Color 2" value={s.color2} onChange={(v) => update("triangles", { color2: v })} />
            <ToggleRow label="Stroke Only" value={s.stroke} onChange={(v) => update("triangles", { stroke: v })} />
          </>
        );
      }
    }
  }

  // ---- Render ----

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--background)] shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[var(--accent)]" />
            <h1 className="text-sm font-semibold">Texture Generator</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            title="Download seamless tile"
          >
            <Image size={14} />
            Tile
          </button>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={downloadPNG}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Download size={14} />
            PNG
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview */}
        <div className="flex-[3] flex items-center justify-center bg-[var(--surface)] overflow-auto p-4">
          <div
            className="relative border border-[var(--border)] rounded-lg overflow-hidden"
            style={{ opacity: opacity / 100 }}
          >
            {tilePreview ? (
              <TiledPreview canvasRef={canvasRef} width={canvasWidth} height={canvasHeight} />
            ) : (
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className="block max-w-full max-h-full"
                style={{ imageRendering: canvasWidth <= 128 ? "pixelated" : "auto" }}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex-[2] max-w-[420px] min-w-[280px] border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto">
          {/* Texture Type Selection */}
          <Section title="Texture Type" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TEXTURE_LABELS) as TextureType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTextureType(t)}
                  className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors text-left ${
                    textureType === t
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {TEXTURE_LABELS[t]}
                </button>
              ))}
            </div>
          </Section>

          {/* Dynamic Controls */}
          <Section title="Controls" defaultOpen={true}>
            {renderControls()}
          </Section>

          {/* Canvas Size */}
          <Section title="Canvas Size" defaultOpen={false}>
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <Label>Width</Label>
                <input
                  type="number"
                  min={64}
                  max={2048}
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(clampSize(+e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <Label>Height</Label>
                <input
                  type="number"
                  min={64}
                  max={2048}
                  value={canvasHeight}
                  onChange={(e) => setCanvasHeight(clampSize(+e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </Section>

          {/* Tile Preview */}
          <Section title="Preview" defaultOpen={false}>
            <ToggleRow
              label="Tile 2x2 Preview"
              value={tilePreview}
              onChange={setTilePreview}
            />
          </Section>

          {/* Seed */}
          <Section title="Seed" defaultOpen={false}>
            <div className="flex gap-2 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <Label>Seed</Label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(+e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                onClick={randomizeSeed}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
              >
                <Shuffle size={14} />
                Randomize
              </button>
            </div>
          </Section>

          {/* Opacity */}
          <Section title="Opacity" defaultOpen={false}>
            <SliderRow
              label="Global Opacity"
              value={opacity}
              min={0}
              max={100}
              suffix="%"
              onChange={setOpacity}
            />
          </Section>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiled preview component
// ---------------------------------------------------------------------------

function TiledPreview({
  canvasRef,
  width,
  height,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
}) {
  const tileCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const src = canvasRef.current;
    const dest = tileCanvasRef.current;
    if (!src || !dest) return;

    const ctx = dest.getContext("2d")!;
    dest.width = width * 2;
    dest.height = height * 2;

    // Draw a small delay to allow source canvas to render first
    const frame = requestAnimationFrame(() => {
      ctx.drawImage(src, 0, 0);
      ctx.drawImage(src, width, 0);
      ctx.drawImage(src, 0, height);
      ctx.drawImage(src, width, height);
    });
    return () => cancelAnimationFrame(frame);
  });

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "none" }}
      />
      <canvas
        ref={tileCanvasRef}
        className="block max-w-full max-h-[70vh]"
        style={{ imageRendering: width <= 128 ? "pixelated" : "auto" }}
      />
      {/* Grid overlay to show tile boundaries */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--accent) 1px, transparent 1px),
            linear-gradient(to bottom, var(--accent) 1px, transparent 1px)
          `,
          backgroundSize: `50% 50%`,
          backgroundPosition: "50% 50%",
          opacity: 0.2,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable input components
// ---------------------------------------------------------------------------

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {step < 1 ? value.toFixed(2) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[var(--accent)] h-1.5"
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
    <div className="flex items-center justify-between gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 px-2 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--surface)] focus:outline-none focus:border-[var(--accent)] font-mono"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-[var(--border)] cursor-pointer bg-transparent p-0"
        />
      </div>
    </div>
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
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          value ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
        role="switch"
        aria-checked={value}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function clampSize(v: number): number {
  return Math.max(64, Math.min(2048, v || 64));
}

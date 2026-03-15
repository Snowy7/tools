"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  Layers,
  Package,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EffectTab = "outline" | "glow" | "shadow" | "flash";
type OutlinePosition = "outside" | "inside" | "center";
type BgMode = "checkerboard" | "solid" | "custom";

interface OutlineSettings {
  enabled: boolean;
  color: string;
  thickness: number;
  position: OutlinePosition;
}

interface GlowSettings {
  enabled: boolean;
  color: string;
  intensity: number;
  spread: number;
}

interface ShadowSettings {
  enabled: boolean;
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
}

interface FlashSettings {
  enabled: boolean;
  color: string;
  intensity: number;
}

interface SpriteEntry {
  id: string;
  name: string;
  image: HTMLImageElement;
  imageData: ImageData;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let _idCounter = 0;
function uid() {
  return `sp_${++_idCounter}_${Date.now()}`;
}

function hexToRgba(hex: string): [number, number, number, number] {
  const c = hex.replace("#", "");
  const full =
    c.length === 3
      ? c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
      : c;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/* ------------------------------------------------------------------ */
/*  Canvas effect algorithms (pure Canvas API)                         */
/* ------------------------------------------------------------------ */

function dilateAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxA = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const a = alpha[ny * w + nx];
            if (a > maxA) maxA = a;
          }
        }
      }
      out[y * w + x] = maxA;
    }
  }
  return out;
}

function erodeAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minA = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const a = alpha[ny * w + nx];
            if (a < minA) minA = a;
          } else {
            minA = 0;
          }
        }
      }
      out[y * w + x] = minA;
    }
  }
  return out;
}

function extractAlpha(data: ImageData): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(data.width * data.height);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = data.data[i * 4 + 3];
  }
  return alpha;
}

function applyOutline(
  src: ImageData,
  settings: OutlineSettings
): ImageData {
  const { width: w, height: h } = src;
  const [cr, cg, cb] = hexToRgba(settings.color);
  const alpha = extractAlpha(src);
  const t = settings.thickness;

  let outlineMask: Uint8ClampedArray;

  if (settings.position === "outside") {
    const dilated = dilateAlpha(alpha, w, h, t);
    outlineMask = new Uint8ClampedArray(w * h);
    for (let i = 0; i < outlineMask.length; i++) {
      outlineMask[i] = Math.max(0, dilated[i] - alpha[i]);
    }
  } else if (settings.position === "inside") {
    const eroded = erodeAlpha(alpha, w, h, t);
    outlineMask = new Uint8ClampedArray(w * h);
    for (let i = 0; i < outlineMask.length; i++) {
      outlineMask[i] = Math.max(0, alpha[i] - eroded[i]);
    }
  } else {
    const half = Math.max(1, Math.floor(t / 2));
    const dilated = dilateAlpha(alpha, w, h, half);
    const eroded = erodeAlpha(alpha, w, h, Math.max(1, t - half));
    outlineMask = new Uint8ClampedArray(w * h);
    for (let i = 0; i < outlineMask.length; i++) {
      outlineMask[i] = Math.max(0, dilated[i] - eroded[i]);
    }
  }

  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);

  if (settings.position === "outside") {
    // Draw outline behind sprite
    for (let i = 0; i < outlineMask.length; i++) {
      if (outlineMask[i] > 0 && alpha[i] === 0) {
        const idx = i * 4;
        out.data[idx] = cr;
        out.data[idx + 1] = cg;
        out.data[idx + 2] = cb;
        out.data[idx + 3] = outlineMask[i];
      }
    }
  } else {
    // Inside or center: outline replaces sprite pixels
    for (let i = 0; i < outlineMask.length; i++) {
      if (outlineMask[i] > 0) {
        const idx = i * 4;
        const ratio = outlineMask[i] / 255;
        out.data[idx] = Math.round(cr * ratio + src.data[idx] * (1 - ratio));
        out.data[idx + 1] = Math.round(cg * ratio + src.data[idx + 1] * (1 - ratio));
        out.data[idx + 2] = Math.round(cb * ratio + src.data[idx + 2] * (1 - ratio));
        out.data[idx + 3] = Math.max(out.data[idx + 3], outlineMask[i]);
      }
    }
  }

  return out;
}

function applyGlow(
  src: ImageData,
  settings: GlowSettings
): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const [cr, cg, cb] = hexToRgba(settings.color);
  const intensity = settings.intensity / 100;

  // Create alpha-only canvas for glow source
  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = w;
  alphaCanvas.height = h;
  const alphaCtx = alphaCanvas.getContext("2d")!;
  const alphaImg = alphaCtx.createImageData(w, h);
  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i + 3];
    alphaImg.data[i] = cr;
    alphaImg.data[i + 1] = cg;
    alphaImg.data[i + 2] = cb;
    alphaImg.data[i + 3] = Math.round(a * intensity);
  }
  alphaCtx.putImageData(alphaImg, 0, 0);

  // Blur it
  const pad = settings.spread * 3;
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = w + pad * 2;
  glowCanvas.height = h + pad * 2;
  const glowCtx = glowCanvas.getContext("2d")!;
  glowCtx.filter = `blur(${settings.spread}px)`;
  glowCtx.drawImage(alphaCanvas, pad, pad);
  glowCtx.filter = "none";

  // Composite: glow behind, then original on top
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = w + pad * 2;
  resultCanvas.height = h + pad * 2;
  const rCtx = resultCanvas.getContext("2d")!;
  rCtx.drawImage(glowCanvas, 0, 0);

  // Draw original src
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  srcCanvas.getContext("2d")!.putImageData(src, 0, 0);
  rCtx.drawImage(srcCanvas, pad, pad);

  return resultCanvas;
}

function applyShadow(
  src: ImageData,
  settings: ShadowSettings
): HTMLCanvasElement {
  const { width: w, height: h } = src;
  const [cr, cg, cb] = hexToRgba(settings.color);
  const opacity = settings.opacity / 100;

  // Create shadow source
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = w;
  shadowCanvas.height = h;
  const shadowCtx = shadowCanvas.getContext("2d")!;
  const shadowImg = shadowCtx.createImageData(w, h);
  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i + 3];
    shadowImg.data[i] = cr;
    shadowImg.data[i + 1] = cg;
    shadowImg.data[i + 2] = cb;
    shadowImg.data[i + 3] = Math.round(a * opacity);
  }
  shadowCtx.putImageData(shadowImg, 0, 0);

  const pad = Math.max(settings.blur * 3, 30);
  const totalW = w + pad * 2;
  const totalH = h + pad * 2;

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = totalW;
  resultCanvas.height = totalH;
  const rCtx = resultCanvas.getContext("2d")!;

  // Draw blurred shadow with offset
  if (settings.blur > 0) {
    rCtx.filter = `blur(${settings.blur}px)`;
  }
  rCtx.drawImage(shadowCanvas, pad + settings.offsetX, pad + settings.offsetY);
  rCtx.filter = "none";

  // Draw original on top
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  srcCanvas.getContext("2d")!.putImageData(src, 0, 0);
  rCtx.drawImage(srcCanvas, pad, pad);

  return resultCanvas;
}

function applyFlash(src: ImageData, settings: FlashSettings): ImageData {
  const { width: w, height: h } = src;
  const [cr, cg, cb] = hexToRgba(settings.color);
  const intensity = settings.intensity / 100;

  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] === 0) continue;
    out.data[i] = Math.round(out.data[i] * (1 - intensity) + cr * intensity);
    out.data[i + 1] = Math.round(out.data[i + 1] * (1 - intensity) + cg * intensity);
    out.data[i + 2] = Math.round(out.data[i + 2] * (1 - intensity) + cb * intensity);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Draw checkerboard                                                  */
/* ------------------------------------------------------------------ */

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tileSize: number = 8
) {
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#999999";
  for (let y = 0; y < h; y += tileSize) {
    for (let x = 0; x < w; x += tileSize) {
      if (((x / tileSize + y / tileSize) | 0) % 2 === 0) {
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Composite pipeline                                                 */
/* ------------------------------------------------------------------ */

function compositeEffects(
  sourceData: ImageData,
  outline: OutlineSettings,
  glow: GlowSettings,
  shadow: ShadowSettings,
  flash: FlashSettings
): HTMLCanvasElement {
  const { width: w, height: h } = sourceData;

  // Start with the source
  let current = new ImageData(new Uint8ClampedArray(sourceData.data), w, h);

  // Apply color flash first (modifies pixels)
  if (flash.enabled && flash.intensity > 0) {
    current = applyFlash(current, flash);
  }

  // Apply outline
  if (outline.enabled && outline.thickness > 0) {
    current = applyOutline(current, outline);
  }

  // Now handle glow and shadow which produce padded canvases
  const hasGlow = glow.enabled && glow.spread > 0;
  const hasShadow = shadow.enabled;

  if (!hasGlow && !hasShadow) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.putImageData(current, 0, 0);
    return c;
  }

  // Determine max padding needed
  const glowPad = hasGlow ? glow.spread * 3 : 0;
  const shadowPad = hasShadow ? Math.max(shadow.blur * 3, 30) : 0;
  const pad = Math.max(glowPad, shadowPad);

  const totalW = w + pad * 2;
  const totalH = h + pad * 2;

  const result = document.createElement("canvas");
  result.width = totalW;
  result.height = totalH;
  const rCtx = result.getContext("2d")!;

  // Draw shadow first (behind everything)
  if (hasShadow) {
    const [cr, cg, cb] = hexToRgba(shadow.color);
    const opacity = shadow.opacity / 100;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    const shadowImg = tmpCtx.createImageData(w, h);
    for (let i = 0; i < current.data.length; i += 4) {
      const a = current.data[i + 3];
      shadowImg.data[i] = cr;
      shadowImg.data[i + 1] = cg;
      shadowImg.data[i + 2] = cb;
      shadowImg.data[i + 3] = Math.round(a * opacity);
    }
    tmpCtx.putImageData(shadowImg, 0, 0);
    if (shadow.blur > 0) rCtx.filter = `blur(${shadow.blur}px)`;
    rCtx.drawImage(tmpCanvas, pad + shadow.offsetX, pad + shadow.offsetY);
    rCtx.filter = "none";
  }

  // Draw glow
  if (hasGlow) {
    const [cr, cg, cb] = hexToRgba(glow.color);
    const intensity = glow.intensity / 100;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    const glowImg = tmpCtx.createImageData(w, h);
    for (let i = 0; i < current.data.length; i += 4) {
      const a = current.data[i + 3];
      glowImg.data[i] = cr;
      glowImg.data[i + 1] = cg;
      glowImg.data[i + 2] = cb;
      glowImg.data[i + 3] = Math.round(a * intensity);
    }
    tmpCtx.putImageData(glowImg, 0, 0);
    rCtx.filter = `blur(${glow.spread}px)`;
    rCtx.drawImage(tmpCanvas, pad, pad);
    rCtx.filter = "none";
  }

  // Draw the current (with outline + flash already baked in) on top
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  srcCanvas.getContext("2d")!.putImageData(current, 0, 0);
  rCtx.drawImage(srcCanvas, pad, pad);

  return result;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SpriteOutlinePage() {
  /* Sprites (batch mode) */
  const [sprites, setSprites] = useState<SpriteEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  /* Effect settings */
  const [outline, setOutline] = useState<OutlineSettings>({
    enabled: true,
    color: "#ffffff",
    thickness: 2,
    position: "outside",
  });
  const [glow, setGlow] = useState<GlowSettings>({
    enabled: false,
    color: "#00ffff",
    intensity: 50,
    spread: 5,
  });
  const [shadow, setShadow] = useState<ShadowSettings>({
    enabled: false,
    color: "#000000",
    offsetX: 3,
    offsetY: 3,
    blur: 4,
    opacity: 70,
  });
  const [flash, setFlash] = useState<FlashSettings>({
    enabled: false,
    color: "#ffffff",
    intensity: 60,
  });

  /* Tab */
  const [activeTab, setActiveTab] = useState<EffectTab>("outline");

  /* Background */
  const [bgMode, setBgMode] = useState<BgMode>("checkerboard");
  const [bgColor, setBgColor] = useState("#222222");

  /* Zoom */
  const zoomLevels = [1, 2, 4, 8] as const;
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = zoomLevels[zoomIdx];

  /* Canvas ref */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLCanvasElement | null>(null);

  /* Clipboard */
  const [copied, setCopied] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Load sprites                                                     */
  /* ---------------------------------------------------------------- */

  const loadFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArr.length === 0) return;

    fileArr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = img.width;
          tmpCanvas.height = img.height;
          const tmpCtx = tmpCanvas.getContext("2d")!;
          tmpCtx.drawImage(img, 0, 0);
          const data = tmpCtx.getImageData(0, 0, img.width, img.height);
          setSprites((prev) => {
            const entry: SpriteEntry = {
              id: uid(),
              name: file.name,
              image: img,
              imageData: data,
            };
            const next = [...prev, entry];
            return next;
          });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  /* Set active to first sprite when loaded */
  useEffect(() => {
    if (sprites.length > 0 && activeIdx >= sprites.length) {
      setActiveIdx(sprites.length - 1);
    }
  }, [sprites.length, activeIdx]);

  /* ---------------------------------------------------------------- */
  /*  Render preview                                                   */
  /* ---------------------------------------------------------------- */

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const active = sprites[activeIdx];
    if (!active) {
      canvas.width = 400;
      canvas.height = 300;
      ctx.clearRect(0, 0, 400, 300);
      return;
    }

    const effected = compositeEffects(active.imageData, outline, glow, shadow, flash);
    resultRef.current = effected;

    const dw = effected.width * zoom;
    const dh = effected.height * zoom;
    canvas.width = dw;
    canvas.height = dh;

    // Background
    if (bgMode === "checkerboard") {
      drawCheckerboard(ctx, dw, dh, Math.max(8, 8 * zoom));
    } else if (bgMode === "solid") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dw, dh);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dw, dh);
    }

    // Draw effected sprite with nearest-neighbor for pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(effected, 0, 0, dw, dh);
  }, [sprites, activeIdx, outline, glow, shadow, flash, zoom, bgMode, bgColor]);

  useEffect(() => {
    render();
  }, [render]);

  /* ---------------------------------------------------------------- */
  /*  Export                                                            */
  /* ---------------------------------------------------------------- */

  const exportSingle = useCallback(() => {
    if (!resultRef.current) return;
    const a = document.createElement("a");
    a.href = resultRef.current.toDataURL("image/png");
    const name = sprites[activeIdx]?.name ?? "sprite";
    a.download = name.replace(/\.[^.]+$/, "") + "_effected.png";
    a.click();
  }, [sprites, activeIdx]);

  const exportAll = useCallback(() => {
    sprites.forEach((sp) => {
      const effected = compositeEffects(sp.imageData, outline, glow, shadow, flash);
      const a = document.createElement("a");
      a.href = effected.toDataURL("image/png");
      a.download = sp.name.replace(/\.[^.]+$/, "") + "_effected.png";
      a.click();
    });
  }, [sprites, outline, glow, shadow, flash]);

  const copyToClipboard = useCallback(async () => {
    if (!resultRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        resultRef.current!.toBlob(resolve, "image/png")
      );
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* clipboard not available */
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Remove sprite                                                    */
  /* ---------------------------------------------------------------- */

  const removeSprite = useCallback(
    (idx: number) => {
      setSprites((prev) => prev.filter((_, i) => i !== idx));
      if (activeIdx >= sprites.length - 1 && activeIdx > 0) {
        setActiveIdx(activeIdx - 1);
      }
    },
    [activeIdx, sprites.length]
  );

  /* ---------------------------------------------------------------- */
  /*  Drag and drop                                                    */
  /* ---------------------------------------------------------------- */

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      loadFiles(e.dataTransfer.files);
    },
    [loadFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) loadFiles(e.target.files);
      e.target.value = "";
    },
    [loadFiles]
  );

  /* ---------------------------------------------------------------- */
  /*  Sidebar section component                                        */
  /* ---------------------------------------------------------------- */

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {title}
      </h3>
      {children}
    </div>
  );

  const SliderRow = ({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    suffix = "",
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (v: number) => void;
    suffix?: string;
  }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 shrink-0" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-[var(--accent)]"
      />
      <span className="text-xs tabular-nums w-12 text-right" style={{ color: "var(--foreground)" }}>
        {value}{suffix}
      </span>
    </div>
  );

  const ColorRow = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 shrink-0" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
      />
      <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>
        {value}
      </span>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Tab data                                                         */
  /* ---------------------------------------------------------------- */

  const tabs: { id: EffectTab; label: string; enabled: boolean }[] = [
    { id: "outline", label: "Outline", enabled: outline.enabled },
    { id: "glow", label: "Glow", enabled: glow.enabled },
    { id: "shadow", label: "Shadow", enabled: shadow.enabled },
    { id: "flash", label: "Flash", enabled: flash.enabled },
  ];

  const toggleEffect = (tab: EffectTab) => {
    switch (tab) {
      case "outline":
        setOutline((p) => ({ ...p, enabled: !p.enabled }));
        break;
      case "glow":
        setGlow((p) => ({ ...p, enabled: !p.enabled }));
        break;
      case "shadow":
        setShadow((p) => ({ ...p, enabled: !p.enabled }));
        break;
      case "flash":
        setFlash((p) => ({ ...p, enabled: !p.enabled }));
        break;
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const hasSprites = sprites.length > 0;

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
        <Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h1 className="text-sm font-semibold tracking-tight">Sprite Outline &amp; Glow</h1>
        <div className="flex-1" />

        {hasSprites && (
          <div className="flex items-center gap-1.5">
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
              onClick={exportSingle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: "var(--accent)" }}
              aria-label="Download PNG"
            >
              <Download size={14} />
              Export
            </button>
            {sprites.length > 1 && (
              <button
                type="button"
                onClick={exportAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                aria-label="Download all PNGs"
              >
                <Package size={14} />
                Export All
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: preview */}
        <div className="flex-[3] flex flex-col overflow-hidden">
          {!hasSprites ? (
            /* Upload zone */
            <div
              className="flex-1 flex items-center justify-center p-8"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <label
                className="flex flex-col items-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] max-w-md w-full"
                style={{ borderColor: "var(--border)" }}
              >
                <Upload size={40} style={{ color: "var(--muted)" }} />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    Drop sprites here or click to upload
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    PNG, GIF, or WebP. Multiple files supported.
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          ) : (
            <>
              {/* Batch strip */}
              {sprites.length > 1 && (
                <div
                  className="flex items-center gap-1 px-3 py-1.5 border-b overflow-x-auto shrink-0"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {sprites.map((sp, i) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors shrink-0 ${
                        i === activeIdx
                          ? "font-medium"
                          : ""
                      }`}
                      style={{
                        background: i === activeIdx ? "var(--accent)" : "transparent",
                        color: i === activeIdx ? "#fff" : "var(--foreground)",
                      }}
                    >
                      <Layers size={12} />
                      <span className="max-w-[100px] truncate">{sp.name}</span>
                      <span
                        className="ml-1 p-0.5 rounded hover:bg-white/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSprite(i);
                        }}
                        role="button"
                        aria-label={`Remove ${sp.name}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            removeSprite(i);
                          }
                        }}
                      >
                        <X size={10} />
                      </span>
                    </button>
                  ))}
                  <label
                    className="p-1 rounded cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                    title="Add more sprites"
                  >
                    <Plus size={14} style={{ color: "var(--muted)" }} />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                </div>
              )}

              {/* Canvas preview */}
              <div
                className="flex-1 overflow-auto flex items-center justify-center p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <canvas
                  ref={canvasRef}
                  style={{ imageRendering: "pixelated" }}
                />
              </div>

              {/* Zoom bar */}
              <div
                className="flex items-center justify-center gap-2 px-3 py-1.5 border-t shrink-0"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <button
                  type="button"
                  disabled={zoomIdx <= 0}
                  onClick={() => setZoomIdx((p) => Math.max(0, p - 1))}
                  className="p-1 rounded transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-xs tabular-nums font-medium w-8 text-center">
                  {zoom}x
                </span>
                <button
                  type="button"
                  disabled={zoomIdx >= zoomLevels.length - 1}
                  onClick={() => setZoomIdx((p) => Math.min(zoomLevels.length - 1, p + 1))}
                  className="p-1 rounded transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
                <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
                {sprites[activeIdx] && (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {sprites[activeIdx].image.width} x {sprites[activeIdx].image.height}px
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right panel: settings sidebar */}
        {hasSprites && (
          <aside
            className="flex-[2] max-w-xs border-l overflow-y-auto shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="p-4 space-y-5">
              {/* Effect tabs */}
              <div className="space-y-2">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}
                >
                  Effects
                </h3>
                <div
                  className="grid grid-cols-2 gap-1 p-1 rounded-lg"
                  style={{ background: "var(--background)" }}
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        activeTab === tab.id ? "" : "hover:bg-[var(--surface-hover)]"
                      }`}
                      style={{
                        background: activeTab === tab.id ? "var(--surface)" : "transparent",
                        color: activeTab === tab.id ? "var(--foreground)" : "var(--muted)",
                        boxShadow:
                          activeTab === tab.id
                            ? "0 1px 3px rgba(0,0,0,.1)"
                            : "none",
                      }}
                    >
                      {tab.label}
                      {tab.enabled && (
                        <span
                          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleEffect(activeTab)}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{
                    background: tabs.find((t) => t.id === activeTab)?.enabled
                      ? "var(--accent)"
                      : "var(--border)",
                  }}
                  role="switch"
                  aria-checked={tabs.find((t) => t.id === activeTab)?.enabled}
                  aria-label={`Toggle ${activeTab}`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{
                      left: tabs.find((t) => t.id === activeTab)?.enabled
                        ? "calc(100% - 18px)"
                        : "2px",
                    }}
                  />
                </button>
                <span className="text-xs font-medium capitalize">{activeTab} enabled</span>
              </div>

              {/* Outline settings */}
              {activeTab === "outline" && (
                <div className="space-y-3">
                  <ColorRow
                    label="Color"
                    value={outline.color}
                    onChange={(v) => setOutline((p) => ({ ...p, color: v }))}
                  />
                  <SliderRow
                    label="Thickness"
                    value={outline.thickness}
                    min={1}
                    max={10}
                    onChange={(v) => setOutline((p) => ({ ...p, thickness: v }))}
                    suffix="px"
                  />
                  <Section title="Position">
                    <div className="flex gap-1">
                      {(["outside", "inside", "center"] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setOutline((p) => ({ ...p, position: pos }))}
                          className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors capitalize"
                          style={{
                            background:
                              outline.position === pos ? "var(--accent)" : "var(--background)",
                            color: outline.position === pos ? "#fff" : "var(--foreground)",
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </Section>
                </div>
              )}

              {/* Glow settings */}
              {activeTab === "glow" && (
                <div className="space-y-3">
                  <ColorRow
                    label="Color"
                    value={glow.color}
                    onChange={(v) => setGlow((p) => ({ ...p, color: v }))}
                  />
                  <SliderRow
                    label="Intensity"
                    value={glow.intensity}
                    min={0}
                    max={100}
                    onChange={(v) => setGlow((p) => ({ ...p, intensity: v }))}
                    suffix="%"
                  />
                  <SliderRow
                    label="Spread"
                    value={glow.spread}
                    min={1}
                    max={20}
                    onChange={(v) => setGlow((p) => ({ ...p, spread: v }))}
                    suffix="px"
                  />
                </div>
              )}

              {/* Shadow settings */}
              {activeTab === "shadow" && (
                <div className="space-y-3">
                  <ColorRow
                    label="Color"
                    value={shadow.color}
                    onChange={(v) => setShadow((p) => ({ ...p, color: v }))}
                  />
                  <SliderRow
                    label="Offset X"
                    value={shadow.offsetX}
                    min={-20}
                    max={20}
                    onChange={(v) => setShadow((p) => ({ ...p, offsetX: v }))}
                    suffix="px"
                  />
                  <SliderRow
                    label="Offset Y"
                    value={shadow.offsetY}
                    min={-20}
                    max={20}
                    onChange={(v) => setShadow((p) => ({ ...p, offsetY: v }))}
                    suffix="px"
                  />
                  <SliderRow
                    label="Blur"
                    value={shadow.blur}
                    min={0}
                    max={20}
                    onChange={(v) => setShadow((p) => ({ ...p, blur: v }))}
                    suffix="px"
                  />
                  <SliderRow
                    label="Opacity"
                    value={shadow.opacity}
                    min={0}
                    max={100}
                    onChange={(v) => setShadow((p) => ({ ...p, opacity: v }))}
                    suffix="%"
                  />
                </div>
              )}

              {/* Flash settings */}
              {activeTab === "flash" && (
                <div className="space-y-3">
                  <ColorRow
                    label="Color"
                    value={flash.color}
                    onChange={(v) => setFlash((p) => ({ ...p, color: v }))}
                  />
                  <SliderRow
                    label="Intensity"
                    value={flash.intensity}
                    min={0}
                    max={100}
                    onChange={(v) => setFlash((p) => ({ ...p, intensity: v }))}
                    suffix="%"
                  />
                </div>
              )}

              {/* Divider */}
              <div className="h-px" style={{ background: "var(--border)" }} />

              {/* Background */}
              <Section title="Background">
                <div className="flex gap-1">
                  {(
                    [
                      { id: "checkerboard", label: "Checker" },
                      { id: "solid", label: "Solid" },
                      { id: "custom", label: "Custom" },
                    ] as const
                  ).map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgMode(bg.id)}
                      className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                      style={{
                        background: bgMode === bg.id ? "var(--accent)" : "var(--background)",
                        color: bgMode === bg.id ? "#fff" : "var(--foreground)",
                      }}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
                {(bgMode === "solid" || bgMode === "custom") && (
                  <div className="mt-2">
                    <ColorRow label="Color" value={bgColor} onChange={setBgColor} />
                  </div>
                )}
              </Section>

              {/* Divider */}
              <div className="h-px" style={{ background: "var(--border)" }} />

              {/* Batch info */}
              {sprites.length > 1 && (
                <Section title="Batch">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {sprites.length} sprites loaded. Effects apply to all sprites on export.
                  </p>
                </Section>
              )}

              {/* Add more / clear */}
              <div className="flex gap-2">
                <label
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Plus size={14} />
                  Add Sprites
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSprites([]);
                    setActiveIdx(0);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: "#ef4444" }}
                  aria-label="Clear all sprites"
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

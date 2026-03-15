"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Layers,
  Download,
  Copy,
  Check,
  Upload,
  ChevronDown,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PreviewMode = "source" | "normal" | "split" | "overlay";

interface Settings {
  strength: number;
  blur: number;
  invertX: boolean;
  invertY: boolean;
  grayscaleSource: boolean;
  previewMode: PreviewMode;
  tiling: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultSettings(): Settings {
  return {
    strength: 2,
    blur: 0,
    invertX: false,
    invertY: false,
    grayscaleSource: false,
    previewMode: "normal",
    tiling: false,
  };
}

// ---------------------------------------------------------------------------
// Sobel normal-map generation (pure Canvas API)
// ---------------------------------------------------------------------------

function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
  }
  return gray;
}

function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const r = Math.ceil(radius);
  const dst = new Float32Array(w * h);

  // Horizontal pass
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.min(w - 1, Math.max(0, x + dx));
        sum += src[y * w + nx];
        count++;
      }
      tmp[y * w + x] = sum / count;
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = Math.min(h - 1, Math.max(0, y + dy));
        sum += tmp[ny * w + x];
        count++;
      }
      dst[y * w + x] = sum / count;
    }
  }
  return dst;
}

function generateNormalMap(
  sourceData: ImageData,
  settings: Settings,
): ImageData {
  const { width: w, height: h } = sourceData;

  // Convert source to grayscale heightmap
  let gray: Float32Array;
  if (settings.grayscaleSource) {
    gray = toGrayscale(sourceData.data, w, h);
  } else {
    gray = toGrayscale(sourceData.data, w, h);
  }

  // Apply blur
  if (settings.blur > 0) {
    gray = boxBlur(gray, w, h, settings.blur);
  }

  const out = new ImageData(w, h);
  const strength = settings.strength;
  const invertXMul = settings.invertX ? -1 : 1;
  const invertYMul = settings.invertY ? -1 : 1;

  // Sobel kernels
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          // Wrap edges for seamless tiling
          const sx = (x + kx + w) % w;
          const sy = (y + ky + h) % h;
          const val = gray[sy * w + sx];

          gx += val * sobelX[ky + 1][kx + 1];
          gy += val * sobelY[ky + 1][kx + 1];
        }
      }

      // Apply strength and inversion
      let nx = -gx * strength * invertXMul;
      let ny = -gy * strength * invertYMul;
      let nz = 1.0;

      // Normalize
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      // Map from [-1,1] to [0,255]
      const idx = (y * w + x) * 4;
      out.data[idx] = Math.round((nx + 1) * 0.5 * 255);
      out.data[idx + 1] = Math.round((ny + 1) * 0.5 * 255);
      out.data[idx + 2] = Math.round((nz + 1) * 0.5 * 255);
      out.data[idx + 3] = 255;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

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
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
      >
        <span>{title}</span>
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
          {step < 1 ? value.toFixed(1) : value}
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NormalMapGeneratorPage() {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const normalCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...p }));
  }, []);

  // ---- Load source image ----

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSourceFileName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadImage(file);
    },
    [loadImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadImage(file);
    },
    [loadImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const clearImage = useCallback(() => {
    setSourceImage(null);
    setSourceFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ---- Generate normal map ----

  useEffect(() => {
    if (!sourceImage) return;

    const w = sourceImage.naturalWidth;
    const h = sourceImage.naturalHeight;

    // Draw source to hidden canvas
    const srcCanvas = sourceCanvasRef.current;
    if (!srcCanvas) return;
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext("2d")!;
    srcCtx.drawImage(sourceImage, 0, 0);

    // If grayscale source mode, convert the source canvas to grayscale visually
    if (settings.grayscaleSource) {
      const imgData = srcCtx.getImageData(0, 0, w, h);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const gray = Math.round(
          imgData.data[i] * 0.299 +
            imgData.data[i + 1] * 0.587 +
            imgData.data[i + 2] * 0.114,
        );
        imgData.data[i] = gray;
        imgData.data[i + 1] = gray;
        imgData.data[i + 2] = gray;
      }
      srcCtx.putImageData(imgData, 0, 0);
    }

    const sourceData = srcCtx.getImageData(0, 0, w, h);
    const normalData = generateNormalMap(sourceData, settings);

    // Draw normal map to hidden canvas
    const nrmCanvas = normalCanvasRef.current;
    if (!nrmCanvas) return;
    nrmCanvas.width = w;
    nrmCanvas.height = h;
    const nrmCtx = nrmCanvas.getContext("2d")!;
    nrmCtx.putImageData(normalData, 0, 0);

    // Draw preview
    const preview = previewCanvasRef.current;
    if (!preview) return;
    const previewCtx = preview.getContext("2d")!;

    if (settings.tiling) {
      // Tiled 2x2
      const tw = settings.previewMode === "split" ? w * 2 : w;
      const th = h;
      preview.width = tw * 2;
      preview.height = th * 2;

      const drawTile = (ox: number, oy: number) => {
        if (settings.previewMode === "source") {
          previewCtx.drawImage(srcCanvas, ox, oy);
        } else if (settings.previewMode === "normal") {
          previewCtx.drawImage(nrmCanvas, ox, oy);
        } else if (settings.previewMode === "split") {
          previewCtx.drawImage(srcCanvas, ox, oy);
          previewCtx.drawImage(nrmCanvas, ox + w, oy);
        } else if (settings.previewMode === "overlay") {
          previewCtx.drawImage(srcCanvas, ox, oy);
          previewCtx.globalAlpha = 0.5;
          previewCtx.drawImage(nrmCanvas, ox, oy);
          previewCtx.globalAlpha = 1;
        }
      };

      drawTile(0, 0);
      drawTile(tw, 0);
      drawTile(0, th);
      drawTile(tw, th);
    } else {
      if (settings.previewMode === "source") {
        preview.width = w;
        preview.height = h;
        previewCtx.drawImage(srcCanvas, 0, 0);
      } else if (settings.previewMode === "normal") {
        preview.width = w;
        preview.height = h;
        previewCtx.drawImage(nrmCanvas, 0, 0);
      } else if (settings.previewMode === "split") {
        preview.width = w * 2;
        preview.height = h;
        previewCtx.drawImage(srcCanvas, 0, 0);
        previewCtx.drawImage(nrmCanvas, w, 0);
        // Divider line
        previewCtx.strokeStyle = "rgba(255,255,255,0.4)";
        previewCtx.lineWidth = 2;
        previewCtx.beginPath();
        previewCtx.moveTo(w, 0);
        previewCtx.lineTo(w, h);
        previewCtx.stroke();
      } else if (settings.previewMode === "overlay") {
        preview.width = w;
        preview.height = h;
        previewCtx.drawImage(srcCanvas, 0, 0);
        previewCtx.globalAlpha = 0.5;
        previewCtx.drawImage(nrmCanvas, 0, 0);
        previewCtx.globalAlpha = 1;
      }
    }
  }, [sourceImage, settings]);

  // ---- Export ----

  const downloadPNG = useCallback(() => {
    const canvas = normalCanvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    const baseName = sourceFileName
      ? sourceFileName.replace(/\.[^.]+$/, "")
      : "texture";
    a.download = `${baseName}-normal.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [sourceFileName]);

  const copyToClipboard = useCallback(async () => {
    const canvas = normalCanvasRef.current;
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
    } catch {
      /* clipboard may not be available */
    }
  }, []);

  // ---- Render ----

  const PREVIEW_MODES: { value: PreviewMode; label: string }[] = [
    { value: "source", label: "Source" },
    { value: "normal", label: "Normal Map" },
    { value: "split", label: "Split" },
    { value: "overlay", label: "Overlay" },
  ];

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
            <h1 className="text-sm font-semibold">Normal Map Generator</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            disabled={!sourceImage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={downloadPNG}
            disabled={!sourceImage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download size={14} />
            PNG
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview area */}
        <div
          className={`flex-1 flex items-center justify-center bg-[var(--surface)] overflow-auto p-4 relative ${
            isDragOver ? "ring-2 ring-inset ring-[var(--accent)]" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {/* Hidden canvases for computation */}
          <canvas ref={sourceCanvasRef} style={{ display: "none" }} />
          <canvas ref={normalCanvasRef} style={{ display: "none" }} />

          {sourceImage ? (
            <div className="relative border border-[var(--border)] rounded-lg overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                className="block max-w-full max-h-[calc(100vh-8rem)]"
                style={{
                  imageRendering:
                    sourceImage.naturalWidth <= 256 ? "pixelated" : "auto",
                }}
              />
              {settings.tiling && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, var(--accent) 1px, transparent 1px),
                      linear-gradient(to bottom, var(--accent) 1px, transparent 1px)
                    `,
                    backgroundSize: "50% 50%",
                    backgroundPosition: "50% 50%",
                    opacity: 0.25,
                  }}
                />
              )}
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 p-1 rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 px-12 py-10 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <Upload
                size={32}
                className="text-[var(--muted)]"
              />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop a texture here or click to upload
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  PNG, JPG, WebP -- any diffuse or grayscale texture
                </p>
              </div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload texture image"
          />
        </div>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto">
          {/* Strength & Blur */}
          <Section title="Generation" defaultOpen={true}>
            <SliderRow
              label="Strength"
              value={settings.strength}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(v) => patch({ strength: v })}
            />
            <SliderRow
              label="Blur"
              value={settings.blur}
              min={0}
              max={5}
              step={0.1}
              suffix="px"
              onChange={(v) => patch({ blur: v })}
            />
          </Section>

          {/* Invert & Grayscale */}
          <Section title="Direction" defaultOpen={true}>
            <ToggleRow
              label="Invert X"
              value={settings.invertX}
              onChange={(v) => patch({ invertX: v })}
            />
            <ToggleRow
              label="Invert Y"
              value={settings.invertY}
              onChange={(v) => patch({ invertY: v })}
            />
            <ToggleRow
              label="Grayscale Source"
              value={settings.grayscaleSource}
              onChange={(v) => patch({ grayscaleSource: v })}
            />
          </Section>

          {/* Preview Mode */}
          <Section title="Preview" defaultOpen={true}>
            <div className="flex flex-col gap-1">
              <Label>Mode</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PREVIEW_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => patch({ previewMode: m.value })}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      settings.previewMode === m.value
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow
              label="Tile 2x2 Preview"
              value={settings.tiling}
              onChange={(v) => patch({ tiling: v })}
            />
          </Section>

          {/* Info */}
          {sourceImage && (
            <Section title="Image Info" defaultOpen={false}>
              <div className="flex flex-col gap-2 text-xs text-[var(--muted)]">
                <div className="flex justify-between">
                  <span>File</span>
                  <span className="truncate max-w-[140px] text-[var(--foreground)]">
                    {sourceFileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Size</span>
                  <span className="text-[var(--foreground)]">
                    {sourceImage.naturalWidth} x {sourceImage.naturalHeight}
                  </span>
                </div>
              </div>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

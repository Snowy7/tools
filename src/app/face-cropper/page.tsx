"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Circle,
  ClipboardCopy,
  Copy,
  Download,
  FlipHorizontal2,
  ImagePlus,
  RectangleHorizontal,
  RotateCcw,
  Square,
  Sun,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CropShape = "circle" | "square" | "rounded";

interface SizePreset {
  label: string;
  w: number;
  h: number;
}

interface ImageEntry {
  id: string;
  file: File;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: "100x100", w: 100, h: 100 },
  { label: "200x200", w: 200, h: 200 },
  { label: "400x400", w: 400, h: 400 },
  { label: "512x512", w: 512, h: 512 },
];

let _uid = 0;
function uid() {
  return `fc_${Date.now()}_${++_uid}`;
}

/* ------------------------------------------------------------------ */
/*  Canvas rendering helper                                            */
/* ------------------------------------------------------------------ */

function renderCrop(
  img: HTMLImageElement,
  outputW: number,
  outputH: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  flipH: boolean,
  brightness: number,
  contrast: number,
  shape: CropShape,
  bgColor: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outputW;
  canvas.height = outputH;
  const ctx = canvas.getContext("2d")!;

  /* Background */
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, outputW, outputH);

  /* Clip shape */
  ctx.save();
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(outputW / 2, outputH / 2, Math.min(outputW, outputH) / 2, 0, Math.PI * 2);
    ctx.clip();
  } else if (shape === "rounded") {
    const r = Math.min(outputW, outputH) * 0.15;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(outputW - r, 0);
    ctx.quadraticCurveTo(outputW, 0, outputW, r);
    ctx.lineTo(outputW, outputH - r);
    ctx.quadraticCurveTo(outputW, outputH, outputW - r, outputH);
    ctx.lineTo(r, outputH);
    ctx.quadraticCurveTo(0, outputH, 0, outputH - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();
  }

  /* Filter */
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  /* Flip */
  if (flipH) {
    ctx.translate(outputW, 0);
    ctx.scale(-1, 1);
  }

  /* Draw image: scale to fill output at current zoom, then apply offset */
  const scale = (Math.max(outputW / img.naturalWidth, outputH / img.naturalHeight)) * zoom;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const dx = (outputW - drawW) / 2 + offsetX;
  const dy = (outputH - drawH) / 2 + offsetY;

  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
  return canvas;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function FaceCropperPage() {
  /* State */
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [shape, setShape] = useState<CropShape>("circle");
  const [sizePresetIdx, setSizePresetIdx] = useState(1); // 200x200 default
  const [customW, setCustomW] = useState(256);
  const [customH, setCustomH] = useState(256);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startOffX: 0, startOffY: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const activeImage = images[activeIdx] || null;
  const outputW = isCustomSize ? customW : SIZE_PRESETS[sizePresetIdx].w;
  const outputH = isCustomSize ? customH : SIZE_PRESETS[sizePresetIdx].h;

  /* Load images into cache */
  const loadImage = useCallback((entry: ImageEntry): Promise<HTMLImageElement> => {
    if (imgCache.current.has(entry.id)) return Promise.resolve(imgCache.current.get(entry.id)!);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        imgCache.current.set(entry.id, img);
        resolve(img);
      };
      img.src = entry.url;
    });
  }, []);

  /* Render preview */
  const renderPreview = useCallback(async () => {
    if (!activeImage || !canvasRef.current) return;
    const img = await loadImage(activeImage);
    const previewSize = 320;
    const canvas = canvasRef.current;
    canvas.width = previewSize;
    canvas.height = previewSize;
    const ctx = canvas.getContext("2d")!;

    /* Checkerboard background */
    const tile = 12;
    for (let y = 0; y < previewSize; y += tile) {
      for (let x = 0; x < previewSize; x += tile) {
        ctx.fillStyle = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0 ? "#e0e0e0" : "#ffffff";
        ctx.fillRect(x, y, tile, tile);
      }
    }

    /* Render into temp canvas then draw scaled preview */
    const result = renderCrop(img, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor);
    ctx.drawImage(result, 0, 0, previewSize, previewSize);
  }, [activeImage, loadImage, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  /* File upload */
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const newEntries: ImageEntry[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.src = url;
        });
        const entry: ImageEntry = {
          id: uid(),
          file,
          url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        imgCache.current.set(entry.id, img);
        newEntries.push(entry);
      }
      setImages((prev) => {
        const updated = [...prev, ...newEntries];
        if (prev.length === 0 && newEntries.length > 0) setActiveIdx(0);
        return updated;
      });
    },
    [],
  );

  /* Drag to reposition */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!activeImage) return;
      setDragging(true);
      dragRef.current = { startX: e.clientX, startY: e.clientY, startOffX: offsetX, startOffY: offsetY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [activeImage, offsetX, offsetY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      /* Scale factor: preview is 320px, output varies */
      const scale = outputW / 320;
      setOffsetX(dragRef.current.startOffX + dx * scale);
      setOffsetY(dragRef.current.startOffY + dy * scale);
    },
    [dragging, outputW],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  /* Export */
  const exportPNG = useCallback(async () => {
    if (!activeImage) return;
    const img = await loadImage(activeImage);
    const result = renderCrop(img, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor);
    const link = document.createElement("a");
    link.download = `cropped-${outputW}x${outputH}.png`;
    link.href = result.toDataURL("image/png");
    link.click();
  }, [activeImage, loadImage, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor]);

  /* Batch export */
  const exportBatch = useCallback(async () => {
    for (let i = 0; i < images.length; i++) {
      const entry = images[i];
      const img = await loadImage(entry);
      const result = renderCrop(img, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor);
      const link = document.createElement("a");
      link.download = `cropped-${i + 1}-${outputW}x${outputH}.png`;
      link.href = result.toDataURL("image/png");
      link.click();
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [images, loadImage, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor]);

  /* Copy to clipboard */
  const copyToClipboard = useCallback(async () => {
    if (!activeImage) return;
    const img = await loadImage(activeImage);
    const result = renderCrop(img, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor);
    result.toBlob(async (blob) => {
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, "image/png");
  }, [activeImage, loadImage, outputW, outputH, zoom, offsetX, offsetY, flipH, brightness, contrast, shape, bgColor]);

  /* Reset adjustments */
  const resetAdjustments = useCallback(() => {
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setFlipH(false);
    setBrightness(100);
    setContrast(100);
  }, []);

  /* Remove image */
  const removeImage = useCallback(
    (idx: number) => {
      setImages((prev) => {
        const updated = prev.filter((_, i) => i !== idx);
        if (activeIdx >= updated.length) setActiveIdx(Math.max(0, updated.length - 1));
        return updated;
      });
    },
    [activeIdx],
  );

  /* Drop zone */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  /* Styles */
  const btnStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const btnPrimary: React.CSSProperties = {
    ...btnStyle,
    background: "var(--accent)",
    border: "1px solid var(--accent)",
    color: "#fff",
  };

  const sliderRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--muted)",
    marginBottom: 6,
  };

  const shapeBtn = (s: CropShape, icon: React.ReactNode, label: string) => (
    <button
      style={{
        ...btnStyle,
        background: shape === s ? "var(--accent)" : "var(--surface)",
        color: shape === s ? "#fff" : "var(--foreground)",
        border: shape === s ? "1px solid var(--accent)" : "1px solid var(--border)",
        flex: 1,
        justifyContent: "center",
      }}
      onClick={() => setShape(s)}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <Link
          href="/"
          className="flex items-center justify-center rounded-md"
          style={{
            width: 32,
            height: 32,
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
          title="Back"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <ImagePlus size={16} style={{ color: "var(--accent)" }} />
          <h1 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Face Cropper
          </h1>
        </div>
        <div className="flex-1" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button style={btnStyle} onClick={() => fileInputRef.current?.click()}>
          <ImagePlus size={14} /> Add Photos
        </button>
        {images.length > 1 && (
          <button style={btnPrimary} onClick={exportBatch}>
            <Download size={14} /> Export All ({images.length})
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Preview Area */}
        <div
          className="flex-1 flex flex-col items-center justify-center overflow-auto"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {!activeImage ? (
            <div
              className="flex flex-col items-center gap-3 p-12 rounded-xl cursor-pointer"
              style={{
                border: "2px dashed var(--border)",
                color: "var(--muted)",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={40} strokeWidth={1.2} />
              <span className="text-sm font-medium">Drop images here or click to upload</span>
              <span className="text-xs">Supports JPG, PNG, WebP</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-4">
              {/* Canvas preview */}
              <div
                className="relative"
                style={{ width: 320, height: 320, cursor: dragging ? "grabbing" : "grab" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <canvas ref={canvasRef} width={320} height={320} className="rounded-lg" style={{ width: 320, height: 320 }} />
              </div>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Drag to reposition | Output: {outputW}x{outputH}px
              </span>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button style={btnPrimary} onClick={exportPNG}>
                  <Download size={14} /> Export PNG
                </button>
                <button style={btnStyle} onClick={copyToClipboard}>
                  {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button style={btnStyle} onClick={resetAdjustments} title="Reset adjustments">
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Batch strip */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 mt-2 overflow-x-auto max-w-full pb-1">
                  {images.map((entry, idx) => (
                    <div key={entry.id} className="relative shrink-0 group">
                      <button
                        className="rounded-md overflow-hidden"
                        style={{
                          width: 48,
                          height: 48,
                          border: idx === activeIdx ? "2px solid var(--accent)" : "2px solid var(--border)",
                          cursor: "pointer",
                          padding: 0,
                          background: "var(--surface)",
                        }}
                        onClick={() => {
                          setActiveIdx(idx);
                          resetAdjustments();
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={entry.url} alt="" className="w-full h-full object-cover" />
                      </button>
                      <button
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ background: "var(--foreground)", color: "var(--background)" }}
                        onClick={() => removeImage(idx)}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div
          className="w-[280px] shrink-0 flex flex-col overflow-auto"
          style={{ borderLeft: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="p-4 flex flex-col gap-5">
            {/* Shape */}
            <div>
              <div style={labelStyle}>Shape</div>
              <div className="flex gap-2">
                {shapeBtn("circle", <Circle size={14} />, "Circle")}
                {shapeBtn("square", <Square size={14} />, "Square")}
                {shapeBtn("rounded", <RectangleHorizontal size={14} />, "Rounded")}
              </div>
            </div>

            {/* Size */}
            <div>
              <div style={labelStyle}>Output Size</div>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    style={{
                      ...btnStyle,
                      padding: "4px 10px",
                      fontSize: 12,
                      background: !isCustomSize && sizePresetIdx === i ? "var(--accent)" : "var(--surface)",
                      color: !isCustomSize && sizePresetIdx === i ? "#fff" : "var(--foreground)",
                      border: !isCustomSize && sizePresetIdx === i ? "1px solid var(--accent)" : "1px solid var(--border)",
                    }}
                    onClick={() => {
                      setSizePresetIdx(i);
                      setIsCustomSize(false);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  style={{
                    ...btnStyle,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: isCustomSize ? "var(--accent)" : "var(--surface)",
                    color: isCustomSize ? "#fff" : "var(--foreground)",
                    border: isCustomSize ? "1px solid var(--accent)" : "1px solid var(--border)",
                  }}
                  onClick={() => setIsCustomSize(true)}
                >
                  Custom
                </button>
              </div>
              {isCustomSize && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={16}
                    max={4096}
                    value={customW}
                    onChange={(e) => setCustomW(Math.max(16, parseInt(e.target.value) || 16))}
                    className="w-20 rounded-md px-2 py-1 text-sm outline-none"
                    style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>x</span>
                  <input
                    type="number"
                    min={16}
                    max={4096}
                    value={customH}
                    onChange={(e) => setCustomH(Math.max(16, parseInt(e.target.value) || 16))}
                    className="w-20 rounded-md px-2 py-1 text-sm outline-none"
                    style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>px</span>
                </div>
              )}
            </div>

            {/* Zoom */}
            <div>
              <div style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <ZoomIn size={12} /> Zoom: {zoom.toFixed(1)}x
                </span>
              </div>
              <div style={sliderRow}>
                <span className="text-xs" style={{ color: "var(--muted)" }}>0.5</span>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>5.0</span>
              </div>
            </div>

            {/* Flip */}
            <div>
              <button
                style={{
                  ...btnStyle,
                  width: "100%",
                  justifyContent: "center",
                  background: flipH ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--surface)",
                }}
                onClick={() => setFlipH(!flipH)}
              >
                <FlipHorizontal2 size={14} /> Flip Horizontal {flipH ? "(On)" : ""}
              </button>
            </div>

            {/* Brightness */}
            <div>
              <div style={labelStyle}>
                <span className="flex items-center gap-1.5">
                  <Sun size={12} /> Brightness: {brightness}%
                </span>
              </div>
              <div style={sliderRow}>
                <span className="text-xs" style={{ color: "var(--muted)" }}>50</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>150</span>
              </div>
            </div>

            {/* Contrast */}
            <div>
              <div style={labelStyle}>Contrast: {contrast}%</div>
              <div style={sliderRow}>
                <span className="text-xs" style={{ color: "var(--muted)" }}>50</span>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>150</span>
              </div>
            </div>

            {/* Background Color */}
            <div>
              <div style={labelStyle}>Background Color</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                  style={{ background: "transparent" }}
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 rounded-md px-2 py-1.5 text-sm outline-none font-mono"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Visible behind non-circular crops and transparent areas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

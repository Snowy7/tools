"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Droplets,
  Upload,
  Download,
  Trash2,
  Type,
  Image as ImageIcon,
  RotateCw,
  Plus,
  X,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type WatermarkMode = "text" | "image";
type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "tiled";

interface PhotoEntry {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

interface TextWatermark {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
}

interface ImageWatermark {
  image: HTMLImageElement | null;
  url: string | null;
  scale: number;
  opacity: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FONTS = ["Arial", "Helvetica", "Georgia", "Impact", "Courier New", "system-ui"];

const POSITIONS: { value: Position; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "top-left", label: "Top Left" },
  { value: "top-right", label: "Top Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
  { value: "tiled", label: "Tiled" },
];

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WatermarkToolPage() {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [mode, setMode] = useState<WatermarkMode>("text");
  const [position, setPosition] = useState<Position>("bottom-right");
  const [tileSpacing, setTileSpacing] = useState(120);

  const [textWm, setTextWm] = useState<TextWatermark>({
    text: "Watermark",
    fontFamily: "Arial",
    fontSize: 48,
    color: "#ffffff",
    opacity: 40,
    rotation: -30,
  });

  const [imgWm, setImgWm] = useState<ImageWatermark>({
    image: null,
    url: null,
    scale: 20,
    opacity: 40,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currentPhoto = photos[selectedPhotoIdx] ?? null;

  // ── Upload photos ──────────────────────────────────────────────────────────

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const entry: PhotoEntry = { id: uid(), file, url, width: img.width, height: img.height };
        setPhotos((prev) => [...prev, entry]);
      };
      img.src = url;
    }
    e.target.value = "";
  }, []);

  const removePhoto = useCallback(
    (id: string) => {
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (selectedPhotoIdx >= next.length) setSelectedPhotoIdx(Math.max(0, next.length - 1));
        return next;
      });
    },
    [selectedPhotoIdx]
  );

  // ── Upload logo ────────────────────────────────────────────────────────────

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgWm((prev) => ({ ...prev, image: img, url }));
    };
    img.src = url;
    e.target.value = "";
  }, []);

  // ── Draw preview ───────────────────────────────────────────────────────────

  const drawWatermarked = useCallback(
    (photo: PhotoEntry, exportMode = false): HTMLCanvasElement | null => {
      const cvs = exportMode ? document.createElement("canvas") : canvasRef.current;
      if (!cvs) return null;
      const ctx = cvs.getContext("2d")!;
      cvs.width = photo.width;
      cvs.height = photo.height;

      // Draw original
      const srcImg = new Image();
      srcImg.src = photo.url;
      ctx.drawImage(srcImg, 0, 0, photo.width, photo.height);

      // Apply watermark
      if (mode === "text") {
        drawTextWatermark(ctx, photo.width, photo.height);
      } else if (imgWm.image) {
        drawImageWatermark(ctx, photo.width, photo.height);
      }

      return cvs;
    },
    [mode, textWm, imgWm, position, tileSpacing]
  );

  const drawTextWatermark = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.globalAlpha = textWm.opacity / 100;
      ctx.font = `${textWm.fontSize}px "${textWm.fontFamily}"`;
      ctx.fillStyle = textWm.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (position === "tiled") {
        const spacing = tileSpacing + textWm.fontSize;
        for (let y = -h * 0.5; y < h * 1.5; y += spacing) {
          for (let x = -w * 0.5; x < w * 1.5; x += spacing + ctx.measureText(textWm.text).width * 0.5) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((textWm.rotation * Math.PI) / 180);
            ctx.fillText(textWm.text, 0, 0);
            ctx.restore();
          }
        }
      } else {
        const { x, y } = getPositionCoords(w, h, textWm.fontSize * 2, textWm.fontSize);
        ctx.translate(x, y);
        ctx.rotate((textWm.rotation * Math.PI) / 180);
        ctx.fillText(textWm.text, 0, 0);
      }
      ctx.restore();
    },
    [textWm, position, tileSpacing]
  );

  const drawImageWatermark = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (!imgWm.image) return;
      ctx.save();
      ctx.globalAlpha = imgWm.opacity / 100;
      const logoW = w * (imgWm.scale / 100);
      const logoH = (imgWm.image.height / imgWm.image.width) * logoW;

      if (position === "tiled") {
        const spacingX = logoW + tileSpacing;
        const spacingY = logoH + tileSpacing;
        for (let y = -logoH; y < h + logoH; y += spacingY) {
          for (let x = -logoW; x < w + logoW; x += spacingX) {
            ctx.drawImage(imgWm.image, x, y, logoW, logoH);
          }
        }
      } else {
        const { x, y } = getPositionCoords(w, h, logoW, logoH);
        ctx.drawImage(imgWm.image, x - logoW / 2, y - logoH / 2, logoW, logoH);
      }
      ctx.restore();
    },
    [imgWm, position, tileSpacing]
  );

  const getPositionCoords = (w: number, h: number, elW: number, elH: number) => {
    const pad = Math.min(w, h) * 0.05;
    switch (position) {
      case "center":
        return { x: w / 2, y: h / 2 };
      case "top-left":
        return { x: pad + elW / 2, y: pad + elH / 2 };
      case "top-right":
        return { x: w - pad - elW / 2, y: pad + elH / 2 };
      case "bottom-left":
        return { x: pad + elW / 2, y: h - pad - elH / 2 };
      case "bottom-right":
        return { x: w - pad - elW / 2, y: h - pad - elH / 2 };
      default:
        return { x: w / 2, y: h / 2 };
    }
  };

  // Preview redraw
  useEffect(() => {
    if (!currentPhoto) return;
    // Ensure source image is loaded before drawing
    const img = new Image();
    img.onload = () => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d")!;
      cvs.width = currentPhoto.width;
      cvs.height = currentPhoto.height;
      ctx.drawImage(img, 0, 0, currentPhoto.width, currentPhoto.height);

      if (mode === "text") {
        drawTextWatermark(ctx, currentPhoto.width, currentPhoto.height);
      } else if (imgWm.image) {
        drawImageWatermark(ctx, currentPhoto.width, currentPhoto.height);
      }
    };
    img.src = currentPhoto.url;
  }, [currentPhoto, mode, textWm, imgWm, position, tileSpacing, drawTextWatermark, drawImageWatermark]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportCurrent = useCallback(() => {
    if (!currentPhoto) return;
    const img = new Image();
    img.onload = () => {
      const cvs = document.createElement("canvas");
      cvs.width = currentPhoto.width;
      cvs.height = currentPhoto.height;
      const ctx = cvs.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      if (mode === "text") drawTextWatermark(ctx, currentPhoto.width, currentPhoto.height);
      else if (imgWm.image) drawImageWatermark(ctx, currentPhoto.width, currentPhoto.height);

      const link = document.createElement("a");
      link.download = `watermarked-${currentPhoto.file.name}`;
      link.href = cvs.toDataURL("image/png");
      link.click();
    };
    img.src = currentPhoto.url;
  }, [currentPhoto, mode, drawTextWatermark, drawImageWatermark, imgWm.image]);

  const exportAll = useCallback(() => {
    for (const photo of photos) {
      const img = new Image();
      img.onload = () => {
        const cvs = document.createElement("canvas");
        cvs.width = photo.width;
        cvs.height = photo.height;
        const ctx = cvs.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        if (mode === "text") drawTextWatermark(ctx, photo.width, photo.height);
        else if (imgWm.image) drawImageWatermark(ctx, photo.width, photo.height);

        const link = document.createElement("a");
        link.download = `watermarked-${photo.file.name}`;
        link.href = cvs.toDataURL("image/png");
        link.click();
      };
      img.src = photo.url;
    }
  }, [photos, mode, drawTextWatermark, drawImageWatermark, imgWm.image]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link href="/" className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" aria-label="Back to home">
          <ArrowLeft size={20} />
        </Link>
        <Droplets size={20} className="text-[var(--accent)]" />
        <h1 className="text-base font-semibold">Watermark Tool</h1>
        <div className="ml-auto flex items-center gap-2">
          {photos.length > 1 && (
            <button
              onClick={exportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Download size={14} />
              Export All ({photos.length})
            </button>
          )}
          {currentPhoto && (
            <button
              onClick={exportCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Download size={14} />
              Export
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto p-4 space-y-5">
          {/* Upload photos */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Photos</h2>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={14} />
              Add Photos
            </button>
            {photos.length > 0 && (
              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                {photos.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPhotoIdx(i)}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
                      i === selectedPhotoIdx
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <ImageIcon size={12} className="shrink-0" />
                    <span className="truncate flex-1">{p.file.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(p.id);
                      }}
                      className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Mode toggle */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Watermark Type</h2>
            <div className="flex gap-1.5">
              <button
                onClick={() => setMode("text")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  mode === "text" ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <Type size={14} /> Text
              </button>
              <button
                onClick={() => setMode("image")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  mode === "image" ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <ImageIcon size={14} /> Image
              </button>
            </div>
          </section>

          {/* Text watermark controls */}
          {mode === "text" && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Text Settings</h2>
              <input
                type="text"
                value={textWm.text}
                onChange={(e) => setTextWm((p) => ({ ...p, text: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="Watermark text..."
              />
              <select
                value={textWm.fontFamily}
                onChange={(e) => setTextWm((p) => ({ ...p, fontFamily: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-between text-xs">
                <span>Size</span>
                <span className="text-[var(--muted)]">{textWm.fontSize}px</span>
              </label>
              <input
                type="range"
                min={12}
                max={200}
                value={textWm.fontSize}
                onChange={(e) => setTextWm((p) => ({ ...p, fontSize: Number(e.target.value) }))}
                className="w-full accent-[var(--accent)]"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs flex-1">Color</label>
                <input
                  type="color"
                  value={textWm.color}
                  onChange={(e) => setTextWm((p) => ({ ...p, color: e.target.value }))}
                  className="w-8 h-6 rounded border border-[var(--border)] cursor-pointer"
                />
              </div>
              <label className="flex items-center justify-between text-xs">
                <span>Opacity</span>
                <span className="text-[var(--muted)]">{textWm.opacity}%</span>
              </label>
              <input
                type="range"
                min={5}
                max={100}
                value={textWm.opacity}
                onChange={(e) => setTextWm((p) => ({ ...p, opacity: Number(e.target.value) }))}
                className="w-full accent-[var(--accent)]"
              />
              <label className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <RotateCw size={12} /> Rotation
                </span>
                <span className="text-[var(--muted)]">{textWm.rotation}&deg;</span>
              </label>
              <input
                type="range"
                min={-180}
                max={180}
                value={textWm.rotation}
                onChange={(e) => setTextWm((p) => ({ ...p, rotation: Number(e.target.value) }))}
                className="w-full accent-[var(--accent)]"
              />
            </section>
          )}

          {/* Image watermark controls */}
          {mode === "image" && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Logo Settings</h2>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <button
                onClick={() => logoInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Upload size={14} />
                {imgWm.image ? "Replace Logo" : "Upload Logo"}
              </button>
              {imgWm.url && (
                <div className="flex justify-center p-2 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  <img src={imgWm.url} alt="Logo preview" className="max-h-16 object-contain" />
                </div>
              )}
              <label className="flex items-center justify-between text-xs">
                <span>Scale</span>
                <span className="text-[var(--muted)]">{imgWm.scale}%</span>
              </label>
              <input
                type="range"
                min={2}
                max={80}
                value={imgWm.scale}
                onChange={(e) => setImgWm((p) => ({ ...p, scale: Number(e.target.value) }))}
                className="w-full accent-[var(--accent)]"
              />
              <label className="flex items-center justify-between text-xs">
                <span>Opacity</span>
                <span className="text-[var(--muted)]">{imgWm.opacity}%</span>
              </label>
              <input
                type="range"
                min={5}
                max={100}
                value={imgWm.opacity}
                onChange={(e) => setImgWm((p) => ({ ...p, opacity: Number(e.target.value) }))}
                className="w-full accent-[var(--accent)]"
              />
            </section>
          )}

          {/* Position */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Position</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPosition(p.value)}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                    position === p.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {position === "tiled" && (
              <>
                <label className="flex items-center justify-between text-xs mt-3">
                  <span>Spacing</span>
                  <span className="text-[var(--muted)]">{tileSpacing}px</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={400}
                  value={tileSpacing}
                  onChange={(e) => setTileSpacing(Number(e.target.value))}
                  className="w-full mt-1 accent-[var(--accent)]"
                />
              </>
            )}
          </section>
        </aside>

        {/* ── Canvas area ──────────────────────────────────────────────────── */}
        <main className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[var(--background)]">
          {currentPhoto ? (
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[calc(100vh-80px)] rounded-lg shadow-lg border border-[var(--border)] object-contain"
            />
          ) : (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto">
                <Droplets size={32} className="text-[var(--muted)]" />
              </div>
              <div>
                <p className="text-sm font-medium">No photos loaded</p>
                <p className="text-xs text-[var(--muted)] mt-1">Upload images to add watermarks</p>
              </div>
              <button
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Upload size={16} />
                Upload Photos
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface DetectedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  autoLabel: string;
  userLabel: string;
  croppedImage: string;
}

interface ImageExtractorProps {
  onExtract: (glyphs: { char: string; imageData: string }[]) => void;
  onClose: () => void;
}

export default function ImageExtractor({ onExtract, onClose }: ImageExtractorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [minSize, setMinSize] = useState(10);
  const [regions, setRegions] = useState<DetectedRegion[]>([]);
  const [step, setStep] = useState<"upload" | "configure" | "review">("upload");
  const [isProcessing, setIsProcessing] = useState(false);

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scaleRef = useRef(1);

  // Load image stably — store as data URL and use an Image object
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageSrc(dataUrl);
      setStep("configure");
    };
    reader.readAsDataURL(file);
  }, []);

  // When imageSrc changes, create the image element
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawImageToOverlay();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  function drawImageToOverlay() {
    const img = imageRef.current;
    const canvas = overlayCanvasRef.current;
    if (!img || !canvas) return;

    const maxW = 700;
    const scale = Math.min(1, maxW / img.width);
    scaleRef.current = scale;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  // Draw overlay with bounding boxes
  function drawOverlayBoxes(rects: DetectedRegion[]) {
    const img = imageRef.current;
    const canvas = overlayCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d")!;
    drawImageToOverlay();

    ctx.lineWidth = 2;
    ctx.font = "bold 11px system-ui";

    rects.forEach((r, i) => {
      const hasLabel = r.userLabel || r.autoLabel;
      ctx.strokeStyle = hasLabel ? "#22c55e" : "#3b82f6";
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      // Label badge
      const label = r.userLabel || r.autoLabel || `#${i + 1}`;
      const textW = ctx.measureText(label).width + 6;
      ctx.fillStyle = hasLabel ? "#22c55e" : "#3b82f6";
      ctx.fillRect(r.x, r.y - 16, textW, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, r.x + 3, r.y - 4);
    });
  }

  const detectRegions = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setIsProcessing(true);

    // Use offscreen canvas for detection
    const work = workCanvasRef.current || document.createElement("canvas");
    const scale = scaleRef.current;
    work.width = img.width * scale;
    work.height = img.height * scale;
    const ctx = work.getContext("2d")!;
    ctx.drawImage(img, 0, 0, work.width, work.height);

    const imgData = ctx.getImageData(0, 0, work.width, work.height);
    const { width, height, data } = imgData;

    // Binarize
    const binary: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      binary[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const avg = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        binary[y][x] = avg < threshold;
      }
    }

    // Connected component labeling (flood fill)
    const labels = new Int32Array(width * height);
    let nextLabel = 1;
    const bounds: Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }> = new Map();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!binary[y][x] || labels[y * width + x] !== 0) continue;

        const label = nextLabel++;
        const stack = [x, y];
        let bMinX = x, bMinY = y, bMaxX = x, bMaxY = y, area = 0;

        while (stack.length > 0) {
          const sy = stack.pop()!;
          const sx = stack.pop()!;
          const idx = sy * width + sx;
          if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
          if (!binary[sy][sx] || labels[idx] !== 0) continue;

          labels[idx] = label;
          area++;
          bMinX = Math.min(bMinX, sx);
          bMinY = Math.min(bMinY, sy);
          bMaxX = Math.max(bMaxX, sx);
          bMaxY = Math.max(bMaxY, sy);

          stack.push(sx + 1, sy);
          stack.push(sx - 1, sy);
          stack.push(sx, sy + 1);
          stack.push(sx, sy - 1);
        }

        bounds.set(label, { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY, area });
      }
    }

    // Filter by size
    const maxDim = Math.min(width, height) * 0.85;
    const filtered: { x: number; y: number; w: number; h: number }[] = [];

    for (const [, b] of bounds) {
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      if (w >= minSize && h >= minSize && w <= maxDim && h <= maxDim && b.area > minSize * minSize * 0.3) {
        filtered.push({
          x: Math.max(0, b.minX - 3),
          y: Math.max(0, b.minY - 3),
          w: Math.min(width - b.minX + 3, w + 6),
          h: Math.min(height - b.minY + 3, h + 6),
        });
      }
    }

    // Merge overlapping
    const merged = mergeOverlapping(filtered);

    // Sort top-to-bottom then left-to-right (row detection)
    merged.sort((a, b) => {
      const rowA = Math.floor(a.y / (height * 0.1));
      const rowB = Math.floor(b.y / (height * 0.1));
      if (rowA !== rowB) return rowA - rowB;
      return a.x - b.x;
    });

    // Auto-assign labels based on position
    const autoLabels = guessLabels(merged);

    // Crop each region
    const cropCanvas = document.createElement("canvas");
    const cropCtx = cropCanvas.getContext("2d")!;

    const detected: DetectedRegion[] = merged.map((r, i) => {
      const pad = 8;
      const cropSize = Math.max(r.w, r.h) + pad * 2;
      cropCanvas.width = cropSize;
      cropCanvas.height = cropSize;
      cropCtx.fillStyle = "#ffffff";
      cropCtx.fillRect(0, 0, cropSize, cropSize);

      const ox = (cropSize - r.w) / 2;
      const oy = (cropSize - r.h) / 2;
      cropCtx.drawImage(
        img,
        r.x / scale, r.y / scale, r.w / scale, r.h / scale,
        ox, oy, r.w, r.h
      );

      return {
        ...r,
        autoLabel: autoLabels[i] || "",
        userLabel: autoLabels[i] || "",
        croppedImage: cropCanvas.toDataURL("image/png"),
      };
    });

    setRegions(detected);
    drawOverlayBoxes(detected);
    setStep("review");
    setIsProcessing(false);
  }, [threshold, minSize]);

  function guessLabels(rects: { x: number; y: number; w: number; h: number }[]): string[] {
    // Simple auto-label: assign A-Z, a-z, 0-9 in reading order
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return rects.map((_, i) => (i < chars.length ? chars[i] : ""));
  }

  function mergeOverlapping(rects: { x: number; y: number; w: number; h: number }[]) {
    const merged = rects.map((r) => ({ ...r }));
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
          const a = merged[i];
          const b = merged[j];
          const gap = 3;
          if (
            a.x - gap < b.x + b.w && a.x + a.w + gap > b.x &&
            a.y - gap < b.y + b.h && a.y + a.h + gap > b.y
          ) {
            const nx = Math.min(a.x, b.x);
            const ny = Math.min(a.y, b.y);
            merged[i] = {
              x: nx, y: ny,
              w: Math.max(a.x + a.w, b.x + b.w) - nx,
              h: Math.max(a.y + a.h, b.y + b.h) - ny,
            };
            merged.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return merged;
  }

  function handleLabelChange(idx: number, value: string) {
    setRegions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], userLabel: value };
      return next;
    });
  }

  function handleRemoveRegion(idx: number) {
    setRegions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      drawOverlayBoxes(next);
      return next;
    });
  }

  // Redraw overlay when regions change
  useEffect(() => {
    if (step === "review" && regions.length > 0) {
      drawOverlayBoxes(regions);
    }
  }, [regions, step]);

  function handleExtract() {
    const glyphs = regions
      .filter((r) => r.userLabel.trim())
      .map((r) => ({
        char: r.userLabel.trim(),
        imageData: r.croppedImage,
      }));
    onExtract(glyphs);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold">Extract Glyphs from Image</h2>
            <p className="text-xs text-[var(--muted)]">
              {step === "upload" && "Upload an image containing letters or glyphs"}
              {step === "configure" && "Adjust detection settings, then detect"}
              {step === "review" && `${regions.length} regions detected — review and edit labels`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center gap-6 py-20">
              <div className="w-20 h-20 rounded-2xl bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="text-[var(--muted)] text-sm max-w-md text-center">
                Upload an image with handwritten or printed characters. The tool will automatically detect individual glyphs and let you assign letters.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] transition-colors font-medium"
              >
                Choose Image
              </button>
            </div>
          )}

          {step === "configure" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--muted)]">Threshold</label>
                  <input type="range" min={40} max={230} value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))} className="w-28 accent-[var(--accent)]" />
                  <span className="text-xs font-mono w-7">{threshold}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--muted)]">Min glyph size</label>
                  <input type="range" min={4} max={50} value={minSize}
                    onChange={(e) => setMinSize(Number(e.target.value))} className="w-20 accent-[var(--accent)]" />
                  <span className="text-xs font-mono w-5">{minSize}</span>
                </div>
                <button
                  onClick={detectRegions}
                  disabled={isProcessing}
                  className="ml-auto px-5 py-2 bg-[var(--accent)] text-white rounded-xl hover:bg-[var(--accent-hover)] text-sm font-medium disabled:opacity-50"
                >
                  {isProcessing ? "Detecting..." : "Detect Glyphs"}
                </button>
              </div>
              <div className="border border-[var(--border)] rounded-xl overflow-auto max-h-[60vh] bg-white">
                <canvas ref={overlayCanvasRef} className="max-w-full" />
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-4">
              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setStep("configure"); setRegions([]); }}
                  className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
                >
                  Re-detect
                </button>
                <div className="flex-1" />
                <span className="text-xs text-[var(--muted)]">
                  {regions.filter((r) => r.userLabel.trim()).length} labeled
                </span>
              </div>

              {/* Preview with bounding boxes */}
              <div className="border border-[var(--border)] rounded-xl overflow-auto max-h-[35vh] bg-white">
                <canvas ref={overlayCanvasRef} className="max-w-full" />
              </div>

              {/* Region cards */}
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[30vh] overflow-auto p-1">
                {regions.map((region, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-1 p-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] group relative"
                  >
                    <button
                      onClick={() => handleRemoveRegion(idx)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                    <img
                      src={region.croppedImage}
                      alt={`Region ${idx + 1}`}
                      className="w-10 h-10 object-contain rounded bg-white"
                    />
                    <input
                      type="text"
                      maxLength={1}
                      value={region.userLabel}
                      onChange={(e) => handleLabelChange(idx, e.target.value)}
                      className="w-7 h-5 text-center text-[11px] border border-[var(--border)] rounded bg-[var(--surface)] focus:border-[var(--accent)] outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden work canvas */}
        <canvas ref={workCanvasRef} className="hidden" />

        {/* Footer */}
        {step === "review" && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleExtract}
              disabled={regions.filter((r) => r.userLabel.trim()).length === 0}
              className="px-5 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 font-medium"
            >
              Import {regions.filter((r) => r.userLabel.trim()).length} Glyphs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

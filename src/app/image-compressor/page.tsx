"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ImageDown,
  Upload,
  Download,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutputFormat = "png" | "jpeg" | "webp" | "avif";

interface ImageEntry {
  id: string;
  file: File;
  originalUrl: string;
  originalSize: number;
  format: OutputFormat;
  quality: number;
  maxDimension: string;
  compressedBlob: Blob | null;
  compressedUrl: string | null;
  compressedSize: number;
  compressing: boolean;
  avifUnsupported: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function savingsPercent(original: number, compressed: number): string {
  if (original === 0 || compressed === 0) return "---";
  const pct = ((1 - compressed / original) * 100).toFixed(1);
  return Number(pct) > 0 ? `-${pct}%` : `+${Math.abs(Number(pct)).toFixed(1)}%`;
}

function mimeForFormat(format: OutputFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
  }
}

function extensionForFormat(format: OutputFormat): string {
  switch (format) {
    case "png":
      return ".png";
    case "jpeg":
      return ".jpg";
    case "webp":
      return ".webp";
    case "avif":
      return ".avif";
  }
}

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

// ---------------------------------------------------------------------------
// Compression via Canvas API
// ---------------------------------------------------------------------------

function compressImage(
  file: File,
  format: OutputFormat,
  quality: number,
  maxDimension: number | null,
): Promise<{ blob: Blob; avifUnsupported: boolean }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (maxDimension && maxDimension > 0) {
        const longest = Math.max(w, h);
        if (longest > maxDimension) {
          const scale = maxDimension / longest;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      // For JPEG, fill white background (no transparency)
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      const mime = mimeForFormat(format);
      const q = format === "png" ? undefined : quality / 100;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // AVIF may not be supported
            if (format === "avif") {
              resolve({ blob: new Blob(), avifUnsupported: true });
            } else {
              reject(new Error("Compression failed"));
            }
            return;
          }
          // Check if browser returned a different type (AVIF fallback to PNG)
          const avifUnsupported =
            format === "avif" && blob.type !== "image/avif";
          resolve({ blob, avifUnsupported });
        },
        mime,
        q,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebounceCallback(delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (fn: () => void) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fn, delay);
    },
    [delay],
  );
}

// ---------------------------------------------------------------------------
// Format button group
// ---------------------------------------------------------------------------

const formats: OutputFormat[] = ["png", "jpeg", "webp", "avif"];

function FormatSelector({
  value,
  onChange,
}: {
  value: OutputFormat;
  onChange: (f: OutputFormat) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-[var(--background)] rounded-lg p-0.5">
      {formats.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            value === f
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ImageCompressorPage() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useDebounceCallback(300);

  // Batch controls
  const [batchFormat, setBatchFormat] = useState<OutputFormat>("webp");
  const [batchQuality, setBatchQuality] = useState(80);
  const [batchMaxDim, setBatchMaxDim] = useState("");

  // ---------------------------------------------------------------------------
  // Compress a single entry
  // ---------------------------------------------------------------------------
  const compressEntry = useCallback(
    (entry: ImageEntry, list: ImageEntry[]): ImageEntry[] => {
      // Mark as compressing
      const updated = list.map((e) =>
        e.id === entry.id ? { ...e, compressing: true } : e,
      );

      const maxDim = entry.maxDimension ? parseInt(entry.maxDimension, 10) : null;

      compressImage(entry.file, entry.format, entry.quality, maxDim).then(
        ({ blob, avifUnsupported }) => {
          setImages((prev) =>
            prev.map((e) => {
              if (e.id !== entry.id) return e;
              const url = blob.size > 0 ? URL.createObjectURL(blob) : null;
              return {
                ...e,
                compressedBlob: blob.size > 0 ? blob : null,
                compressedUrl: url,
                compressedSize: blob.size,
                compressing: false,
                avifUnsupported,
              };
            }),
          );
        },
        () => {
          setImages((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, compressing: false } : e,
            ),
          );
        },
      );

      return updated;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Add files
  // ---------------------------------------------------------------------------
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newEntries: ImageEntry[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        newEntries.push({
          id: uid(),
          file,
          originalUrl: URL.createObjectURL(file),
          originalSize: file.size,
          format: "webp",
          quality: 80,
          maxDimension: "",
          compressedBlob: null,
          compressedUrl: null,
          compressedSize: 0,
          compressing: false,
          avifUnsupported: false,
        });
      }
      if (newEntries.length === 0) return;

      setImages((prev) => {
        const combined = [...prev, ...newEntries];
        // Kick off compression for each new entry
        for (const entry of newEntries) {
          compressEntry(entry, combined);
        }
        return combined;
      });
    },
    [compressEntry],
  );

  // ---------------------------------------------------------------------------
  // Update a single image's settings
  // ---------------------------------------------------------------------------
  const updateEntry = useCallback(
    (id: string, patch: Partial<Pick<ImageEntry, "format" | "quality" | "maxDimension">>) => {
      setImages((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
        const entry = next.find((e) => e.id === id);
        if (entry) {
          debounce(() => {
            compressEntry(entry, next);
          });
        }
        return next;
      });
    },
    [compressEntry, debounce],
  );

  // ---------------------------------------------------------------------------
  // Remove / clear
  // ---------------------------------------------------------------------------
  const removeEntry = useCallback((id: string) => {
    setImages((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) {
        URL.revokeObjectURL(entry.originalUrl);
        if (entry.compressedUrl) URL.revokeObjectURL(entry.compressedUrl);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setImages((prev) => {
      for (const e of prev) {
        URL.revokeObjectURL(e.originalUrl);
        if (e.compressedUrl) URL.revokeObjectURL(e.compressedUrl);
      }
      return [];
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Apply batch settings
  // ---------------------------------------------------------------------------
  const applyToAll = useCallback(() => {
    setImages((prev) => {
      const next = prev.map((e) => ({
        ...e,
        format: batchFormat,
        quality: batchQuality,
        maxDimension: batchMaxDim,
      }));
      for (const entry of next) {
        compressEntry(entry, next);
      }
      return next;
    });
  }, [batchFormat, batchQuality, batchMaxDim, compressEntry]);

  // ---------------------------------------------------------------------------
  // Download helpers
  // ---------------------------------------------------------------------------
  const downloadOne = useCallback((entry: ImageEntry) => {
    if (!entry.compressedBlob || !entry.compressedUrl) return;
    const a = document.createElement("a");
    a.href = entry.compressedUrl;
    a.download = baseName(entry.file.name) + extensionForFormat(entry.format);
    a.click();
  }, []);

  const downloadAll = useCallback(() => {
    for (const entry of images) {
      if (entry.compressedBlob && entry.compressedUrl) {
        downloadOne(entry);
      }
    }
  }, [images, downloadOne]);

  // ---------------------------------------------------------------------------
  // Drag and drop
  // ---------------------------------------------------------------------------
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup URLs on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      for (const e of images) {
        URL.revokeObjectURL(e.originalUrl);
        if (e.compressedUrl) URL.revokeObjectURL(e.compressedUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const hasImages = images.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link
          href="/"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft size={20} />
        </Link>
        <ImageDown size={20} className="text-[var(--accent)]" />
        <h1 className="text-base font-semibold">Image Compressor</h1>

        {hasImages && (
          <>
            <div className="flex-1" />
            <button
              type="button"
              onClick={downloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Download size={14} />
              Download All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          </>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Content */}
      <div
        className="flex-1 overflow-hidden flex flex-col"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {!hasImages ? (
          /* Empty state: drop zone */
          <div className="flex-1 flex items-center justify-center p-4 md:p-8">
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
                  Drop images here or click to upload
                </p>
                <p className="text-xs text-[var(--muted)]">
                  PNG, JPG, WebP, AVIF -- batch upload supported
                </p>
              </div>
            </button>
          </div>
        ) : (
          <>
            {/* Batch toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 flex-wrap">
              <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide shrink-0">
                Apply to all
              </span>
              <FormatSelector value={batchFormat} onChange={setBatchFormat} />
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-[var(--muted)]">Quality</label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={batchQuality}
                  onChange={(e) => setBatchQuality(Number(e.target.value))}
                  className="w-24 accent-[var(--accent)]"
                  disabled={batchFormat === "png"}
                />
                <span className="text-xs tabular-nums w-8 text-right">
                  {batchFormat === "png" ? "---" : batchQuality}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-[var(--muted)]">Max px</label>
                <input
                  type="number"
                  value={batchMaxDim}
                  onChange={(e) => setBatchMaxDim(e.target.value)}
                  placeholder="Auto"
                  className="w-20 text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <button
                type="button"
                onClick={applyToAll}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors shrink-0"
              >
                Apply
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
              >
                <Upload size={13} />
                Add More
              </button>
            </div>

            {/* Image cards grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
                {images.map((entry) => (
                  <ImageCard
                    key={entry.id}
                    entry={entry}
                    onUpdate={(patch) => updateEntry(entry.id, patch)}
                    onRemove={() => removeEntry(entry.id)}
                    onDownload={() => downloadOne(entry)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && hasImages && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--background)]/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)] text-white">
              <Upload size={28} strokeWidth={1.5} />
            </div>
            <p className="font-medium text-sm">Drop images to add</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Card Component
// ---------------------------------------------------------------------------

function ImageCard({
  entry,
  onUpdate,
  onRemove,
  onDownload,
}: {
  entry: ImageEntry;
  onUpdate: (patch: Partial<Pick<ImageEntry, "format" | "quality" | "maxDimension">>) => void;
  onRemove: () => void;
  onDownload: () => void;
}) {
  const saved = entry.compressedSize > 0;
  const savingsText = saved ? savingsPercent(entry.originalSize, entry.compressedSize) : null;
  const isSmaller = entry.compressedSize > 0 && entry.compressedSize < entry.originalSize;

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
      {/* Top: thumbnail + info */}
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-[var(--background)] border border-[var(--border)] flex items-center justify-center">
          <img
            src={entry.originalUrl}
            alt={entry.file.name}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium truncate">{entry.file.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[var(--muted)]">
                {formatBytes(entry.originalSize)}
              </span>
              {saved && (
                <>
                  <span className="text-xs text-[var(--muted)]">-&gt;</span>
                  <span className="text-xs font-medium">
                    {formatBytes(entry.compressedSize)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isSmaller ? "text-green-500" : "text-orange-500"
                    }`}
                  >
                    {savingsText}
                  </span>
                </>
              )}
              {entry.compressing && (
                <span className="text-xs text-[var(--muted)] animate-pulse">
                  Compressing...
                </span>
              )}
            </div>
          </div>

          {entry.avifUnsupported && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertCircle size={12} className="text-orange-500 shrink-0" />
              <span className="text-[11px] text-orange-500">
                AVIF not supported by this browser
              </span>
            </div>
          )}
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-md hover:bg-[var(--surface-hover)] text-[var(--muted)] transition-colors self-start shrink-0"
          aria-label="Remove image"
        >
          <X size={16} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-3 pb-3 flex-wrap">
        <FormatSelector
          value={entry.format}
          onChange={(f) => onUpdate({ format: f })}
        />

        {/* Quality slider */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted)]">Quality</label>
          <input
            type="range"
            min={1}
            max={100}
            value={entry.quality}
            onChange={(e) => onUpdate({ quality: Number(e.target.value) })}
            className="w-20 accent-[var(--accent)]"
            disabled={entry.format === "png"}
          />
          <span className="text-xs tabular-nums w-8 text-right">
            {entry.format === "png" ? "---" : entry.quality}
          </span>
        </div>

        {/* Max dimension */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--muted)]">Max px</label>
          <input
            type="number"
            value={entry.maxDimension}
            onChange={(e) => onUpdate({ maxDimension: e.target.value })}
            placeholder="Auto"
            className="w-20 text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex-1" />

        {/* Download */}
        <button
          type="button"
          onClick={onDownload}
          disabled={!entry.compressedBlob}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Download size={13} />
          Download
        </button>
      </div>
    </div>
  );
}

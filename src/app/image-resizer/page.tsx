"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ImageIcon,
  Upload,
  Download,
  Trash2,
  X,
  Lock,
  Unlock,
  RotateCw,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResizeMode = "dimensions" | "percentage" | "maxside" | "filesize";
type CropMode = "fit" | "fill" | "stretch";
type OutputFormat = "png" | "jpeg" | "webp";
type Rotation = 0 | 90 | 180 | 270;

interface Preset {
  label: string;
  w: number;
  h: number;
  category: string;
}

interface ImageEntry {
  id: string;
  file: File;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  resizedBlob: Blob | null;
  resizedUrl: string | null;
  resizedWidth: number;
  resizedHeight: number;
  resizedSize: number;
  processing: boolean;
}

interface ResizeSettings {
  mode: ResizeMode;
  width: string;
  height: string;
  percentage: number;
  maxSide: string;
  fileSizeKB: string;
  lockAspect: boolean;
  cropMode: CropMode;
  rotation: Rotation;
  format: OutputFormat;
  quality: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS: Preset[] = [
  { label: "Instagram Post", w: 1080, h: 1080, category: "Social" },
  { label: "Instagram Story", w: 1080, h: 1920, category: "Social" },
  { label: "Twitter Post", w: 1200, h: 675, category: "Social" },
  { label: "Facebook Cover", w: 820, h: 312, category: "Social" },
  { label: "YouTube Thumbnail", w: 1280, h: 720, category: "Social" },
  { label: "LinkedIn Banner", w: 1584, h: 396, category: "Social" },
  { label: "Passport Photo", w: 600, h: 600, category: "Standard" },
  { label: "HD", w: 1920, h: 1080, category: "Standard" },
  { label: "4K", w: 3840, h: 2160, category: "Standard" },
];

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

const DEFAULT_SETTINGS: ResizeSettings = {
  mode: "dimensions",
  width: "",
  height: "",
  percentage: 100,
  maxSide: "",
  fileSizeKB: "",
  lockAspect: true,
  cropMode: "fit",
  rotation: 0,
  format: "png",
  quality: 85,
};

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

function mimeForFormat(format: OutputFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
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
  }
}

function baseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------------------------------------------------------------------------
// Compute target dimensions from settings + original dims
// ---------------------------------------------------------------------------

function computeTargetDimensions(
  ow: number,
  oh: number,
  s: ResizeSettings,
): { w: number; h: number } {
  const aspect = ow / oh;

  switch (s.mode) {
    case "dimensions": {
      let w = s.width ? parseInt(s.width, 10) : ow;
      let h = s.height ? parseInt(s.height, 10) : oh;
      if (isNaN(w) || w <= 0) w = ow;
      if (isNaN(h) || h <= 0) h = oh;
      return { w, h };
    }
    case "percentage": {
      const scale = s.percentage / 100;
      return {
        w: Math.max(1, Math.round(ow * scale)),
        h: Math.max(1, Math.round(oh * scale)),
      };
    }
    case "maxside": {
      const max = parseInt(s.maxSide, 10);
      if (!max || max <= 0) return { w: ow, h: oh };
      const longest = Math.max(ow, oh);
      if (longest <= max) return { w: ow, h: oh };
      const scale = max / longest;
      return {
        w: Math.max(1, Math.round(ow * scale)),
        h: Math.max(1, Math.round(oh * scale)),
      };
    }
    case "filesize": {
      // File size mode: we'll start at original and scale down in processImage
      return { w: ow, h: oh };
    }
    default:
      return { w: ow, h: aspect };
  }
}

// ---------------------------------------------------------------------------
// Canvas-based resize with rotation, crop mode, format
// ---------------------------------------------------------------------------

function processImage(
  file: File,
  ow: number,
  oh: number,
  settings: ResizeSettings,
): Promise<{ blob: Blob; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { w: tw, h: th } = computeTargetDimensions(ow, oh, settings);
      const rotation = settings.rotation;
      const swapAxes = rotation === 90 || rotation === 270;

      // Canvas dimensions accounting for rotation
      const canvasW = swapAxes ? th : tw;
      const canvasH = swapAxes ? tw : th;

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      // Background for JPEG
      if (settings.format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);
      }

      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Draw based on crop mode
      const aspect = ow / oh;
      const targetAspect = tw / th;

      let sx = 0,
        sy = 0,
        sw = ow,
        sh = oh;
      let dx = -tw / 2,
        dy = -th / 2,
        dw = tw,
        dh = th;

      if (settings.cropMode === "fill") {
        // Crop source to match target aspect
        if (aspect > targetAspect) {
          // Source is wider: crop sides
          sw = Math.round(oh * targetAspect);
          sx = Math.round((ow - sw) / 2);
        } else {
          // Source is taller: crop top/bottom
          sh = Math.round(ow / targetAspect);
          sy = Math.round((oh - sh) / 2);
        }
      } else if (settings.cropMode === "fit") {
        // Letterbox: fit inside target, fill background
        let fitW: number, fitH: number;
        if (aspect > targetAspect) {
          fitW = tw;
          fitH = Math.round(tw / aspect);
        } else {
          fitH = th;
          fitW = Math.round(th * aspect);
        }
        dx = -fitW / 2;
        dy = -fitH / 2;
        dw = fitW;
        dh = fitH;
      }
      // "stretch" uses the full target dimensions directly

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();

      const mime = mimeForFormat(settings.format);
      const q = settings.format === "png" ? undefined : settings.quality / 100;

      // For file size mode, iteratively lower quality
      if (settings.mode === "filesize" && settings.format !== "png") {
        const targetBytes = parseInt(settings.fileSizeKB, 10) * 1024;
        if (targetBytes > 0) {
          let currentQ = settings.quality / 100;
          const tryExport = (quality: number): Promise<Blob> => {
            return new Promise((res) => {
              canvas.toBlob(
                (blob) => res(blob || new Blob()),
                mime,
                quality,
              );
            });
          };

          (async () => {
            let blob = await tryExport(currentQ);
            let attempts = 0;
            while (blob.size > targetBytes && currentQ > 0.05 && attempts < 15) {
              currentQ = Math.max(0.05, currentQ - 0.05);
              blob = await tryExport(currentQ);
              attempts++;
            }
            // If still too large, scale down dimensions
            if (blob.size > targetBytes) {
              let scale = 0.9;
              while (blob.size > targetBytes && scale > 0.1) {
                const nw = Math.max(1, Math.round(canvasW * scale));
                const nh = Math.max(1, Math.round(canvasH * scale));
                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = nw;
                tempCanvas.height = nh;
                const tempCtx = tempCanvas.getContext("2d")!;
                if (settings.format === "jpeg") {
                  tempCtx.fillStyle = "#ffffff";
                  tempCtx.fillRect(0, 0, nw, nh);
                }
                tempCtx.drawImage(canvas, 0, 0, nw, nh);
                blob = await new Promise<Blob>((res) =>
                  tempCanvas.toBlob(
                    (b) => res(b || new Blob()),
                    mime,
                    currentQ,
                  ),
                );
                scale -= 0.1;
              }
            }
            resolve({ blob, w: canvasW, h: canvasH });
          })();
          return;
        }
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Export failed"));
            return;
          }
          resolve({ blob, w: canvasW, h: canvasH });
        },
        mime,
        q,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

// Load image dimensions
function loadImageDimensions(
  file: File,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ImageResizerPage() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ResizeSettings>({ ...DEFAULT_SETTINGS });
  const [isDragging, setIsDragging] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedImage = useMemo(
    () => images.find((i) => i.id === selectedId) || images[0] || null,
    [images, selectedId],
  );

  // Computed preview dimensions
  const previewDims = useMemo(() => {
    if (!selectedImage) return null;
    return computeTargetDimensions(
      selectedImage.originalWidth,
      selectedImage.originalHeight,
      settings,
    );
  }, [selectedImage, settings]);

  // ---------------------------------------------------------------------------
  // Process a single entry
  // ---------------------------------------------------------------------------
  const processEntry = useCallback(
    (entry: ImageEntry, s: ResizeSettings) => {
      setImages((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, processing: true } : e)),
      );

      processImage(entry.file, entry.originalWidth, entry.originalHeight, s).then(
        ({ blob, w, h }) => {
          setImages((prev) =>
            prev.map((e) => {
              if (e.id !== entry.id) return e;
              if (e.resizedUrl) URL.revokeObjectURL(e.resizedUrl);
              return {
                ...e,
                resizedBlob: blob,
                resizedUrl: URL.createObjectURL(blob),
                resizedWidth: w,
                resizedHeight: h,
                resizedSize: blob.size,
                processing: false,
              };
            }),
          );
        },
        () => {
          setImages((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, processing: false } : e,
            ),
          );
        },
      );
    },
    [],
  );

  // Process all images with debounce
  const processAllDebounced = useCallback(
    (s: ResizeSettings) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setImages((prev) => {
          for (const entry of prev) {
            processEntry(entry, s);
          }
          return prev;
        });
      }, 400);
    },
    [processEntry],
  );

  // ---------------------------------------------------------------------------
  // Settings updates
  // ---------------------------------------------------------------------------
  const updateSettings = useCallback(
    (patch: Partial<ResizeSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };

        // Aspect ratio lock: auto-calc other dimension
        if (
          next.lockAspect &&
          next.mode === "dimensions" &&
          selectedImage &&
          (patch.width !== undefined || patch.height !== undefined)
        ) {
          const aspect =
            selectedImage.originalWidth / selectedImage.originalHeight;
          if (patch.width !== undefined && patch.width !== "") {
            const w = parseInt(patch.width, 10);
            if (!isNaN(w) && w > 0) {
              next.height = String(Math.round(w / aspect));
            }
          } else if (patch.height !== undefined && patch.height !== "") {
            const h = parseInt(patch.height, 10);
            if (!isNaN(h) && h > 0) {
              next.width = String(Math.round(h * aspect));
            }
          }
        }

        processAllDebounced(next);
        return next;
      });
    },
    [selectedImage, processAllDebounced],
  );

  // Apply preset
  const applyPreset = useCallback(
    (preset: Preset) => {
      setSettings((prev) => {
        const next: ResizeSettings = {
          ...prev,
          mode: "dimensions",
          width: String(preset.w),
          height: String(preset.h),
          lockAspect: false,
        };
        processAllDebounced(next);
        return next;
      });
      setPresetsOpen(false);
    },
    [processAllDebounced],
  );

  // ---------------------------------------------------------------------------
  // Add files
  // ---------------------------------------------------------------------------
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const newEntries: ImageEntry[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        try {
          const dims = await loadImageDimensions(file);
          newEntries.push({
            id: uid(),
            file,
            originalUrl: URL.createObjectURL(file),
            originalWidth: dims.w,
            originalHeight: dims.h,
            originalSize: file.size,
            resizedBlob: null,
            resizedUrl: null,
            resizedWidth: 0,
            resizedHeight: 0,
            resizedSize: 0,
            processing: false,
          });
        } catch {
          // skip invalid images
        }
      }
      if (newEntries.length === 0) return;

      setImages((prev) => {
        const combined = [...prev, ...newEntries];
        return combined;
      });

      if (!selectedId && newEntries.length > 0) {
        setSelectedId(newEntries[0].id);
      }

      // Auto-fill dimensions from first new image if empty
      if (newEntries.length > 0) {
        setSettings((prev) => {
          if (prev.mode === "dimensions" && !prev.width && !prev.height) {
            return {
              ...prev,
              width: String(newEntries[0].originalWidth),
              height: String(newEntries[0].originalHeight),
            };
          }
          return prev;
        });
      }

      // Process new entries
      for (const entry of newEntries) {
        processEntry(entry, settings);
      }
    },
    [selectedId, settings, processEntry],
  );

  // ---------------------------------------------------------------------------
  // Remove / clear
  // ---------------------------------------------------------------------------
  const removeEntry = useCallback(
    (id: string) => {
      setImages((prev) => {
        const entry = prev.find((e) => e.id === id);
        if (entry) {
          URL.revokeObjectURL(entry.originalUrl);
          if (entry.resizedUrl) URL.revokeObjectURL(entry.resizedUrl);
        }
        const next = prev.filter((e) => e.id !== id);
        if (selectedId === id) {
          setSelectedId(next[0]?.id || null);
        }
        return next;
      });
    },
    [selectedId],
  );

  const clearAll = useCallback(() => {
    setImages((prev) => {
      for (const e of prev) {
        URL.revokeObjectURL(e.originalUrl);
        if (e.resizedUrl) URL.revokeObjectURL(e.resizedUrl);
      }
      return [];
    });
    setSelectedId(null);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  // ---------------------------------------------------------------------------
  // Download helpers
  // ---------------------------------------------------------------------------
  const downloadOne = useCallback(
    (entry: ImageEntry) => {
      if (!entry.resizedBlob || !entry.resizedUrl) return;
      const a = document.createElement("a");
      a.href = entry.resizedUrl;
      a.download =
        baseName(entry.file.name) + "_resized" + extensionForFormat(settings.format);
      a.click();
    },
    [settings.format],
  );

  const downloadAll = useCallback(() => {
    for (const entry of images) {
      if (entry.resizedBlob && entry.resizedUrl) {
        downloadOne(entry);
      }
    }
  }, [images, downloadOne]);

  // ---------------------------------------------------------------------------
  // Drag & drop
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

  // Cleanup
  useEffect(() => {
    return () => {
      for (const e of images) {
        URL.revokeObjectURL(e.originalUrl);
        if (e.resizedUrl) URL.revokeObjectURL(e.resizedUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasImages = images.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link
          href="/"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft size={20} />
        </Link>
        <ImageIcon size={20} className="text-[var(--accent)]" />
        <h1 className="text-base font-semibold">Image Resizer</h1>

        {hasImages && (
          <>
            <div className="flex-1" />
            <span className="text-xs text-[var(--muted)]">
              {images.length} image{images.length !== 1 && "s"}
            </span>
            <button
              type="button"
              onClick={downloadAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Download size={14} />
              {images.length > 1 ? "Download All" : "Download"}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Trash2 size={14} />
              Clear
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

      {/* Main content */}
      <div
        className="flex-1 overflow-hidden flex"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {!hasImages ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center p-4">
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
                  PNG, JPG, WebP -- single or batch upload
                </p>
              </div>
            </button>
          </div>
        ) : (
          <>
            {/* Left panel: preview + image list */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Preview area */}
              <div className="flex-1 overflow-hidden flex items-center justify-center p-4 relative bg-[var(--background)]">
                {selectedImage && (
                  <div className="relative max-w-full max-h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        selectedImage.resizedUrl || selectedImage.originalUrl
                      }
                      alt={selectedImage.file.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                      style={{
                        background:
                          "repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50% / 16px 16px",
                      }}
                    />
                    {selectedImage.processing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/60 rounded-lg">
                        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                {/* Dimensions badge */}
                {selectedImage && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-sm text-xs">
                    <span className="text-[var(--muted)]">
                      {selectedImage.originalWidth}x
                      {selectedImage.originalHeight}
                    </span>
                    <span className="text-[var(--muted)]">&rarr;</span>
                    <span className="font-medium">
                      {selectedImage.resizedWidth > 0
                        ? `${selectedImage.resizedWidth}x${selectedImage.resizedHeight}`
                        : previewDims
                          ? `${previewDims.w}x${previewDims.h}`
                          : "..."}
                    </span>
                    {selectedImage.resizedSize > 0 && (
                      <>
                        <span className="w-px h-3 bg-[var(--border)]" />
                        <span className="text-[var(--muted)]">
                          {formatBytes(selectedImage.originalSize)}
                        </span>
                        <span className="text-[var(--muted)]">&rarr;</span>
                        <span className="font-medium">
                          {formatBytes(selectedImage.resizedSize)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Image list (batch) */}
              {images.length > 1 && (
                <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
                    {images.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                          (selectedId || images[0]?.id) === entry.id
                            ? "border-[var(--accent)]"
                            : "border-[var(--border)] hover:border-[var(--accent)]/50"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.originalUrl}
                          alt={entry.file.name}
                          className="w-full h-full object-cover"
                        />
                        {entry.processing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/60">
                            <div className="w-3 h-3 border border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntry(entry.id);
                          }}
                          className="absolute top-0 right-0 p-0.5 bg-[var(--background)]/80 rounded-bl-md text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          aria-label={`Remove ${entry.file.name}`}
                        >
                          <X size={10} />
                        </button>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                      aria-label="Add more images"
                    >
                      <Upload size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar: settings */}
            <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
              <div className="p-3 flex flex-col gap-4">
                {/* Resize Mode */}
                <Section title="Resize Mode">
                  <div className="grid grid-cols-2 gap-1 bg-[var(--background)] rounded-lg p-0.5">
                    {(
                      [
                        ["dimensions", "Dimensions"],
                        ["percentage", "Percentage"],
                        ["maxside", "Max Side"],
                        ["filesize", "File Size"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateSettings({ mode })}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          settings.mode === mode
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Dimension inputs */}
                {settings.mode === "dimensions" && (
                  <Section title="Dimensions">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 block">
                          Width
                        </label>
                        <input
                          type="number"
                          value={settings.width}
                          onChange={(e) =>
                            updateSettings({ width: e.target.value })
                          }
                          placeholder={String(
                            selectedImage?.originalWidth || "",
                          )}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings({ lockAspect: !settings.lockAspect })
                        }
                        className={`mt-4 p-1.5 rounded-lg transition-colors ${
                          settings.lockAspect
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
                        }`}
                        aria-label={
                          settings.lockAspect
                            ? "Unlock aspect ratio"
                            : "Lock aspect ratio"
                        }
                      >
                        {settings.lockAspect ? (
                          <Lock size={12} />
                        ) : (
                          <Unlock size={12} />
                        )}
                      </button>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 block">
                          Height
                        </label>
                        <input
                          type="number"
                          value={settings.height}
                          onChange={(e) =>
                            updateSettings({ height: e.target.value })
                          }
                          placeholder={String(
                            selectedImage?.originalHeight || "",
                          )}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                      </div>
                    </div>
                  </Section>
                )}

                {settings.mode === "percentage" && (
                  <Section title="Scale">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings({
                            percentage: clamp(settings.percentage - 10, 10, 400),
                          })
                        }
                        className="p-1 rounded-md bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <input
                        type="range"
                        min={10}
                        max={400}
                        value={settings.percentage}
                        onChange={(e) =>
                          updateSettings({
                            percentage: Number(e.target.value),
                          })
                        }
                        className="flex-1 accent-[var(--accent)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings({
                            percentage: clamp(settings.percentage + 10, 10, 400),
                          })
                        }
                        className="p-1 rounded-md bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <span className="text-xs font-medium tabular-nums w-10 text-right">
                        {settings.percentage}%
                      </span>
                    </div>
                  </Section>
                )}

                {settings.mode === "maxside" && (
                  <Section title="Max Side (px)">
                    <input
                      type="number"
                      value={settings.maxSide}
                      onChange={(e) =>
                        updateSettings({ maxSide: e.target.value })
                      }
                      placeholder="e.g. 1920"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      Longest side will not exceed this value
                    </p>
                  </Section>
                )}

                {settings.mode === "filesize" && (
                  <Section title="Target File Size">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={settings.fileSizeKB}
                        onChange={(e) =>
                          updateSettings({ fileSizeKB: e.target.value })
                        }
                        placeholder="e.g. 200"
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <span className="text-xs text-[var(--muted)] font-medium">
                        KB
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      Quality and dimensions adjusted automatically. PNG not
                      supported for this mode.
                    </p>
                  </Section>
                )}

                {/* Presets */}
                <Section
                  title="Presets"
                  action={
                    <button
                      type="button"
                      onClick={() => setPresetsOpen(!presetsOpen)}
                      className="p-0.5 rounded text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {presetsOpen ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  }
                >
                  {presetsOpen && (
                    <div className="grid grid-cols-1 gap-1">
                      {PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyPreset(p)}
                          className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-left"
                        >
                          <span className="font-medium">{p.label}</span>
                          <span className="text-[var(--muted)] tabular-nums">
                            {p.w}x{p.h}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Crop Mode */}
                {settings.mode === "dimensions" && (
                  <Section title="Crop Mode">
                    <div className="flex gap-0.5 bg-[var(--background)] rounded-lg p-0.5">
                      {(["fit", "fill", "stretch"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => updateSettings({ cropMode: mode })}
                          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                            settings.cropMode === mode
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      {settings.cropMode === "fit" &&
                        "Letterbox: image fits inside, padding added"}
                      {settings.cropMode === "fill" &&
                        "Crop: image fills area, edges trimmed"}
                      {settings.cropMode === "stretch" &&
                        "Stretch: image deforms to fill exactly"}
                    </p>
                  </Section>
                )}

                {/* Rotation */}
                <Section title="Rotation">
                  <div className="flex gap-1">
                    {ROTATIONS.map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => updateSettings({ rotation: deg })}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          settings.rotation === deg
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <RotateCw
                          size={11}
                          style={{
                            transform: `rotate(${deg}deg)`,
                          }}
                        />
                        {deg}&deg;
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Output Format */}
                <Section title="Output Format">
                  <div className="flex gap-0.5 bg-[var(--background)] rounded-lg p-0.5">
                    {(["png", "jpeg", "webp"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => updateSettings({ format: fmt })}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md uppercase transition-colors ${
                          settings.format === fmt
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Quality */}
                {settings.format !== "png" && (
                  <Section title="Quality">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={settings.quality}
                        onChange={(e) =>
                          updateSettings({
                            quality: Number(e.target.value),
                          })
                        }
                        className="flex-1 accent-[var(--accent)]"
                      />
                      <span className="text-xs font-medium tabular-nums w-8 text-right">
                        {settings.quality}
                      </span>
                    </div>
                  </Section>
                )}

                {/* Download individual */}
                {selectedImage && (
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => selectedImage && downloadOne(selectedImage)}
                      disabled={!selectedImage?.resizedBlob}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Download size={13} />
                      Download Selected
                    </button>
                    {images.length > 1 && (
                      <button
                        type="button"
                        onClick={downloadAll}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <Download size={13} />
                        Download All ({images.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </aside>
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
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

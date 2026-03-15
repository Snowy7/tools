"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  Scissors,
  Image as ImageIcon,
  Sliders,
  ChevronDown,
  Cpu,
  Sparkles,
  Zap,
} from "lucide-react";

// ── Types ──

type AppState =
  | { kind: "upload" }
  | { kind: "processing"; originalUrl: string; originalFile: File; statusText: string; progress: number }
  | { kind: "result"; originalUrl: string; resultUrl: string; originalFile: File; resultBlob: Blob; elapsed: number; engine: RemovalEngine }
  | { kind: "error"; message: string; originalFile: File | null };

type OutputFormat = "png" | "jpeg" | "webp";
type RemovalEngine = "imgly" | "rmbg2" | "rmbg14";

interface EngineOption {
  id: RemovalEngine;
  name: string;
  desc: string;
  icon: React.ReactNode;
  quality: string;
}

const ENGINES: EngineOption[] = [
  {
    id: "rmbg2",
    name: "RMBG 2.0",
    desc: "Best quality, BRIA AI latest model",
    icon: <Sparkles size={16} />,
    quality: "Best",
  },
  {
    id: "rmbg14",
    name: "RMBG 1.4",
    desc: "Fast and reliable, good for most images",
    icon: <Zap size={16} />,
    quality: "Fast",
  },
  {
    id: "imgly",
    name: "ISNET",
    desc: "IMG.LY engine, lightweight model",
    icon: <Cpu size={16} />,
    quality: "Light",
  },
];

interface Settings {
  outputQuality: number;
  outputFormat: OutputFormat;
  bgReplace: "transparent" | "color" | "image";
  bgColor: string;
  bgImageUrl: string | null;
  bgImageFile: File | null;
  smoothEdges: boolean;
  // Mask refinement
  alphaThreshold: number;    // 0-255, pixels below this alpha become fully transparent
  edgeFeather: number;       // 0-10px, blur radius on the alpha mask
  maskContrast: number;      // 0.5-3.0, sharpens or softens the mask edge
  foregroundBoost: boolean;  // boost the foreground alpha to reduce semi-transparent halos
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
};

const FORMAT_MIME: Record<OutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const FORMAT_EXT: Record<OutputFormat, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
};

// ── Component ──

export default function BackgroundRemoverPage() {
  const [state, setState] = useState<AppState>({ kind: "upload" });
  const [selectedEngine, setSelectedEngine] = useState<RemovalEngine>("rmbg2");
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formatDropdownOpen, setFormatDropdownOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    outputQuality: 92,
    outputFormat: "png",
    bgReplace: "transparent",
    bgColor: "#ffffff",
    bgImageUrl: null,
    bgImageFile: null,
    smoothEdges: false,
    alphaThreshold: 0,
    edgeFeather: 0,
    maskContrast: 1.0,
    foregroundBoost: false,
  });
  const [refinedResultUrl, setRefinedResultUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Track container width via ResizeObserver
  useEffect(() => {
    const container = sliderContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [state.kind]);

  // Close format dropdown on outside click
  useEffect(() => {
    if (!formatDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setFormatDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [formatDropdownOpen]);

  const cleanupUrls = useCallback(() => {
    if (state.kind === "processing" && state.originalUrl) {
      URL.revokeObjectURL(state.originalUrl);
    }
    if (state.kind === "result") {
      URL.revokeObjectURL(state.originalUrl);
      URL.revokeObjectURL(state.resultUrl);
    }
  }, [state]);

  const processImage = useCallback(async (file: File, engine?: RemovalEngine) => {
    const eng = engine ?? selectedEngine;
    const originalUrl = URL.createObjectURL(file);

    setState({
      kind: "processing",
      originalUrl,
      originalFile: file,
      statusText: "Loading AI model...",
      progress: 0,
    });

    const startTime = performance.now();

    try {
      let resultBlob: Blob;

      if (eng === "imgly") {
        // IMG.LY ISNET engine
        const { removeBackground } = await import("@imgly/background-removal");
        resultBlob = await removeBackground(file, {
          progress: (key: string, current: number, total: number) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            const isDownloading = key.includes("fetch") || key.includes("download") || key.includes("load");
            setState((prev) => {
              if (prev.kind !== "processing") return prev;
              return { ...prev, statusText: isDownloading ? "Downloading ISNET model..." : "Removing background...", progress: pct };
            });
          },
        });
      } else {
        // HuggingFace Transformers.js — RMBG models
        const modelId = eng === "rmbg2"
          ? "briaai/RMBG-2.0"
          : "briaai/RMBG-1.4";

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: `Loading ${eng === "rmbg2" ? "RMBG 2.0" : "RMBG 1.4"}...`, progress: 10 } : prev);

        const { AutoModel, AutoProcessor, RawImage } = await import("@huggingface/transformers");

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: "Downloading model weights...", progress: 20 } : prev);

        const model = await AutoModel.from_pretrained(modelId, {
          device: "webgpu" in navigator ? "webgpu" : "wasm",
          dtype: "fp32",
        });

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: "Loading processor...", progress: 40 } : prev);

        const processor = await AutoProcessor.from_pretrained(modelId);

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: "Processing image...", progress: 50 } : prev);

        // Load image
        const imageUrl = URL.createObjectURL(file);
        const rawImage = await RawImage.fromURL(imageUrl);
        URL.revokeObjectURL(imageUrl);

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: "Running AI model...", progress: 60 } : prev);

        // Process
        const { pixel_values } = await processor(rawImage);
        const { output } = await model({ input: pixel_values });

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: "Generating mask...", progress: 80 } : prev);

        // Post-process the mask
        const maskData = output[0][0].data;
        const maskH = output[0][0].dims[0] ?? rawImage.height;
        const maskW = output[0][0].dims[1] ?? rawImage.width;

        // Create mask image and resize to original dimensions
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = maskW;
        maskCanvas.height = maskH;
        const maskCtx = maskCanvas.getContext("2d")!;
        const maskImageData = maskCtx.createImageData(maskW, maskH);

        // Normalize mask values to 0-255
        let minVal = Infinity, maxVal = -Infinity;
        for (let i = 0; i < maskData.length; i++) {
          if (maskData[i] < minVal) minVal = maskData[i];
          if (maskData[i] > maxVal) maxVal = maskData[i];
        }
        const range = maxVal - minVal || 1;

        for (let i = 0; i < maskData.length; i++) {
          const alpha = Math.round(((maskData[i] - minVal) / range) * 255);
          maskImageData.data[i * 4] = 255;
          maskImageData.data[i * 4 + 1] = 255;
          maskImageData.data[i * 4 + 2] = 255;
          maskImageData.data[i * 4 + 3] = alpha;
        }
        maskCtx.putImageData(maskImageData, 0, 0);

        setState((prev) => prev.kind === "processing" ? { ...prev, statusText: "Compositing result...", progress: 90 } : prev);

        // Composite: draw original image, apply mask as alpha
        const resultCanvas = document.createElement("canvas");
        resultCanvas.width = rawImage.width;
        resultCanvas.height = rawImage.height;
        const resultCtx = resultCanvas.getContext("2d")!;

        // Draw original
        const origCanvas = document.createElement("canvas");
        origCanvas.width = rawImage.width;
        origCanvas.height = rawImage.height;
        const origCtx = origCanvas.getContext("2d")!;
        const origImageData = origCtx.createImageData(rawImage.width, rawImage.height);
        for (let i = 0; i < rawImage.data.length; i++) {
          origImageData.data[i] = rawImage.data[i];
        }
        origCtx.putImageData(origImageData, 0, 0);

        // Draw resized mask
        resultCtx.drawImage(maskCanvas, 0, 0, rawImage.width, rawImage.height);
        // Use source-in to apply mask to original
        resultCtx.globalCompositeOperation = "source-in";
        resultCtx.drawImage(origCanvas, 0, 0);
        resultCtx.globalCompositeOperation = "source-over";

        resultBlob = await new Promise<Blob>((resolve, reject) => {
          resultCanvas.toBlob((b) => b ? resolve(b) : reject(new Error("Failed to create blob")), "image/png");
        });
      }

      const elapsed = Math.round((performance.now() - startTime) / 100) / 10;
      const resultUrl = URL.createObjectURL(resultBlob);

      setState({
        kind: "result",
        originalUrl,
        resultUrl,
        originalFile: file,
        resultBlob,
        elapsed,
        engine: eng,
      });
    } catch (err) {
      console.error("Background removal error:", err);
      URL.revokeObjectURL(originalUrl);
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
        originalFile: file,
      });
    }
  }, [selectedEngine]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      cleanupUrls();
      processImage(file);
    },
    [cleanupUrls, processImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const reset = useCallback(() => {
    cleanupUrls();
    setState({ kind: "upload" });
    setSliderPosition(50);
    setCopySuccess(false);
    setSettingsOpen(false);
    if (settings.bgImageUrl) {
      URL.revokeObjectURL(settings.bgImageUrl);
      setSettings((s) => ({ ...s, bgImageUrl: null, bgImageFile: null }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [cleanupUrls, settings.bgImageUrl]);

  // Apply mask refinement to generate a live preview
  const applyMaskRefinement = useCallback((resultBlob: Blob, s: Settings): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;

        // Apply edge feather via blur if needed
        if (s.edgeFeather > 0) {
          ctx.filter = `blur(${s.edgeFeather}px)`;
        }
        ctx.drawImage(img, 0, 0);
        ctx.filter = "none";

        // Manipulate alpha channel pixel by pixel
        if (s.alphaThreshold > 0 || s.maskContrast !== 1.0 || s.foregroundBoost) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          for (let i = 3; i < d.length; i += 4) {
            let a = d[i];

            // Alpha threshold: kill low-alpha pixels
            if (a < s.alphaThreshold) {
              a = 0;
            } else if (s.alphaThreshold > 0) {
              // Remap remaining range to 0-255
              a = Math.round(((a - s.alphaThreshold) / (255 - s.alphaThreshold)) * 255);
            }

            // Mask contrast: push alpha toward 0 or 255
            if (s.maskContrast !== 1.0) {
              const normalized = a / 255;
              const contrasted = Math.pow(normalized, 1 / s.maskContrast);
              a = Math.round(Math.min(255, Math.max(0, contrasted * 255)));
            }

            // Foreground boost: push semi-transparent pixels toward fully opaque
            if (s.foregroundBoost && a > 20) {
              a = Math.round(Math.min(255, a * 1.5));
            }

            d[i] = a;
          }
          ctx.putImageData(imageData, 0, 0);
        }

        // If smooth edges, redraw the original on top using source-in to sharpen subject
        if (s.smoothEdges && s.edgeFeather > 0) {
          ctx.globalCompositeOperation = "source-in";
          ctx.filter = "none";
          ctx.drawImage(img, 0, 0);
          ctx.globalCompositeOperation = "source-over";
        }

        const url = canvas.toDataURL("image/png");
        URL.revokeObjectURL(img.src);
        resolve(url);
      };
      img.src = URL.createObjectURL(resultBlob);
    });
  }, []);

  // Re-apply refinement when mask settings change
  useEffect(() => {
    if (state.kind !== "result") return;
    const needsRefinement = settings.alphaThreshold > 0 || settings.edgeFeather > 0 ||
      settings.maskContrast !== 1.0 || settings.foregroundBoost || settings.smoothEdges;

    if (!needsRefinement) {
      if (refinedResultUrl) {
        setRefinedResultUrl(null);
      }
      return;
    }

    let cancelled = false;
    applyMaskRefinement(state.resultBlob, settings).then((url) => {
      if (!cancelled) setRefinedResultUrl(url);
    });
    return () => { cancelled = true; };
  }, [state, settings.alphaThreshold, settings.edgeFeather, settings.maskContrast,
      settings.foregroundBoost, settings.smoothEdges, applyMaskRefinement]);

  // Build final canvas: apply mask refinement + background replacement for export
  const buildFinalCanvas = useCallback(
    async (resultBlob: Blob): Promise<HTMLCanvasElement> => {
      // First apply mask refinement
      const refinedUrl = await applyMaskRefinement(resultBlob, settings);

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;

          // Background replacement
          if (settings.bgReplace === "color") {
            ctx.fillStyle = settings.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
            return;
          }

          if (settings.bgReplace === "image" && settings.bgImageUrl) {
            const bgImg = new Image();
            bgImg.onload = () => {
              const scale = Math.max(canvas.width / bgImg.naturalWidth, canvas.height / bgImg.naturalHeight);
              const w = bgImg.naturalWidth * scale;
              const h = bgImg.naturalHeight * scale;
              ctx.drawImage(bgImg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
              ctx.drawImage(img, 0, 0);
              resolve(canvas);
            };
            bgImg.onerror = () => {
              ctx.drawImage(img, 0, 0);
              resolve(canvas);
            };
            bgImg.src = settings.bgImageUrl;
            return;
          }

          // Transparent
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        };
        img.src = refinedUrl;
      });
    },
    [settings, applyMaskRefinement],
  );

  const downloadResult = useCallback(
    async (format?: OutputFormat) => {
      if (state.kind !== "result") return;
      const fmt = format ?? settings.outputFormat;
      const canvas = await buildFinalCanvas(state.resultBlob);

      const quality = fmt === "png" ? undefined : settings.outputQuality / 100;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = state.originalFile.name.replace(/\.[^.]+$/, "") + "-no-bg" + FORMAT_EXT[fmt];
          a.click();
          URL.revokeObjectURL(url);
        },
        FORMAT_MIME[fmt],
        quality,
      );
    },
    [state, settings.outputFormat, settings.outputQuality, buildFinalCanvas],
  );

  const copyToClipboard = useCallback(async () => {
    if (state.kind !== "result") return;
    try {
      const canvas = await buildFinalCanvas(state.resultBlob);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))), "image/png");
      });
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Some browsers don't support clipboard write for images
    }
  }, [state, buildFinalCanvas]);

  // Slider drag logic
  const updateSliderPosition = useCallback((clientX: number) => {
    const container = sliderContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pct);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSlider.current) return;
      e.preventDefault();
      updateSliderPosition(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingSlider.current) return;
      updateSliderPosition(e.touches[0].clientX);
    };
    const handleUp = () => {
      isDraggingSlider.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [updateSliderPosition]);

  // Background image upload handler
  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setSettings((prev) => {
      if (prev.bgImageUrl) URL.revokeObjectURL(prev.bgImageUrl);
      return {
        ...prev,
        bgReplace: "image",
        bgImageUrl: URL.createObjectURL(file),
        bgImageFile: file,
      };
    });
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
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
        <Scissors size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-lg font-semibold tracking-tight">Background Remover</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8">
        {/* Upload State */}
        {state.kind === "upload" && (
          <div
            className="w-full max-w-xl"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Engine selector */}
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">AI Model</p>
              <div className="grid grid-cols-3 gap-2">
                {ENGINES.map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => setSelectedEngine(eng.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer text-center ${
                      selectedEngine === eng.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40"
                    }`}
                  >
                    <span className={selectedEngine === eng.id ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                      {eng.icon}
                    </span>
                    <span className="text-xs font-semibold">{eng.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      eng.quality === "Best" ? "bg-emerald-100 text-emerald-700" :
                      eng.quality === "Fast" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{eng.quality}</span>
                    <span className="text-[10px] text-[var(--muted)] leading-tight">{eng.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed p-10 md:p-14 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-200 ${
                  isDragging ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                <Upload size={28} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm mb-0.5">Drop image here or click to upload</p>
                <p className="text-xs text-[var(--muted)]">PNG, JPG, WebP supported</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        {/* Processing State */}
        {state.kind === "processing" && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            <div className="relative w-full rounded-xl overflow-hidden bg-[var(--surface)]">
              <img
                src={state.originalUrl}
                alt="Original"
                className="w-full max-h-[50vh] object-contain opacity-30"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 animate-spin" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="4" />
                    <path
                      d="M44 24c0-11.046-8.954-20-20-20"
                      stroke="var(--accent)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-medium text-sm">{state.statusText}</p>
                <div className="w-full max-w-xs h-2 rounded-full overflow-hidden bg-[var(--border)]">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${state.progress}%`,
                      background: "linear-gradient(90deg, var(--accent), var(--accent-hover))",
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">{state.progress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.kind === "error" && (
          <div className="w-full max-w-md flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[var(--surface-hover)] text-red-500">
              <AlertCircle size={28} />
            </div>
            <div>
              <p className="font-semibold mb-1">Something went wrong</p>
              <p className="text-sm text-[var(--muted)]">{state.message}</p>
            </div>
            <div className="flex gap-3">
              {state.originalFile && (
                <button
                  onClick={() => processImage(state.originalFile!)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  <RotateCcw size={16} />
                  Retry
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] bg-transparent hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* Result State */}
        {state.kind === "result" && (
          <div className="w-full max-w-4xl flex flex-col gap-5">
            {/* Before/After Slider */}
            <div
              ref={sliderContainerRef}
              className="relative w-full overflow-hidden rounded-xl select-none touch-none cursor-ew-resize"
              style={{
                background:
                  "repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
              }}
              onMouseDown={(e) => {
                isDraggingSlider.current = true;
                updateSliderPosition(e.clientX);
              }}
              onTouchStart={(e) => {
                isDraggingSlider.current = true;
                updateSliderPosition(e.touches[0].clientX);
              }}
            >
              {/* After (result) - base layer, uses refined version if mask settings active */}
              <img
                src={refinedResultUrl || state.resultUrl}
                alt="Result with background removed"
                className="w-full block max-h-[65vh] object-contain"
                draggable={false}
              />

              {/* Before (original) - clipped overlay */}
              <div
                className="absolute top-0 left-0 bottom-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={state.originalUrl}
                  alt="Original image"
                  className="block max-w-none h-full object-contain"
                  style={{ width: containerWidth > 0 ? `${containerWidth}px` : "100vw" }}
                  draggable={false}
                />
              </div>

              {/* Divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translateX(-50%)",
                  background: "white",
                  boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                }}
              />

              {/* Drag handle */}
              <div
                className="absolute top-1/2 w-9 h-9 rounded-full flex items-center justify-center pointer-events-none"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translate(-50%, -50%)",
                  background: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#333"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="8 4 4 8 8 12" />
                  <polyline points="16 4 20 8 16 12" />
                </svg>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white pointer-events-none">
                Before
              </div>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-xs font-medium bg-black/50 text-white pointer-events-none">
                After
              </div>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
              <div className="flex flex-wrap gap-4 items-center">
                <span>
                  Original: <strong className="text-[var(--foreground)]">{formatBytes(state.originalFile.size)}</strong>
                </span>
                <span>
                  Result: <strong className="text-[var(--foreground)]">{formatBytes(state.resultBlob.size)}</strong>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--border)]">
                  {ENGINES.find((e) => e.id === state.engine)?.name ?? "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>Processed in {state.elapsed}s</span>
                {/* Re-run with different engine */}
                <div className="relative group">
                  <button className="text-xs text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1">
                    <RotateCcw size={12} />
                    Try another model
                  </button>
                  <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block w-52 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-10 py-1">
                    {ENGINES.filter((e) => e.id !== state.engine).map((eng) => (
                      <button
                        key={eng.id}
                        onClick={() => processImage(state.originalFile, eng.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        {eng.icon}
                        <span className="flex-1">{eng.name}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                          eng.quality === "Best" ? "bg-emerald-100 text-emerald-700" :
                          eng.quality === "Fast" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{eng.quality}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {/* Download button with format dropdown */}
              <div ref={formatDropdownRef} className="relative">
                <div className="flex">
                  <button
                    onClick={() => downloadResult()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-l-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                  >
                    <Download size={16} />
                    Download {FORMAT_LABELS[settings.outputFormat]}
                  </button>
                  <button
                    onClick={() => setFormatDropdownOpen((v) => !v)}
                    className="flex items-center px-2 py-2.5 rounded-r-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer border-l border-white/20"
                    aria-label="Choose download format"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                {formatDropdownOpen && (
                  <div
                    className="absolute top-full left-0 mt-1 w-44 rounded-lg border shadow-lg overflow-hidden z-10"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    {(["png", "jpeg", "webp"] as OutputFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => {
                          setSettings((s) => ({ ...s, outputFormat: fmt }));
                          setFormatDropdownOpen(false);
                          downloadResult(fmt);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <Download size={14} />
                        Download as {FORMAT_LABELS[fmt]}
                        {fmt !== "png" && (
                          <span className="text-[var(--muted)] text-xs ml-auto">
                            Q{settings.outputQuality}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                {copySuccess ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy to clipboard
                  </>
                )}
              </button>

              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <RotateCcw size={16} />
                Remove another
              </button>
            </div>

            {/* Settings Panel (collapsible) */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders size={16} />
                  Output Settings
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {settingsOpen && (
                <div
                  className="px-4 pb-4 pt-2 border-t grid gap-6 sm:grid-cols-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Output Quality */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium flex items-center justify-between">
                      Output Quality
                      <span className="text-xs text-[var(--muted)] font-normal">
                        {settings.outputFormat === "png" ? "N/A for PNG" : `${settings.outputQuality}%`}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      value={settings.outputQuality}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, outputQuality: Number(e.target.value) }))
                      }
                      disabled={settings.outputFormat === "png"}
                      className="w-full accent-[var(--accent)] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-xs text-[var(--muted)]">
                      <span>60</span>
                      <span>100</span>
                    </div>
                  </div>

                  {/* Output Format */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Output Format</label>
                    <div className="flex gap-1 rounded-lg p-1 bg-[var(--background)]">
                      {(["png", "jpeg", "webp"] as OutputFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setSettings((s) => ({ ...s, outputFormat: fmt }))}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                            settings.outputFormat === fmt
                              ? "bg-[var(--accent)] text-white"
                              : "hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {FORMAT_LABELS[fmt]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Replace */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Background Replace</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1 rounded-lg p-1 bg-[var(--background)]">
                        {(
                          [
                            { value: "transparent", label: "None" },
                            { value: "color", label: "Color" },
                            { value: "image", label: "Image" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSettings((s) => ({ ...s, bgReplace: opt.value }))}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                              settings.bgReplace === opt.value
                                ? "bg-[var(--accent)] text-white"
                                : "hover:bg-[var(--surface-hover)]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {settings.bgReplace === "color" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.bgColor}
                            onChange={(e) =>
                              setSettings((s) => ({ ...s, bgColor: e.target.value }))
                            }
                            className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer"
                          />
                          <input
                            type="text"
                            value={settings.bgColor}
                            onChange={(e) =>
                              setSettings((s) => ({ ...s, bgColor: e.target.value }))
                            }
                            className="flex-1 px-2 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--background)]"
                            spellCheck={false}
                          />
                        </div>
                      )}

                      {settings.bgReplace === "image" && (
                        <div>
                          <button
                            onClick={() => bgImageInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2 text-xs rounded-md border border-dashed border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer w-full"
                          >
                            <ImageIcon size={14} />
                            {settings.bgImageFile
                              ? settings.bgImageFile.name
                              : "Upload background image"}
                          </button>
                          <input
                            ref={bgImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBgImageUpload}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mask Refinement */}
                  <div className="flex flex-col gap-3 sm:col-span-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Scissors size={14} />
                      Mask Refinement
                    </label>
                    <p className="text-xs text-[var(--muted)] -mt-1">
                      Adjust these to clean up the AI mask — remove halos, sharpen edges, or fine-tune transparency.
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Alpha Threshold */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium flex items-center justify-between">
                          Alpha Threshold
                          <span className="text-[var(--muted)] font-normal tabular-nums">{settings.alphaThreshold}</span>
                        </label>
                        <input type="range" min={0} max={200} value={settings.alphaThreshold}
                          onChange={(e) => setSettings((s) => ({ ...s, alphaThreshold: Number(e.target.value) }))}
                          className="w-full accent-[var(--accent)]" />
                        <p className="text-[10px] text-[var(--muted)]">Remove semi-transparent halos. Higher = more aggressive.</p>
                      </div>

                      {/* Edge Feather */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium flex items-center justify-between">
                          Edge Feather
                          <span className="text-[var(--muted)] font-normal tabular-nums">{settings.edgeFeather}px</span>
                        </label>
                        <input type="range" min={0} max={10} step={0.5} value={settings.edgeFeather}
                          onChange={(e) => setSettings((s) => ({ ...s, edgeFeather: Number(e.target.value) }))}
                          className="w-full accent-[var(--accent)]" />
                        <p className="text-[10px] text-[var(--muted)]">Soften edges. Good for compositing onto new backgrounds.</p>
                      </div>

                      {/* Mask Contrast */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium flex items-center justify-between">
                          Mask Contrast
                          <span className="text-[var(--muted)] font-normal tabular-nums">{settings.maskContrast.toFixed(1)}x</span>
                        </label>
                        <input type="range" min={0.5} max={3} step={0.1} value={settings.maskContrast}
                          onChange={(e) => setSettings((s) => ({ ...s, maskContrast: Number(e.target.value) }))}
                          className="w-full accent-[var(--accent)]" />
                        <p className="text-[10px] text-[var(--muted)]">Push edges toward sharp cutout (&gt;1) or softer blend (&lt;1).</p>
                      </div>

                      {/* Foreground Boost + Smooth Edges */}
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <button role="switch" aria-checked={settings.foregroundBoost}
                            onClick={() => setSettings((s) => ({ ...s, foregroundBoost: !s.foregroundBoost }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                              settings.foregroundBoost ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                            }`}>
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                              settings.foregroundBoost ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                            }`} />
                          </button>
                          <span className="text-xs font-medium">Foreground boost</span>
                        </label>
                        <p className="text-[10px] text-[var(--muted)] ml-12 -mt-1">Push semi-transparent subject pixels toward full opacity.</p>

                        <label className="flex items-center gap-3 cursor-pointer mt-1">
                          <button role="switch" aria-checked={settings.smoothEdges}
                            onClick={() => setSettings((s) => ({ ...s, smoothEdges: !s.smoothEdges }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                              settings.smoothEdges ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                            }`}>
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                              settings.smoothEdges ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                            }`} />
                          </button>
                          <span className="text-xs font-medium">Smooth edges</span>
                        </label>
                        <p className="text-[10px] text-[var(--muted)] ml-12 -mt-1">Re-composite sharp subject onto feathered mask.</p>
                      </div>
                    </div>

                    {/* Reset refinement */}
                    {(settings.alphaThreshold > 0 || settings.edgeFeather > 0 || settings.maskContrast !== 1.0 || settings.foregroundBoost || settings.smoothEdges) && (
                      <button
                        onClick={() => setSettings((s) => ({ ...s, alphaThreshold: 0, edgeFeather: 0, maskContrast: 1.0, foregroundBoost: false, smoothEdges: false }))}
                        className="text-xs text-[var(--accent)] hover:underline cursor-pointer self-start"
                      >
                        Reset all refinement
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

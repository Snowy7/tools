"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  Download,
  Upload,
  Copy,
  Check,
  Code,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type Shape = "square" | "circle" | "rounded";

interface FaviconSize {
  size: number;
  label: string;
  filename: string;
}

const FAVICON_SIZES: FaviconSize[] = [
  { size: 16, label: "16x16", filename: "favicon-16x16.png" },
  { size: 32, label: "32x32", filename: "favicon-32x32.png" },
  { size: 48, label: "48x48", filename: "favicon-48x48.png" },
  { size: 64, label: "64x64", filename: "favicon-64x64.png" },
  { size: 128, label: "128x128", filename: "favicon-128x128.png" },
  { size: 180, label: "180x180", filename: "apple-touch-icon.png" },
  { size: 192, label: "192x192", filename: "android-chrome-192x192.png" },
  { size: 512, label: "512x512", filename: "android-chrome-512x512.png" },
];

const HTML_SNIPPET = `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`;

const MANIFEST_SNIPPET = `{
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
      {children}
    </label>
  );
}

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

function generateFavicon(
  img: HTMLImageElement,
  size: number,
  bgColor: string,
  padding: number,
  radius: number,
  shape: Shape,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas context unavailable"));
      return;
    }

    // Apply clipping shape
    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    } else if (shape === "rounded") {
      const r = (radius / 100) * (size / 2);
      ctx.roundRect(0, 0, size, size, r);
    } else {
      ctx.rect(0, 0, size, size);
    }
    ctx.clip();

    // Background
    if (bgColor && bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fill();
    }

    // Calculate padding and draw image
    const pad = (padding / 100) * size;
    const drawSize = size - pad * 2;

    // Fit image within the padded area maintaining aspect ratio
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number;
    if (imgAspect > 1) {
      drawW = drawSize;
      drawH = drawSize / imgAspect;
    } else {
      drawH = drawSize;
      drawW = drawSize * imgAspect;
    }
    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate favicon"));
          return;
        }
        resolve(blob);
      },
      "image/png",
    );
  });
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FaviconGeneratorPage() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Settings
  const [bgColor, setBgColor] = useState("#ffffff");
  const [useBgColor, setUseBgColor] = useState(false);
  const [padding, setPadding] = useState(0);
  const [radius, setRadius] = useState(0);
  const [shape, setShape] = useState<Shape>("square");

  // Generated results
  const [results, setResults] = useState<Map<number, { blob: Blob; url: string }>>(
    new Map(),
  );

  // Clipboard feedback
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Generate all favicons when source image or settings change
  // ---------------------------------------------------------------------------
  const generateAll = useCallback(
    async (img: HTMLImageElement) => {
      setGenerating(true);

      // Revoke old URLs
      setResults((prev) => {
        for (const entry of prev.values()) {
          URL.revokeObjectURL(entry.url);
        }
        return new Map();
      });

      const bg = useBgColor ? bgColor : "transparent";
      const newResults = new Map<number, { blob: Blob; url: string }>();

      for (const { size } of FAVICON_SIZES) {
        try {
          const blob = await generateFavicon(img, size, bg, padding, radius, shape);
          const url = URL.createObjectURL(blob);
          newResults.set(size, { blob, url });
        } catch {
          // skip failed sizes
        }
      }

      setResults(newResults);
      setGenerating(false);
    },
    [bgColor, useBgColor, padding, radius, shape],
  );

  // Regenerate when settings change and we have a source image
  useEffect(() => {
    if (sourceImage) {
      generateAll(sourceImage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgColor, useBgColor, padding, radius, shape]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      for (const entry of results.values()) {
        URL.revokeObjectURL(entry.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------
  const loadImage = useCallback(
    (file: File) => {
      if (
        !file.type.startsWith("image/") &&
        !file.type.includes("svg")
      ) {
        return;
      }

      if (sourceUrl) URL.revokeObjectURL(sourceUrl);

      const url = URL.createObjectURL(file);
      setSourceUrl(url);

      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        generateAll(img);
      };
      img.src = url;
    },
    [sourceUrl, generateAll],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadImage(file);
    },
    [loadImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Downloads
  // ---------------------------------------------------------------------------
  const downloadOne = useCallback(
    (size: number) => {
      const entry = results.get(size);
      if (!entry) return;
      const sizeConfig = FAVICON_SIZES.find((s) => s.size === size);
      if (!sizeConfig) return;
      const a = document.createElement("a");
      a.href = entry.url;
      a.download = sizeConfig.filename;
      a.click();
    },
    [results],
  );

  const downloadAll = useCallback(() => {
    for (const { size, filename } of FAVICON_SIZES) {
      const entry = results.get(size);
      if (!entry) continue;
      const a = document.createElement("a");
      a.href = entry.url;
      a.download = filename;
      a.click();
    }
  }, [results]);

  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------
  const copyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(HTML_SNIPPET);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch {
      // clipboard not available
    }
  }, []);

  const copyManifest = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MANIFEST_SNIPPET);
      setCopiedManifest(true);
      setTimeout(() => setCopiedManifest(false), 2000);
    } catch {
      // clipboard not available
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const hasResults = results.size > 0;
  const shapes: { value: Shape; label: string }[] = [
    { value: "square", label: "Square" },
    { value: "circle", label: "Circle" },
    { value: "rounded", label: "Rounded Square" },
  ];

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
        <ImageIcon size={20} className="text-[var(--accent)]" />
        <h1 className="text-base font-semibold">Favicon Generator</h1>

        {hasResults && (
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
          </>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadImage(file);
          e.target.value = "";
        }}
      />

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: Upload / Preview grid */}
        <div
          className="flex-[3] flex flex-col min-w-0 overflow-y-auto"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {!sourceImage ? (
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
                    Drop an image here or click to upload
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    PNG, JPEG, or SVG -- will be used to generate all favicon sizes
                  </p>
                </div>
              </button>
            </div>
          ) : (
            /* Preview grid */
            <div className="p-4 md:p-6">
              {/* Source info bar */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                {sourceUrl && (
                  <img
                    src={sourceUrl}
                    alt="Source"
                    className="w-12 h-12 rounded-lg object-contain border border-[var(--border)] bg-[var(--background)]"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Source Image</p>
                  <p className="text-xs text-[var(--muted)]">
                    {sourceImage.naturalWidth} x {sourceImage.naturalHeight}px
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
                >
                  <Upload size={13} />
                  Change
                </button>
              </div>

              {generating && (
                <p className="text-sm text-[var(--muted)] animate-pulse mb-4">
                  Generating favicons...
                </p>
              )}

              {/* Favicon grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {FAVICON_SIZES.map(({ size, label, filename }) => {
                  const entry = results.get(size);
                  const sizeLabel =
                    size === 180
                      ? "Apple Touch Icon"
                      : size === 192
                        ? "Android Chrome"
                        : size === 512
                          ? "Android Chrome (lg)"
                          : label;

                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => downloadOne(size)}
                      disabled={!entry}
                      className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      title={`Download ${filename}`}
                    >
                      {/* Preview container with checkerboard */}
                      <div
                        className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden"
                        style={{
                          width: Math.min(size, 96),
                          height: Math.min(size, 96),
                          backgroundImage: `
                            linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                            linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                            linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
                          `,
                          backgroundSize: "8px 8px",
                          backgroundPosition:
                            "0 0, 0 4px, 4px -4px, -4px 0px",
                        }}
                      >
                        {entry && (
                          <img
                            src={entry.url}
                            alt={`${label} favicon`}
                            style={{
                              width: Math.min(size, 96),
                              height: Math.min(size, 96),
                              imageRendering:
                                size <= 32 ? "pixelated" : "auto",
                            }}
                            className="object-contain"
                          />
                        )}
                      </div>

                      <div className="text-center">
                        <p className="text-xs font-medium">{sizeLabel}</p>
                        <p className="text-[10px] text-[var(--muted)]">
                          {filename}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download size={10} />
                        Click to download
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: Settings sidebar */}
        <div className="flex-[2] border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
          {/* Shape */}
          <Section title="Shape" defaultOpen>
            <div className="flex flex-col gap-1">
              <Label>Icon Shape</Label>
              <div className="flex gap-1">
                {shapes.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setShape(s.value)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      shape === s.value
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {shape === "rounded" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <Label>Corner Radius</Label>
                  <span className="text-xs tabular-nums text-[var(--muted)]">
                    {radius}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            )}
          </Section>

          {/* Background */}
          <Section title="Background" defaultOpen>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useBgColor}
                onChange={(e) => setUseBgColor(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)]"
              />
              <span className="text-sm">Apply background color</span>
            </label>

            {useBgColor && (
              <div className="flex flex-col gap-1">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="flex-1 text-sm font-mono px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)]"
                    maxLength={7}
                  />
                </div>
              </div>
            )}
          </Section>

          {/* Padding */}
          <Section title="Padding" defaultOpen>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label>Padding</Label>
                <span className="text-xs tabular-nums text-[var(--muted)]">
                  {padding}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
              <p className="text-[10px] text-[var(--muted)]">
                Space around the icon inside the square
              </p>
            </div>
          </Section>

          {/* HTML Snippet */}
          <Section
            title="HTML Link Tags"
            icon={<Code size={16} />}
            defaultOpen={false}
          >
            <div className="relative">
              <pre className="text-[11px] font-mono leading-relaxed p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] overflow-x-auto whitespace-pre-wrap break-all">
                {HTML_SNIPPET}
              </pre>
              <button
                type="button"
                onClick={copyHtml}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {copiedHtml ? (
                  <>
                    <Check size={10} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </Section>

          {/* Manifest Snippet */}
          <Section
            title="manifest.json"
            icon={<Code size={16} />}
            defaultOpen={false}
          >
            <div className="relative">
              <pre className="text-[11px] font-mono leading-relaxed p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] overflow-x-auto whitespace-pre-wrap break-all">
                {MANIFEST_SNIPPET}
              </pre>
              <button
                type="button"
                onClick={copyManifest}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {copiedManifest ? (
                  <>
                    <Check size={10} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </Section>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && sourceImage && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--background)]/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)] text-white">
              <Upload size={28} strokeWidth={1.5} />
            </div>
            <p className="font-medium text-sm">Drop image to replace</p>
          </div>
        </div>
      )}
    </div>
  );
}

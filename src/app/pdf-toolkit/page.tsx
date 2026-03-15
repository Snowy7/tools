"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  Trash2,
  X,
  RotateCw,
  RotateCcw,
  FlipVertical,
  Merge,
  Scissors,
  GripVertical,
  Info,
  Copy,
  Image,
  ImageDown,
  Hash,
  Droplets,
} from "lucide-react";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab =
  | "merge"
  | "split"
  | "rotate"
  | "reorder"
  | "extract"
  | "images-to-pdf"
  | "pdf-to-images"
  | "page-numbers"
  | "watermark"
  | "info";

interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  arrayBuffer: ArrayBuffer;
}

interface PageThumb {
  index: number;
  label: number;
  width: number;
  height: number;
  selected: boolean;
  rotation: number;
}

interface ImageFile {
  id: string;
  file: File;
  name: string;
  size: number;
  dataUrl: string;
  width: number;
  height: number;
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function loadPdfFile(file: File): Promise<PdfFile> {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return {
    id: uid(),
    file,
    name: file.name,
    size: file.size,
    pageCount: doc.getPageCount(),
    arrayBuffer,
  };
}

function getPageThumbs(pageCount: number): PageThumb[] {
  return Array.from({ length: pageCount }, (_, i) => {
    return {
      index: i,
      label: i + 1,
      width: 0,
      height: 0,
      selected: false,
      rotation: 0,
    };
  });
}

function parsePageRanges(input: string, max: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b)) {
        const lo = Math.max(1, Math.min(a, b));
        const hi = Math.min(max, Math.max(a, b));
        for (let i = lo; i <= hi; i++) pages.add(i);
      }
    } else {
      const n = Number(part);
      if (!isNaN(n) && n >= 1 && n <= max) pages.add(n);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

async function loadImageFile(file: File): Promise<ImageFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        resolve({
          id: uid(),
          file,
          name: file.name,
          size: file.size,
          dataUrl: reader.result as string,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "merge", label: "Merge", icon: <Merge className="w-3.5 h-3.5" /> },
  { key: "split", label: "Split", icon: <Scissors className="w-3.5 h-3.5" /> },
  { key: "rotate", label: "Rotate", icon: <RotateCw className="w-3.5 h-3.5" /> },
  { key: "reorder", label: "Reorder", icon: <GripVertical className="w-3.5 h-3.5" /> },
  { key: "extract", label: "Extract", icon: <Copy className="w-3.5 h-3.5" /> },
  { key: "images-to-pdf", label: "Images to PDF", icon: <Image className="w-3.5 h-3.5" /> },
  { key: "pdf-to-images", label: "PDF to Images", icon: <ImageDown className="w-3.5 h-3.5" /> },
  { key: "page-numbers", label: "Page Numbers", icon: <Hash className="w-3.5 h-3.5" /> },
  { key: "watermark", label: "Watermark", icon: <Droplets className="w-3.5 h-3.5" /> },
  { key: "info", label: "Info", icon: <Info className="w-3.5 h-3.5" /> },
];

function UploadZone({
  onFiles,
  multiple = false,
  label,
  accept = "application/pdf",
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 p-10"
      style={{
        borderColor: dragging ? "var(--accent)" : "var(--border)",
        background: dragging ? "var(--surface-hover)" : "var(--surface)",
      }}
    >
      <Upload className="w-10 h-10" style={{ color: "var(--muted)" }} />
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {label || "Drop PDF file(s) here or click to browse"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PageCard({
  page,
  onClick,
  onRemove,
  showRemove = false,
  size = "md",
  dragHandleProps,
  extraContent,
}: {
  page: PageThumb;
  onClick?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  size?: "sm" | "md";
  dragHandleProps?: Record<string, unknown>;
  extraContent?: React.ReactNode;
}) {
  const dim = size === "sm" ? "w-20 h-28" : "w-28 h-36";
  return (
    <div
      className={`${dim} relative rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shrink-0 select-none`}
      style={{
        borderColor: page.selected ? "var(--accent)" : "var(--border)",
        background: page.selected ? "var(--accent)" : "var(--surface)",
        color: page.selected ? "#fff" : "var(--foreground)",
        boxShadow: page.selected
          ? "0 0 0 2px var(--accent)"
          : "0 1px 2px rgba(0,0,0,0.04)",
        transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
      }}
      onClick={onClick}
      {...dragHandleProps}
    >
      <FileText className="w-6 h-6 opacity-40" />
      <span className="text-xs font-semibold">{page.label}</span>
      {showRemove && onRemove && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white"
          style={{ background: "#ef4444" }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {extraContent}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: isPrimary ? "var(--accent)" : "var(--surface)",
        color: isPrimary ? "#fff" : "var(--foreground)",
        border: isPrimary ? "none" : "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.target as HTMLElement).style.background = isPrimary
            ? "var(--accent-hover)"
            : "var(--surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = isPrimary
          ? "var(--accent)"
          : "var(--surface)";
      }}
    >
      {children}
    </button>
  );
}

function PdfFileBar({
  pdf,
  onClear,
}: {
  pdf: PdfFile;
  onClear: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3 border"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <FileText
        className="w-5 h-5 shrink-0"
        style={{ color: "var(--accent)" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{pdf.name}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {pdf.pageCount} page{pdf.pageCount > 1 ? "s" : ""} &middot;{" "}
          {formatBytes(pdf.size)}
        </p>
      </div>
      <button
        onClick={onClear}
        className="p-1 rounded"
        style={{ color: "var(--muted)" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Merge
// ---------------------------------------------------------------------------

function MergeTab() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleFiles = useCallback(async (incoming: File[]) => {
    setLoading(true);
    try {
      const loaded = await Promise.all(incoming.map(loadPdfFile));
      setFiles((prev) => [...prev, ...loaded]);
    } catch {
      alert("Failed to load one or more PDFs.");
    }
    setLoading(false);
  }, []);

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const merge = async () => {
    if (files.length < 2) return;
    setMerging(true);
    try {
      const merged = await PDFDocument.create();
      for (const f of files) {
        const doc = await PDFDocument.load(f.arrayBuffer);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), "merged.pdf");
    } catch {
      alert("Failed to merge PDFs.");
    }
    setMerging(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      <UploadZone
        onFiles={handleFiles}
        multiple
        label="Drop PDF files here to merge (multiple files)"
      />
      {loading && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading files...
        </p>
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            {files.length} file{files.length > 1 ? "s" : ""} &mdash; drag to
            reorder
          </p>
          {files.map((f, idx) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              className="flex items-center gap-3 rounded-lg p-3 border transition-colors"
              style={{
                borderColor:
                  dragOverIdx === idx ? "var(--accent)" : "var(--border)",
                background:
                  dragOverIdx === idx
                    ? "var(--surface-hover)"
                    : "var(--surface)",
              }}
            >
              <GripVertical
                className="w-4 h-4 shrink-0 cursor-grab"
                style={{ color: "var(--muted)" }}
              />
              <FileText
                className="w-5 h-5 shrink-0"
                style={{ color: "var(--accent)" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {f.pageCount} page{f.pageCount > 1 ? "s" : ""} &middot;{" "}
                  {formatBytes(f.size)}
                </p>
              </div>
              <button
                onClick={() => removeFile(f.id)}
                className="p-1 rounded hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length >= 2 && (
        <div className="flex items-center gap-3 pt-2">
          <ActionButton onClick={merge} disabled={merging}>
            <Merge className="w-4 h-4" />
            {merging ? "Merging..." : "Merge PDFs"}
          </ActionButton>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Output: {files.reduce((s, f) => s + f.pageCount, 0)} pages
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Split
// ---------------------------------------------------------------------------

type SplitMode = "every-n" | "specific" | "individual";

function SplitTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [mode, setMode] = useState<SplitMode>("every-n");
  const [everyN, setEveryN] = useState(1);
  const [specificPages, setSpecificPages] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      setPdf(await loadPdfFile(files[0]));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const getSplitGroups = (): number[][] => {
    if (!pdf) return [];
    const total = pdf.pageCount;
    if (mode === "individual") {
      return Array.from({ length: total }, (_, i) => [i]);
    }
    if (mode === "every-n") {
      const groups: number[][] = [];
      for (let i = 0; i < total; i += everyN) {
        const group: number[] = [];
        for (let j = i; j < Math.min(i + everyN, total); j++) group.push(j);
        groups.push(group);
      }
      return groups;
    }
    // specific
    const splitAt = specificPages
      .split(",")
      .map((s) => Number(s.trim()) - 1)
      .filter((n) => !isNaN(n) && n > 0 && n < total)
      .sort((a, b) => a - b);
    const groups: number[][] = [];
    let start = 0;
    for (const sp of splitAt) {
      const group: number[] = [];
      for (let i = start; i < sp; i++) group.push(i);
      if (group.length) groups.push(group);
      start = sp;
    }
    const last: number[] = [];
    for (let i = start; i < total; i++) last.push(i);
    if (last.length) groups.push(last);
    return groups;
  };

  const groups = pdf ? getSplitGroups() : [];

  const doSplit = async () => {
    if (!pdf || groups.length === 0) return;
    setSplitting(true);
    try {
      const source = await PDFDocument.load(pdf.arrayBuffer);
      for (let g = 0; g < groups.length; g++) {
        const newDoc = await PDFDocument.create();
        const pages = await newDoc.copyPages(source, groups[g]);
        pages.forEach((p) => newDoc.addPage(p));
        const bytes = await newDoc.save();
        const baseName = pdf.name.replace(/\.pdf$/i, "");
        downloadBlob(
          new Blob([bytes], { type: "application/pdf" }),
          `${baseName}_part${g + 1}.pdf`
        );
      }
    } catch {
      alert("Failed to split PDF.");
    }
    setSplitting(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone onFiles={handleFile} label="Drop a PDF file to split" />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar pdf={pdf} onClear={() => setPdf(null)} />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Split mode
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["every-n", "Every N pages"],
                  ["specific", "At specific pages"],
                  ["individual", "Individual pages"],
                ] as [SplitMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background:
                      mode === key ? "var(--accent)" : "var(--surface)",
                    color: mode === key ? "#fff" : "var(--foreground)",
                    border:
                      mode === key
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "every-n" && (
              <div className="flex items-center gap-2">
                <label className="text-sm" style={{ color: "var(--muted)" }}>
                  Pages per file:
                </label>
                <input
                  type="number"
                  min={1}
                  max={pdf.pageCount}
                  value={everyN}
                  onChange={(e) =>
                    setEveryN(
                      Math.max(1, Math.min(pdf.pageCount, Number(e.target.value)))
                    )
                  }
                  className="w-20 px-2 py-1 rounded border text-sm"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            )}

            {mode === "specific" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: "var(--muted)" }}>
                  Split before page numbers (comma-separated, e.g. 3,5,8):
                </label>
                <input
                  type="text"
                  value={specificPages}
                  onChange={(e) => setSpecificPages(e.target.value)}
                  placeholder="e.g. 3,5,8"
                  className="w-full px-3 py-1.5 rounded border text-sm"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            )}
          </div>

          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted)" }}
              >
                Preview &mdash; {groups.length} output file
                {groups.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto">
                {groups.map((g, gi) => (
                  <div
                    key={gi}
                    className="rounded-md border px-3 py-2 text-xs"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <span className="font-semibold">Part {gi + 1}:</span>{" "}
                    <span style={{ color: "var(--muted)" }}>
                      {g.length === 1
                        ? `Page ${g[0] + 1}`
                        : `Pages ${g[0] + 1}-${g[g.length - 1] + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <ActionButton
              onClick={doSplit}
              disabled={splitting || groups.length === 0}
            >
              <Scissors className="w-4 h-4" />
              {splitting ? "Splitting..." : "Split PDF"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Rotate
// ---------------------------------------------------------------------------

function RotateTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      const loaded = await loadPdfFile(files[0]);
      setPdf(loaded);
      setPages(getPageThumbs(loaded.pageCount));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const toggleSelect = (idx: number) =>
    setPages((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, selected: !p.selected } : p
      )
    );

  const selectAll = () =>
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  const selectNone = () =>
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));

  const hasSelected = pages.some((p) => p.selected);

  const rotate = (deg: number) =>
    setPages((prev) =>
      prev.map((p) =>
        p.selected ? { ...p, rotation: (p.rotation + deg + 360) % 360 } : p
      )
    );

  const save = async () => {
    if (!pdf) return;
    setSaving(true);
    try {
      const doc = await PDFDocument.load(pdf.arrayBuffer);
      for (const p of pages) {
        if (p.rotation !== 0) {
          doc.getPage(p.index).setRotation(degrees(p.rotation));
        }
      }
      const bytes = await doc.save();
      const name = pdf.name.replace(/\.pdf$/i, "_rotated.pdf");
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
    } catch {
      alert("Failed to rotate PDF.");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to rotate its pages"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar
            pdf={pdf}
            onClear={() => {
              setPdf(null);
              setPages([]);
            }}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              Selection:
            </span>
            <ActionButton onClick={selectAll} variant="secondary">
              Select all
            </ActionButton>
            <ActionButton onClick={selectNone} variant="secondary">
              Clear
            </ActionButton>
            <span
              className="text-xs ml-2"
              style={{ color: "var(--muted)" }}
            >
              {pages.filter((p) => p.selected).length} selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              Rotate selected:
            </span>
            <ActionButton
              onClick={() => rotate(90)}
              variant="secondary"
              disabled={!hasSelected}
            >
              <RotateCw className="w-4 h-4" /> 90 CW
            </ActionButton>
            <ActionButton
              onClick={() => rotate(-90)}
              variant="secondary"
              disabled={!hasSelected}
            >
              <RotateCcw className="w-4 h-4" /> 90 CCW
            </ActionButton>
            <ActionButton
              onClick={() => rotate(180)}
              variant="secondary"
              disabled={!hasSelected}
            >
              <FlipVertical className="w-4 h-4" /> 180
            </ActionButton>
          </div>

          <div className="flex flex-wrap gap-3 overflow-auto flex-1 content-start">
            {pages.map((p) => (
              <div key={p.index} className="flex flex-col items-center gap-1">
                <PageCard
                  page={p}
                  onClick={() => toggleSelect(p.index)}
                  size="md"
                />
                {p.rotation !== 0 && (
                  <span
                    className="text-[10px] font-medium rounded px-1.5 py-0.5"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    {p.rotation}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton
              onClick={save}
              disabled={saving || !pages.some((p) => p.rotation !== 0)}
            >
              <Download className="w-4 h-4" />
              {saving ? "Saving..." : "Download Rotated PDF"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Reorder
// ---------------------------------------------------------------------------

function ReorderTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      const loaded = await loadPdfFile(files[0]);
      setPdf(loaded);
      setPages(getPageThumbs(loaded.pageCount));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    setPages((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const removePage = (idx: number) =>
    setPages((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!pdf || pages.length === 0) return;
    setSaving(true);
    try {
      const source = await PDFDocument.load(pdf.arrayBuffer);
      const newDoc = await PDFDocument.create();
      const indices = pages.map((p) => p.index);
      const copied = await newDoc.copyPages(source, indices);
      copied.forEach((p) => newDoc.addPage(p));
      const bytes = await newDoc.save();
      const name = pdf.name.replace(/\.pdf$/i, "_reordered.pdf");
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
    } catch {
      alert("Failed to reorder PDF.");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to reorder its pages"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar
            pdf={pdf}
            onClear={() => {
              setPdf(null);
              setPages([]);
            }}
          />

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Drag pages to reorder. Click the X to remove a page.
          </p>

          <div className="flex flex-wrap gap-3 overflow-auto flex-1 content-start">
            {pages.map((p, idx) => (
              <div
                key={`${p.index}-${idx}`}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => {
                  setDragIdx(null);
                  setDragOverIdx(null);
                }}
                className="relative"
                style={{
                  opacity: dragIdx === idx ? 0.4 : 1,
                  transform:
                    dragOverIdx === idx ? "scale(1.05)" : undefined,
                  transition: "transform 0.15s ease",
                }}
              >
                <PageCard
                  page={{ ...p, selected: dragOverIdx === idx }}
                  showRemove
                  onRemove={() => removePage(idx)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton
              onClick={save}
              disabled={saving || pages.length === 0}
            >
              <Download className="w-4 h-4" />
              {saving ? "Saving..." : "Download Reordered PDF"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Extract
// ---------------------------------------------------------------------------

function ExtractTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rangeInput, setRangeInput] = useState("");

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      const loaded = await loadPdfFile(files[0]);
      setPdf(loaded);
      setPages(getPageThumbs(loaded.pageCount));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const toggleSelect = (idx: number) =>
    setPages((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, selected: !p.selected } : p
      )
    );

  const applyRange = () => {
    if (!pdf) return;
    const selected = parsePageRanges(rangeInput, pdf.pageCount);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        selected: selected.includes(p.label),
      }))
    );
  };

  const selectedCount = pages.filter((p) => p.selected).length;

  const save = async () => {
    if (!pdf) return;
    const indices = pages.filter((p) => p.selected).map((p) => p.index);
    if (indices.length === 0) return;
    setSaving(true);
    try {
      const source = await PDFDocument.load(pdf.arrayBuffer);
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(source, indices);
      copied.forEach((p) => newDoc.addPage(p));
      const bytes = await newDoc.save();
      const name = pdf.name.replace(/\.pdf$/i, "_extracted.pdf");
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
    } catch {
      alert("Failed to extract pages.");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to extract pages from"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar
            pdf={pdf}
            onClear={() => {
              setPdf(null);
              setPages([]);
              setRangeInput("");
            }}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1-3,5,7-9"
              className="px-3 py-1.5 rounded border text-sm flex-1 min-w-[160px]"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
              onKeyDown={(e) => e.key === "Enter" && applyRange()}
            />
            <ActionButton onClick={applyRange} variant="secondary">
              Apply range
            </ActionButton>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {selectedCount} selected
            </span>
          </div>

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Click pages to toggle selection, or type a range above.
          </p>

          <div className="flex flex-wrap gap-3 overflow-auto flex-1 content-start">
            {pages.map((p) => (
              <PageCard
                key={p.index}
                page={p}
                onClick={() => toggleSelect(p.index)}
                size="sm"
              />
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton
              onClick={save}
              disabled={saving || selectedCount === 0}
            >
              <Download className="w-4 h-4" />
              {saving ? "Extracting..." : `Extract ${selectedCount} Page${selectedCount !== 1 ? "s" : ""}`}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Images to PDF
// ---------------------------------------------------------------------------

type PageSize = "a4" | "letter" | "fit";
type Orientation = "portrait" | "landscape" | "auto";
type ImageFit = "fill" | "fit" | "stretch";

const PAGE_SIZES: Record<string, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

function ImagesToPdfTab() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [margin, setMargin] = useState(20);
  const [imageFit, setImageFit] = useState<ImageFit>("fit");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) {
      alert("Please select image files (PNG, JPEG, or WebP).");
      return;
    }
    setLoading(true);
    try {
      const loaded = await Promise.all(imageFiles.map(loadImageFile));
      setImages((prev) => [...prev, ...loaded]);
    } catch {
      alert("Failed to load one or more images.");
    }
    setLoading(false);
  }, []);

  const removeImage = (id: string) =>
    setImages((prev) => prev.filter((img) => img.id !== id));

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(idx, 0, item);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const createPdf = async () => {
    if (images.length === 0) return;
    setCreating(true);
    try {
      const doc = await PDFDocument.create();

      for (const img of images) {
        const imgBytes = await img.file.arrayBuffer();
        let embeddedImg;
        if (img.file.type === "image/png") {
          embeddedImg = await doc.embedPng(imgBytes);
        } else {
          // JPEG and WebP — for WebP we convert via canvas
          if (img.file.type === "image/webp") {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d")!;
            const bitmap = await createImageBitmap(img.file);
            ctx.drawImage(bitmap, 0, 0);
            const jpegBlob = await new Promise<Blob>((res) =>
              canvas.toBlob((b) => res(b!), "image/jpeg", 0.92)
            );
            const jpegBytes = await jpegBlob.arrayBuffer();
            embeddedImg = await doc.embedJpg(jpegBytes);
          } else {
            embeddedImg = await doc.embedJpg(imgBytes);
          }
        }

        const imgW = embeddedImg.width;
        const imgH = embeddedImg.height;

        let pw: number, ph: number;

        if (pageSize === "fit") {
          pw = imgW + margin * 2;
          ph = imgH + margin * 2;
        } else {
          const sz = PAGE_SIZES[pageSize];
          const isLandscape =
            orientation === "landscape" ||
            (orientation === "auto" && imgW > imgH);
          pw = isLandscape ? Math.max(sz.w, sz.h) : Math.min(sz.w, sz.h);
          ph = isLandscape ? Math.min(sz.w, sz.h) : Math.max(sz.w, sz.h);
        }

        const page = doc.addPage([pw, ph]);
        const availW = pw - margin * 2;
        const availH = ph - margin * 2;

        let drawW: number, drawH: number;

        if (imageFit === "stretch") {
          drawW = availW;
          drawH = availH;
        } else if (imageFit === "fill") {
          const scale = Math.max(availW / imgW, availH / imgH);
          drawW = imgW * scale;
          drawH = imgH * scale;
        } else {
          // fit
          const scale = Math.min(availW / imgW, availH / imgH);
          drawW = imgW * scale;
          drawH = imgH * scale;
        }

        const x = margin + (availW - drawW) / 2;
        const y = margin + (availH - drawH) / 2;

        page.drawImage(embeddedImg, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }

      const bytes = await doc.save();
      downloadBlob(
        new Blob([bytes], { type: "application/pdf" }),
        "images.pdf"
      );
    } catch (err) {
      console.error(err);
      alert("Failed to create PDF from images.");
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      <UploadZone
        onFiles={handleFiles}
        multiple
        label="Drop images here (PNG, JPEG, WebP)"
        accept="image/png,image/jpeg,image/webp"
      />
      {loading && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading images...
        </p>
      )}

      {images.length > 0 && (
        <>
          {/* Controls */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg p-3 border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Page Size
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as PageSize)}
                className="px-2 py-1.5 rounded border text-xs"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="fit">Fit to Image</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Orientation
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                className="px-2 py-1.5 rounded border text-xs"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                disabled={pageSize === "fit"}
              >
                <option value="auto">Auto</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Image Fit
              </label>
              <select
                value={imageFit}
                onChange={(e) => setImageFit(e.target.value as ImageFit)}
                className="px-2 py-1.5 rounded border text-xs"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="fit">Fit (contain)</option>
                <option value="fill">Fill (cover)</option>
                <option value="stretch">Stretch</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Margin: {margin}pt
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          </div>

          {/* Image list */}
          <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            {images.length} image{images.length > 1 ? "s" : ""} &mdash; drag to reorder
          </p>
          <div className="flex flex-wrap gap-3 overflow-auto flex-1 content-start">
            {images.map((img, idx) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => {
                  setDragIdx(null);
                  setDragOverIdx(null);
                }}
                className="relative w-28 h-36 rounded-lg border overflow-hidden cursor-grab shrink-0 group"
                style={{
                  borderColor: dragOverIdx === idx ? "var(--accent)" : "var(--border)",
                  opacity: dragIdx === idx ? 0.4 : 1,
                  boxShadow: dragOverIdx === idx ? "0 0 0 2px var(--accent)" : "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] truncate font-medium"
                  style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                >
                  {idx + 1}. {img.name}
                </div>
                <button
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "#ef4444" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton onClick={createPdf} disabled={creating}>
              <Download className="w-4 h-4" />
              {creating ? "Creating..." : `Create PDF (${images.length} page${images.length > 1 ? "s" : ""})`}
            </ActionButton>
            <ActionButton
              onClick={() => setImages([])}
              variant="secondary"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: PDF to Images
// ---------------------------------------------------------------------------

function PdfToImagesTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [pageRange, setPageRange] = useState("");
  const [dpi, setDpi] = useState<number>(150);

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      setPdf(await loadPdfFile(files[0]));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const getTargetPages = (): number[] => {
    if (!pdf) return [];
    if (!pageRange.trim()) {
      return Array.from({ length: pdf.pageCount }, (_, i) => i);
    }
    return parsePageRanges(pageRange, pdf.pageCount).map((n) => n - 1);
  };

  const extractAsImages = async () => {
    if (!pdf) return;
    const targetPages = getTargetPages();
    if (targetPages.length === 0) return;
    setExtracting(true);
    try {
      const source = await PDFDocument.load(pdf.arrayBuffer);
      const scale = dpi / 72;

      for (const pageIdx of targetPages) {
        const page = source.getPage(pageIdx);
        const { width, height } = page.getSize();
        const canvasW = Math.round(width * scale);
        const canvasH = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d")!;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Draw styled placeholder since pdf-lib cannot render pages
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Border
        ctx.strokeStyle = "#dee2e6";
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(
          10 * scale,
          10 * scale,
          canvasW - 20 * scale,
          canvasH - 20 * scale
        );

        // Page icon
        const iconSize = 40 * scale;
        const cx = canvasW / 2;
        const cy = canvasH / 2 - 20 * scale;
        ctx.fillStyle = "#adb5bd";
        ctx.fillRect(cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize * 1.3);
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(
          cx - iconSize / 2 + 4 * scale,
          cy - iconSize / 2 + 4 * scale,
          iconSize - 8 * scale,
          iconSize * 1.3 - 8 * scale
        );

        // Page number text
        ctx.fillStyle = "#495057";
        ctx.font = `bold ${20 * scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`Page ${pageIdx + 1}`, cx, cy + iconSize);

        // Info text
        ctx.fillStyle = "#868e96";
        ctx.font = `${12 * scale}px sans-serif`;
        ctx.fillText(
          `${Math.round(width)} x ${Math.round(height)} pt | ${dpi} DPI`,
          cx,
          cy + iconSize + 24 * scale
        );
        ctx.fillText(
          "Full rendering requires pdf.js",
          cx,
          cy + iconSize + 42 * scale
        );

        const blob = await new Promise<Blob>((res) =>
          canvas.toBlob((b) => res(b!), "image/png")
        );
        const baseName = pdf.name.replace(/\.pdf$/i, "");
        downloadBlob(blob, `${baseName}_page${pageIdx + 1}.png`);
      }
    } catch {
      alert("Failed to generate images.");
    }
    setExtracting(false);
  };

  const extractAsIndividualPdfs = async () => {
    if (!pdf) return;
    const targetPages = getTargetPages();
    if (targetPages.length === 0) return;
    setExtracting(true);
    try {
      const source = await PDFDocument.load(pdf.arrayBuffer);
      for (const pageIdx of targetPages) {
        const newDoc = await PDFDocument.create();
        const [copiedPage] = await newDoc.copyPages(source, [pageIdx]);
        newDoc.addPage(copiedPage);
        const bytes = await newDoc.save();
        const baseName = pdf.name.replace(/\.pdf$/i, "");
        downloadBlob(
          new Blob([bytes], { type: "application/pdf" }),
          `${baseName}_page${pageIdx + 1}.pdf`
        );
      }
    } catch {
      alert("Failed to extract pages.");
    }
    setExtracting(false);
  };

  const targetCount = pdf ? getTargetPages().length : 0;

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to extract pages as images"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar pdf={pdf} onClear={() => setPdf(null)} />

          <div
            className="flex flex-col gap-3 rounded-lg p-3 border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Resolution (DPI)
                </label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  className="px-2 py-1.5 rounded border text-xs"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value={72}>72 DPI (Screen)</option>
                  <option value={150}>150 DPI (Standard)</option>
                  <option value={300}>300 DPI (Print)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Page Range (leave empty for all)
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder={`e.g. 1-3,5 (max ${pdf.pageCount})`}
                  className="px-2 py-1.5 rounded border text-xs"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {targetCount} page{targetCount !== 1 ? "s" : ""} selected
            </p>
          </div>

          <div
            className="rounded-lg p-3 border text-xs"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-hover)",
              color: "var(--muted)",
            }}
          >
            <strong>Note:</strong> pdf-lib cannot render PDF pages to images.
            The &quot;Download as PNG&quot; option creates placeholder images with page dimensions.
            For actual visual rendering, use the &quot;Extract as Individual PDFs&quot; option to get
            each page as a separate PDF file, which can be opened in any PDF viewer.
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <ActionButton
              onClick={extractAsImages}
              disabled={extracting || targetCount === 0}
            >
              <ImageDown className="w-4 h-4" />
              {extracting ? "Extracting..." : `Download as PNG (${targetCount})`}
            </ActionButton>
            <ActionButton
              onClick={extractAsIndividualPdfs}
              disabled={extracting || targetCount === 0}
              variant="secondary"
            >
              <Download className="w-4 h-4" />
              Extract as Individual PDFs
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Page Numbers
// ---------------------------------------------------------------------------

type NumberPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

type NumberFormat = "1" | "Page 1" | "1 of N" | "Page 1 of N";

function formatPageNumber(
  pageNum: number,
  totalPages: number,
  format: NumberFormat
): string {
  switch (format) {
    case "1":
      return `${pageNum}`;
    case "Page 1":
      return `Page ${pageNum}`;
    case "1 of N":
      return `${pageNum} of ${totalPages}`;
    case "Page 1 of N":
      return `Page ${pageNum} of ${totalPages}`;
  }
}

function PageNumbersTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [fontSize, setFontSize] = useState(12);
  const [startNumber, setStartNumber] = useState(1);
  const [numFormat, setNumFormat] = useState<NumberFormat>("1");
  const [color, setColor] = useState("#000000");
  const [marginFromEdge, setMarginFromEdge] = useState(30);

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      setPdf(await loadPdfFile(files[0]));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const addPageNumbers = async () => {
    if (!pdf) return;
    setSaving(true);
    try {
      const doc = await PDFDocument.load(pdf.arrayBuffer);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const { r, g, b } = hexToRgb(color);
      const totalPages = pages.length;

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const pageNum = i + startNumber;
        const text = formatPageNumber(pageNum, totalPages + startNumber - 1, numFormat);
        const textWidth = font.widthOfTextAtSize(text, fontSize);

        let x: number;
        let y: number;

        // Calculate x position
        if (position.includes("left")) {
          x = marginFromEdge;
        } else if (position.includes("right")) {
          x = width - textWidth - marginFromEdge;
        } else {
          x = (width - textWidth) / 2;
        }

        // Calculate y position
        if (position.startsWith("top")) {
          y = height - marginFromEdge - fontSize;
        } else {
          y = marginFromEdge;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(r, g, b),
        });
      });

      const bytes = await doc.save();
      const name = pdf.name.replace(/\.pdf$/i, "_numbered.pdf");
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
    } catch {
      alert("Failed to add page numbers.");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to add page numbers"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar pdf={pdf} onClear={() => setPdf(null)} />

          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg p-3 border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Position
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as NumberPosition)}
                className="px-2 py-1.5 rounded border text-xs"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-center">Top Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Format
              </label>
              <select
                value={numFormat}
                onChange={(e) => setNumFormat(e.target.value as NumberFormat)}
                className="px-2 py-1.5 rounded border text-xs"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                <option value="1">1</option>
                <option value="Page 1">Page 1</option>
                <option value="1 of N">1 of N</option>
                <option value="Page 1 of N">Page 1 of N</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Font Size: {fontSize}px
              </label>
              <input
                type="range"
                min={8}
                max={24}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Start Number
              </label>
              <input
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))}
                className="px-2 py-1.5 rounded border text-xs"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                />
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                  {color}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Margin: {marginFromEdge}pt
              </label>
              <input
                type="range"
                min={10}
                max={80}
                value={marginFromEdge}
                onChange={(e) => setMarginFromEdge(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          </div>

          {/* Preview */}
          <div
            className="rounded-lg p-3 border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--muted)" }}>
              Preview
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[0, 1, 2].filter((i) => i < pdf.pageCount).map((i) => {
                const text = formatPageNumber(i + startNumber, pdf.pageCount + startNumber - 1, numFormat);
                return (
                  <div
                    key={i}
                    className="w-20 h-28 rounded border relative flex items-center justify-center"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                    }}
                  >
                    <FileText className="w-5 h-5 opacity-20" />
                    <span
                      className="absolute text-[8px] font-medium"
                      style={{
                        color,
                        ...(position.startsWith("top")
                          ? { top: 4 }
                          : { bottom: 4 }),
                        ...(position.includes("left")
                          ? { left: 4 }
                          : position.includes("right")
                          ? { right: 4 }
                          : { left: "50%", transform: "translateX(-50%)" }),
                      }}
                    >
                      {text}
                    </span>
                  </div>
                );
              })}
              {pdf.pageCount > 3 && (
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  ...and {pdf.pageCount - 3} more
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton onClick={addPageNumbers} disabled={saving}>
              <Hash className="w-4 h-4" />
              {saving ? "Adding..." : "Add Page Numbers"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Watermark
// ---------------------------------------------------------------------------

type WatermarkPosition = "center" | "diagonal" | "top" | "bottom" | "tile";

function WatermarkTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#888888");
  const [opacity, setOpacity] = useState(0.2);
  const [rotation, setRotation] = useState(-45);
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>("diagonal");
  const [repeat, setRepeat] = useState(false);

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      setPdf(await loadPdfFile(files[0]));
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const addWatermark = async () => {
    if (!pdf || !text.trim()) return;
    setSaving(true);
    try {
      const doc = await PDFDocument.load(pdf.arrayBuffer);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();
      const { r, g, b } = hexToRgb(color);

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);

        if (repeat || wmPosition === "tile") {
          // Tile watermark across the page
          const spacingX = textWidth + 60;
          const spacingY = fontSize * 3;
          for (let y = -height; y < height * 2; y += spacingY) {
            for (let x = -width; x < width * 2; x += spacingX) {
              page.drawText(text, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(r, g, b),
                opacity,
                rotate: degrees(rotation),
              });
            }
          }
        } else {
          let x: number;
          let y: number;
          let rot = rotation;

          switch (wmPosition) {
            case "diagonal":
              x = (width - textWidth) / 2;
              y = height / 2;
              rot = -45;
              break;
            case "center":
              x = (width - textWidth) / 2;
              y = height / 2;
              rot = 0;
              break;
            case "top":
              x = (width - textWidth) / 2;
              y = height - 60;
              rot = 0;
              break;
            case "bottom":
              x = (width - textWidth) / 2;
              y = 40;
              rot = 0;
              break;
            default:
              x = (width - textWidth) / 2;
              y = height / 2;
          }

          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity,
            rotate: degrees(rot),
          });
        }
      });

      const bytes = await doc.save();
      const name = pdf.name.replace(/\.pdf$/i, "_watermarked.pdf");
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
    } catch {
      alert("Failed to add watermark.");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to add a watermark"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar pdf={pdf} onClear={() => setPdf(null)} />

          <div
            className="flex flex-col gap-3 rounded-lg p-3 border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {/* Text input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Watermark Text
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter watermark text"
                className="px-3 py-1.5 rounded border text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Position
                </label>
                <select
                  value={wmPosition}
                  onChange={(e) => setWmPosition(e.target.value as WatermarkPosition)}
                  className="px-2 py-1.5 rounded border text-xs"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="diagonal">Diagonal</option>
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="tile">Tile (Repeat)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Font Size: {fontSize}px
                </label>
                <input
                  type="range"
                  min={12}
                  max={72}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Opacity: {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Rotation: {rotation}deg
                </label>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                  disabled={wmPosition === "diagonal"}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {color}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                  Repeat / Tile
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeat || wmPosition === "tile"}
                    onChange={(e) => setRepeat(e.target.checked)}
                    disabled={wmPosition === "tile"}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-xs">Tile across page</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div
            className="rounded-lg p-3 border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--muted)" }}>
              Preview
            </p>
            <div className="flex justify-center">
              <div
                className="w-40 h-56 rounded border relative overflow-hidden flex items-center justify-center"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <FileText className="w-10 h-10 opacity-10" />
                {(repeat || wmPosition === "tile") ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden"
                  >
                    {Array.from({ length: 5 }).map((_, row) => (
                      <div key={row} className="flex gap-4">
                        {Array.from({ length: 3 }).map((_, col) => (
                          <span
                            key={col}
                            className="text-[8px] font-bold whitespace-nowrap"
                            style={{
                              color,
                              opacity,
                              transform: `rotate(${wmPosition === "diagonal" ? -45 : rotation}deg)`,
                            }}
                          >
                            {text}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span
                    className="absolute text-[10px] font-bold whitespace-nowrap"
                    style={{
                      color,
                      opacity,
                      transform: `rotate(${wmPosition === "diagonal" ? -45 : rotation}deg)`,
                      ...(wmPosition === "top"
                        ? { top: 12 }
                        : wmPosition === "bottom"
                        ? { bottom: 12 }
                        : {}),
                    }}
                  >
                    {text}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton onClick={addWatermark} disabled={saving || !text.trim()}>
              <Droplets className="w-4 h-4" />
              {saving ? "Adding..." : "Add Watermark"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Compress Info (Metadata)
// ---------------------------------------------------------------------------

function InfoTab() {
  const [pdf, setPdf] = useState<PdfFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({
    title: "",
    author: "",
    subject: "",
    creator: "",
    producer: "",
    version: "",
  });

  const handleFile = useCallback(async (files: File[]) => {
    setLoading(true);
    try {
      const loaded = await loadPdfFile(files[0]);
      setPdf(loaded);
      const doc = await PDFDocument.load(loaded.arrayBuffer, {
        ignoreEncryption: true,
      });
      setMeta({
        title: doc.getTitle() || "",
        author: doc.getAuthor() || "",
        subject: doc.getSubject() || "",
        creator: doc.getCreator() || "",
        producer: doc.getProducer() || "",
        version: `${(doc as unknown as Record<string, unknown>).constructor?.name || "PDF"} (loaded)`,
      });
    } catch {
      alert("Failed to load PDF.");
    }
    setLoading(false);
  }, []);

  const saveMeta = async () => {
    if (!pdf) return;
    setSaving(true);
    try {
      const doc = await PDFDocument.load(pdf.arrayBuffer);
      if (meta.title) doc.setTitle(meta.title);
      if (meta.author) doc.setAuthor(meta.author);
      if (meta.subject) doc.setSubject(meta.subject);
      if (meta.creator) doc.setCreator(meta.creator);
      const bytes = await doc.save();
      const name = pdf.name.replace(/\.pdf$/i, "_updated.pdf");
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
    } catch {
      alert("Failed to save metadata.");
    }
    setSaving(false);
  };

  const MetaRow = ({
    label,
    field,
    editable = true,
  }: {
    label: string;
    field: keyof typeof meta;
    editable?: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <label
        className="text-xs font-medium w-24 shrink-0 text-right"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </label>
      {editable ? (
        <input
          type="text"
          value={meta[field]}
          onChange={(e) =>
            setMeta((prev) => ({ ...prev, [field]: e.target.value }))
          }
          className="flex-1 px-3 py-1.5 rounded border text-sm"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
      ) : (
        <span className="text-sm" style={{ color: "var(--foreground)" }}>
          {meta[field] || "N/A"}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-auto p-4">
      {!pdf ? (
        <>
          <UploadZone
            onFiles={handleFile}
            label="Drop a PDF to view and edit metadata"
          />
          {loading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Loading...
            </p>
          )}
        </>
      ) : (
        <>
          <PdfFileBar
            pdf={pdf}
            onClear={() => {
              setPdf(null);
              setMeta({
                title: "",
                author: "",
                subject: "",
                creator: "",
                producer: "",
                version: "",
              });
            }}
          />

          <div
            className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg p-4 border"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Pages
              </span>
              <span className="text-lg font-bold">{pdf.pageCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                File size
              </span>
              <span className="text-lg font-bold">{formatBytes(pdf.size)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Producer
              </span>
              <span className="text-sm truncate">{meta.producer || "N/A"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
                Creator
              </span>
              <span className="text-sm truncate">{meta.creator || "N/A"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              Edit metadata
            </p>
            <MetaRow label="Title" field="title" />
            <MetaRow label="Author" field="author" />
            <MetaRow label="Subject" field="subject" />
            <MetaRow label="Creator" field="creator" />
          </div>

          <div
            className="rounded-lg p-3 border text-xs"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-hover)",
              color: "var(--muted)",
            }}
          >
            <strong>Note:</strong> True PDF compression (re-encoding images,
            removing unused objects) requires advanced processing beyond what
            browsers can do efficiently. This tab lets you inspect file details
            and edit metadata. The saved file may differ slightly in size due to
            re-serialization by pdf-lib.
          </div>

          <div className="flex items-center gap-3 pt-2">
            <ActionButton onClick={saveMeta} disabled={saving}>
              <Download className="w-4 h-4" />
              {saving ? "Saving..." : "Download with Updated Metadata"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PdfToolkitPage() {
  const [activeTab, setActiveTab] = useState<Tab>("merge");

  const renderTab = () => {
    switch (activeTab) {
      case "merge":
        return <MergeTab />;
      case "split":
        return <SplitTab />;
      case "rotate":
        return <RotateTab />;
      case "reorder":
        return <ReorderTab />;
      case "extract":
        return <ExtractTab />;
      case "images-to-pdf":
        return <ImagesToPdfTab />;
      case "pdf-to-images":
        return <PdfToImagesTab />;
      case "page-numbers":
        return <PageNumbersTab />;
      case "watermark":
        return <WatermarkTab />;
      case "info":
        return <InfoTab />;
    }
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <header
        className="shrink-0 flex items-center gap-3 px-4 py-2 border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="Back to tools"
        >
          <ArrowLeft className="w-4 h-4" style={{ color: "var(--muted)" }} />
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h1 className="text-sm font-semibold">PDF Toolkit</h1>
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="shrink-0 flex items-center gap-1 px-4 py-1.5 border-b overflow-x-auto"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              background:
                activeTab === tab.key ? "var(--accent)" : "transparent",
              color: activeTab === tab.key ? "#fff" : "var(--muted)",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">{renderTab()}</main>
    </div>
  );
}

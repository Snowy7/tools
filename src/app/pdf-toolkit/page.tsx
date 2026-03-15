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
} from "lucide-react";
import { PDFDocument, degrees } from "pdf-lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "merge" | "split" | "rotate" | "reorder" | "extract" | "info";

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

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "merge", label: "Merge", icon: <Merge className="w-4 h-4" /> },
  { key: "split", label: "Split", icon: <Scissors className="w-4 h-4" /> },
  { key: "rotate", label: "Rotate", icon: <RotateCw className="w-4 h-4" /> },
  {
    key: "reorder",
    label: "Reorder",
    icon: <GripVertical className="w-4 h-4" />,
  },
  {
    key: "extract",
    label: "Extract Pages",
    icon: <Copy className="w-4 h-4" />,
  },
  { key: "info", label: "Compress Info", icon: <Info className="w-4 h-4" /> },
];

function UploadZone({
  onFiles,
  multiple = false,
  label,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf"
      );
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
        accept="application/pdf"
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
                {pdf.pageCount} pages &middot; {formatBytes(pdf.size)}
              </p>
            </div>
            <button
              onClick={() => setPdf(null)}
              className="p-1 rounded"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                {pdf.pageCount} pages &middot; {formatBytes(pdf.size)}
              </p>
            </div>
            <button
              onClick={() => {
                setPdf(null);
                setPages([]);
              }}
              className="p-1 rounded"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                {pages.length} of {pdf.pageCount} pages remaining
              </p>
            </div>
            <button
              onClick={() => {
                setPdf(null);
                setPages([]);
              }}
              className="p-1 rounded"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                {pdf.pageCount} pages &middot; {formatBytes(pdf.size)}
              </p>
            </div>
            <button
              onClick={() => {
                setPdf(null);
                setPages([]);
                setRangeInput("");
              }}
              className="p-1 rounded"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
                {pdf.pageCount} pages &middot; {formatBytes(pdf.size)}
              </p>
            </div>
            <button
              onClick={() => {
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
              className="p-1 rounded"
              style={{ color: "var(--muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
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

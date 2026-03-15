"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Clock,
  Download,
  FileText,
  Film,
  Import,
  Minus,
  MoveHorizontal,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubtitleEntry {
  id: string;
  start: string; // HH:MM:SS,mmm
  end: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function timeToMs(time: string): number {
  // HH:MM:SS,mmm or HH:MM:SS.mmm
  const match = time.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
}

function msToTime(ms: number): string {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  ms %= 3600000;
  const m = Math.floor(ms / 60000);
  ms %= 60000;
  const s = Math.floor(ms / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
}

function defaultStart(entries: SubtitleEntry[]): string {
  if (entries.length === 0) return "00:00:01,000";
  const lastEnd = timeToMs(entries[entries.length - 1].end);
  return msToTime(lastEnd + 500);
}

function defaultEnd(start: string): string {
  return msToTime(timeToMs(start) + 2000);
}

function parseSRT(text: string): SubtitleEntry[] {
  const blocks = text.trim().split(/\n\n+/);
  const entries: SubtitleEntry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Line 0: index (skip)
    // Line 1: timing
    const timingMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/,
    );
    if (!timingMatch) continue;

    const start = timingMatch[1].replace(".", ",");
    const end = timingMatch[2].replace(".", ",");
    const text = lines.slice(2).join("\n");

    entries.push({ id: uid(), start, end, text });
  }

  return entries;
}

function entriesToSRT(entries: SubtitleEntry[]): string {
  return entries
    .map((entry, idx) => `${idx + 1}\n${entry.start} --> ${entry.end}\n${entry.text}`)
    .join("\n\n");
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SubtitleMakerPage() {
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shiftMs, setShiftMs] = useState(0);
  const [showShift, setShowShift] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTime, setVideoTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const srtText = useMemo(() => entriesToSRT(entries), [entries]);

  const totalDuration = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.max(...entries.map((e) => timeToMs(e.end)));
  }, [entries]);

  const currentSubtitle = useMemo(() => {
    const ms = videoTime * 1000;
    return entries.find((e) => {
      const start = timeToMs(e.start);
      const end = timeToMs(e.end);
      return ms >= start && ms <= end;
    });
  }, [entries, videoTime]);

  /* ---------------------------------------------------------------- */
  /*  Entry CRUD                                                       */
  /* ---------------------------------------------------------------- */

  const addEntry = useCallback(() => {
    const start = defaultStart(entries);
    const entry: SubtitleEntry = {
      id: uid(),
      start,
      end: defaultEnd(start),
      text: "",
    };
    setEntries((prev) => [...prev, entry]);
    setSelectedId(entry.id);
    // Scroll to bottom
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [entries]);

  const updateEntry = useCallback((id: string, field: keyof SubtitleEntry, value: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
  }, []);

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  /* ---------------------------------------------------------------- */
  /*  Import / Export                                                   */
  /* ---------------------------------------------------------------- */

  const handleImportSRT = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSRT(reader.result as string);
      if (parsed.length > 0) {
        setEntries(parsed);
        setSelectedId(parsed[0].id);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    e.target.value = "";
  }, []);

  const exportSRT = useCallback(() => {
    const blob = new Blob([srtText], { type: "text/srt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  }, [srtText]);

  const copySRT = useCallback(async () => {
    await navigator.clipboard.writeText(srtText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [srtText]);

  /* ---------------------------------------------------------------- */
  /*  Shift all timings                                                */
  /* ---------------------------------------------------------------- */

  const applyShift = useCallback(() => {
    if (shiftMs === 0) return;
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        start: msToTime(Math.max(0, timeToMs(e.start) + shiftMs)),
        end: msToTime(Math.max(0, timeToMs(e.end) + shiftMs)),
      })),
    );
    setShiftMs(0);
    setShowShift(false);
  }, [shiftMs]);

  /* ---------------------------------------------------------------- */
  /*  Video time tracking                                              */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => setVideoTime(video.currentTime);
    video.addEventListener("timeupdate", handler);
    return () => video.removeEventListener("timeupdate", handler);
  }, [videoUrl]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      <input ref={fileInputRef} type="file" accept=".srt,.txt" className="hidden" onChange={handleImportSRT} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <FileText size={14} />
          <span className="text-sm font-semibold">Subtitle Maker</span>
        </div>

        {entries.length > 0 && (
          <div className="flex items-center gap-3 ml-4 text-xs text-[var(--muted)]">
            <span>{entries.length} entries</span>
            <span>{formatDuration(totalDuration)} total</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Film size={12} />
            {videoUrl ? "Change Video" : "Load Video"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Import size={12} />
            Import SRT
          </button>

          <button
            type="button"
            onClick={() => setShowShift(!showShift)}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              showShift
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <MoveHorizontal size={12} />
            Shift
          </button>

          {entries.length > 0 && (
            <>
              <button
                type="button"
                onClick={copySRT}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {copied ? <Check size={12} /> : <Clipboard size={12} />}
                {copied ? "Copied" : "Copy SRT"}
              </button>
              <button
                type="button"
                onClick={exportSRT}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Download size={12} />
                Export .srt
              </button>
            </>
          )}
        </div>
      </header>

      {/* Shift bar */}
      {showShift && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <span className="text-xs text-[var(--muted)]">Shift all timings by:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShiftMs((p) => p - 100)}
              className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              <Minus size={10} />
            </button>
            <input
              type="number"
              value={shiftMs}
              onChange={(e) => setShiftMs(Number(e.target.value))}
              className="w-24 text-sm text-center px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none"
            />
            <button
              type="button"
              onClick={() => setShiftMs((p) => p + 100)}
              className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              <Plus size={10} />
            </button>
          </div>
          <span className="text-xs text-[var(--muted)]">ms</span>
          <button
            type="button"
            onClick={applyShift}
            disabled={shiftMs === 0}
            className="text-xs px-3 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Entries list */}
        <div className="w-[480px] flex-shrink-0 border-r border-[var(--border)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              Subtitle Entries
            </span>
            <button
              type="button"
              onClick={addEntry}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              <Plus size={12} />
              Add
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] text-sm gap-3">
                <p>No subtitle entries yet</p>
                <button
                  type="button"
                  onClick={addEntry}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  <Plus size={12} />
                  Add First Entry
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    className={`px-4 py-2.5 cursor-pointer transition-colors ${
                      selectedId === entry.id
                        ? "bg-[var(--accent)]/8"
                        : "hover:bg-[var(--surface-hover)]"
                    } ${currentSubtitle?.id === entry.id ? "ring-1 ring-inset ring-[var(--accent)]" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono text-[var(--muted)] w-6">{idx + 1}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <TimeInput
                          value={entry.start}
                          onChange={(v) => updateEntry(entry.id, "start", v)}
                        />
                        <span className="text-[10px] text-[var(--muted)]">--&gt;</span>
                        <TimeInput
                          value={entry.end}
                          onChange={(v) => updateEntry(entry.id, "end", v)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntry(entry.id);
                        }}
                        className="p-1 text-[var(--muted)] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <textarea
                      value={entry.text}
                      onChange={(e) => updateEntry(entry.id, "text", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Subtitle text..."
                      rows={2}
                      className="w-full text-sm px-2 py-1 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] resize-none ml-8"
                      style={{ width: "calc(100% - 2rem)" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Video + Timeline */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video preview */}
          <div className="flex-1 flex items-center justify-center bg-black relative min-h-0">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="max-w-full max-h-full"
                />
                {/* Subtitle overlay */}
                {currentSubtitle && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/75 text-white text-base text-center rounded max-w-[80%] pointer-events-none whitespace-pre-line">
                    {currentSubtitle.text}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-500 text-sm">
                <Film size={32} className="opacity-40" />
                <p>Load a video to preview subtitles</p>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors"
                >
                  <Upload size={12} />
                  Upload Video
                </button>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="h-28 flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
            <Timeline
              entries={entries}
              totalDuration={totalDuration}
              selectedId={selectedId}
              currentTimeMs={videoTime * 1000}
              onSelect={setSelectedId}
              onSeek={(ms) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = ms / 1000;
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Time Input                                                         */
/* ------------------------------------------------------------------ */

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="00:00:00,000"
      className="w-[110px] text-xs font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] text-center"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline                                                           */
/* ------------------------------------------------------------------ */

function Timeline({
  entries,
  totalDuration,
  selectedId,
  currentTimeMs,
  onSelect,
  onSeek,
}: {
  entries: SubtitleEntry[];
  totalDuration: number;
  selectedId: string | null;
  currentTimeMs: number;
  onSelect: (id: string) => void;
  onSeek: (ms: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maxMs = Math.max(totalDuration, 30000); // At least 30 seconds
  const pixelsPerMs = 0.08; // 80px per second
  const totalWidth = maxMs * pixelsPerMs;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (e.currentTarget.scrollLeft || 0);
      const ms = x / pixelsPerMs;
      onSeek(ms);
    },
    [onSeek, pixelsPerMs],
  );

  // Time markers
  const markers: number[] = [];
  const interval = maxMs <= 60000 ? 5000 : maxMs <= 300000 ? 10000 : 30000;
  for (let t = 0; t <= maxMs; t += interval) {
    markers.push(t);
  }

  return (
    <div
      ref={containerRef}
      className="h-full relative cursor-crosshair"
      style={{ minWidth: totalWidth }}
      onClick={handleClick}
    >
      {/* Time markers */}
      <div className="absolute top-0 left-0 right-0 h-5 border-b border-[var(--border)]">
        {markers.map((ms) => (
          <div
            key={ms}
            className="absolute top-0 text-[9px] text-[var(--muted)] font-mono"
            style={{ left: ms * pixelsPerMs }}
          >
            <div className="w-px h-2 bg-[var(--border)]" />
            <span className="ml-0.5">{formatDuration(ms)}</span>
          </div>
        ))}
      </div>

      {/* Subtitle blocks */}
      <div className="absolute top-5 left-0 right-0 bottom-0 px-0">
        {entries.map((entry, idx) => {
          const startMs = timeToMs(entry.start);
          const endMs = timeToMs(entry.end);
          const left = startMs * pixelsPerMs;
          const width = Math.max((endMs - startMs) * pixelsPerMs, 4);

          return (
            <div
              key={entry.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(entry.id);
              }}
              className={`absolute h-10 rounded border text-[10px] px-1.5 py-1 truncate cursor-pointer transition-colors ${
                selectedId === entry.id
                  ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--foreground)]"
                  : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
              style={{
                left,
                width,
                top: 8 + (idx % 2) * 44,
              }}
              title={`${entry.start} --> ${entry.end}\n${entry.text}`}
            >
              {entry.text || `#${idx + 1}`}
            </div>
          );
        })}
      </div>

      {/* Playhead */}
      {currentTimeMs > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-10"
          style={{ left: currentTimeMs * pixelsPerMs }}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full -ml-[3px] -mt-px" />
        </div>
      )}
    </div>
  );
}

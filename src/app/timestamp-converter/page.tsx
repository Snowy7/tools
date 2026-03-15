"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Calendar,
  ArrowRightLeft,
  Timer,
  Zap,
  List,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isMilliseconds(ts: number): boolean {
  return ts > 1e12;
}

function toSeconds(ts: number): number {
  return isMilliseconds(ts) ? Math.floor(ts / 1000) : ts;
}

function toMilliseconds(ts: number): number {
  return isMilliseconds(ts) ? ts : ts * 1000;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function formatDateLocal(d: Date, use24h: boolean, showMs: boolean): string {
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  let suffix = "";

  if (!use24h) {
    suffix = hours >= 12 ? " PM" : " AM";
    hours = hours % 12 || 12;
  }

  let result = `${year}-${month}-${day} ${pad(hours)}:${minutes}:${seconds}`;
  if (showMs) result += `.${ms}`;
  result += suffix;
  return result;
}

function formatDateUTC(d: Date, use24h: boolean, showMs: boolean): string {
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  let hours = d.getUTCHours();
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());
  const ms = pad(d.getUTCMilliseconds(), 3);
  let suffix = "";

  if (!use24h) {
    suffix = hours >= 12 ? " PM" : " AM";
    hours = hours % 12 || 12;
  }

  let result = `${year}-${month}-${day} ${pad(hours)}:${minutes}:${seconds}`;
  if (showMs) result += `.${ms}`;
  result += ` UTC${suffix}`;
  return result;
}

function relativeTime(ts: number): string {
  const now = Date.now();
  const ms = toMilliseconds(ts);
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  const past = diff < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let label: string;
  if (seconds < 5) label = "just now";
  else if (seconds < 60) label = `${seconds} second${seconds !== 1 ? "s" : ""}`;
  else if (minutes < 60) label = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  else if (hours < 24) label = `${hours} hour${hours !== 1 ? "s" : ""}`;
  else if (days < 30) label = `${days} day${days !== 1 ? "s" : ""}`;
  else if (months < 12) label = `${months} month${months !== 1 ? "s" : ""}`;
  else label = `${years} year${years !== 1 ? "s" : ""}`;

  if (label === "just now") return label;
  return past ? `${label} ago` : `in ${label}`;
}

function detailedDuration(msValue: number): string {
  const abs = Math.abs(msValue);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

function dateToInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeToInputValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const TZ_OPTIONS = [
  { label: "UTC", offset: 0 },
  { label: "Local", offset: null },
  { label: "UTC-12", offset: -720 },
  { label: "UTC-11", offset: -660 },
  { label: "UTC-10", offset: -600 },
  { label: "UTC-9", offset: -540 },
  { label: "UTC-8", offset: -480 },
  { label: "UTC-7", offset: -420 },
  { label: "UTC-6", offset: -360 },
  { label: "UTC-5", offset: -300 },
  { label: "UTC-4", offset: -240 },
  { label: "UTC-3", offset: -180 },
  { label: "UTC-2", offset: -120 },
  { label: "UTC-1", offset: -60 },
  { label: "UTC+1", offset: 60 },
  { label: "UTC+2", offset: 120 },
  { label: "UTC+3", offset: 180 },
  { label: "UTC+4", offset: 240 },
  { label: "UTC+5", offset: 300 },
  { label: "UTC+5:30", offset: 330 },
  { label: "UTC+6", offset: 360 },
  { label: "UTC+7", offset: 420 },
  { label: "UTC+8", offset: 480 },
  { label: "UTC+9", offset: 540 },
  { label: "UTC+10", offset: 600 },
  { label: "UTC+11", offset: 660 },
  { label: "UTC+12", offset: 720 },
];

/* ------------------------------------------------------------------ */
/*  Small reusable pieces                                             */
/* ------------------------------------------------------------------ */

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const click = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [text]);

  return (
    <button
      type="button"
      onClick={click}
      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)] flex-shrink-0"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[var(--muted)] min-w-[100px] flex-shrink-0">{label}</span>
      <span className="font-mono text-[var(--foreground)] break-all flex-1">{value}</span>
      <CopyBtn text={value} />
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4 flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-7 h-4 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? "translate-x-3" : ""}`}
        />
      </button>
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function TimestampConverterPage() {
  /* format options */
  const [use24h, setUse24h] = useState(true);
  const [showMs, setShowMs] = useState(false);
  const [tzIndex, setTzIndex] = useState(1); // default "Local"

  /* current time */
  const [now, setNow] = useState(() => Date.now());

  /* unix -> human */
  const [unixInput, setUnixInput] = useState("");

  /* human -> unix */
  const [h2uDate, setH2uDate] = useState(() => dateToInputValue(new Date()));
  const [h2uTime, setH2uTime] = useState(() => timeToInputValue(new Date()));

  /* time ago */
  const [agoDate, setAgoDate] = useState("");
  const [agoTime, setAgoTime] = useState("00:00:00");

  /* duration */
  const [durStart, setDurStart] = useState("");
  const [durEnd, setDurEnd] = useState("");

  /* batch */
  const [batchInput, setBatchInput] = useState("");

  /* tick */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---- derived: apply tz offset to a Date for display purposes ---- */
  const applyTz = useCallback(
    (d: Date): Date => {
      const tz = TZ_OPTIONS[tzIndex];
      if (tz.offset === null) return d; // local
      const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
      return new Date(utcMs + tz.offset * 60000);
    },
    [tzIndex],
  );

  const formatDisplay = useCallback(
    (d: Date): string => {
      const shifted = applyTz(d);
      return formatDateLocal(shifted, use24h, showMs);
    },
    [applyTz, use24h, showMs],
  );

  /* ---- current time ---- */
  const nowDate = useMemo(() => new Date(now), [now]);

  /* ---- unix -> human ---- */
  const unixParsed = useMemo(() => {
    const trimmed = unixInput.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isNaN(n)) return null;
    const ms = toMilliseconds(n);
    const sec = toSeconds(n);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return { ms, sec, date: d, wasMs: isMilliseconds(n) };
  }, [unixInput]);

  /* ---- human -> unix ---- */
  const h2uResult = useMemo(() => {
    if (!h2uDate) return null;
    const str = `${h2uDate}T${h2uTime || "00:00:00"}`;
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    return { sec: Math.floor(d.getTime() / 1000), ms: d.getTime(), date: d };
  }, [h2uDate, h2uTime]);

  /* ---- time ago ---- */
  const agoResult = useMemo(() => {
    if (!agoDate) return null;
    const str = `${agoDate}T${agoTime || "00:00:00"}`;
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    const diff = d.getTime() - Date.now();
    return { detailed: detailedDuration(diff), relative: relativeTime(Math.floor(d.getTime() / 1000)), past: diff < 0 };
  }, [agoDate, agoTime, now]);

  /* ---- duration ---- */
  const durResult = useMemo(() => {
    if (!durStart || !durEnd) return null;
    const parseOne = (v: string): Date | null => {
      const n = Number(v.trim());
      if (!Number.isNaN(n) && v.trim() !== "") return new Date(toMilliseconds(n));
      const d = new Date(v.trim());
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const a = parseOne(durStart);
    const b = parseOne(durEnd);
    if (!a || !b) return null;
    const diff = b.getTime() - a.getTime();
    return { diff, detailed: detailedDuration(diff), startDate: a, endDate: b };
  }, [durStart, durEnd]);

  /* ---- batch convert ---- */
  const batchResults = useMemo(() => {
    if (!batchInput.trim()) return [];
    return batchInput
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const trimmed = line.trim();
        const n = Number(trimmed);
        if (Number.isNaN(n)) return { input: trimmed, output: "Invalid timestamp" };
        const ms = toMilliseconds(n);
        const d = new Date(ms);
        if (Number.isNaN(d.getTime())) return { input: trimmed, output: "Invalid timestamp" };
        return {
          input: trimmed,
          output: `${d.toISOString()} | ${formatDisplay(d)} | ${relativeTime(n)}`,
        };
      });
  }, [batchInput, formatDisplay]);

  /* ---- quick timestamps ---- */
  const quickTimestamps = useMemo(() => {
    const n = new Date();
    const startOfDay = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const dayOfWeek = n.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(n.getFullYear(), n.getMonth(), n.getDate() - diffToMonday);
    const startOfMonth = new Date(n.getFullYear(), n.getMonth(), 1);
    const startOfYear = new Date(n.getFullYear(), 0, 1);

    return [
      { label: "Now", ts: Math.floor(Date.now() / 1000) },
      { label: "Start of today", ts: Math.floor(startOfDay.getTime() / 1000) },
      { label: "Start of this week", ts: Math.floor(startOfWeek.getTime() / 1000) },
      { label: "Start of this month", ts: Math.floor(startOfMonth.getTime() / 1000) },
      { label: "Start of this year", ts: Math.floor(startOfYear.getTime() / 1000) },
    ];
  }, [now]);

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] font-mono placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Clock size={14} />
          <span className="text-sm font-semibold">Timestamp Converter</span>
        </div>

        {/* Format options */}
        <div className="ml-auto flex items-center gap-3">
          <Toggle label="24h" checked={use24h} onChange={setUse24h} />
          <Toggle label="ms" checked={showMs} onChange={setShowMs} />
          <select
            value={tzIndex}
            onChange={(e) => setTzIndex(Number(e.target.value))}
            className="text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            aria-label="Timezone"
          >
            {TZ_OPTIONS.map((tz, i) => (
              <option key={tz.label} value={i}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4 pb-8">
          {/* ---- Current Time ---- */}
          <Card title="Current Time" icon={<Clock size={14} />}>
            <div className="flex flex-col gap-2">
              <ResultRow label="Unix (s)" value={String(Math.floor(now / 1000))} />
              <ResultRow label="Unix (ms)" value={String(now)} />
              <ResultRow label="ISO 8601" value={nowDate.toISOString()} />
              <ResultRow label="UTC" value={formatDateUTC(nowDate, use24h, showMs)} />
              <ResultRow label="Display" value={formatDisplay(nowDate)} />
            </div>
          </Card>

          {/* ---- Quick Timestamps ---- */}
          <Card title="Quick Timestamps" icon={<Zap size={14} />}>
            <div className="flex flex-wrap gap-1.5">
              {quickTimestamps.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setUnixInput(String(q.ts))}
                  className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1.5 text-[var(--foreground)] transition-colors"
                >
                  {q.label}
                  <span className="text-[var(--muted)] font-mono">{q.ts}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* ---- Unix -> Human ---- */}
          <Card title="Unix to Human" icon={<ArrowRightLeft size={14} />}>
            <input
              type="text"
              value={unixInput}
              onChange={(e) => setUnixInput(e.target.value)}
              placeholder="Paste a unix timestamp (seconds or milliseconds)"
              className={inputClass}
              aria-label="Unix timestamp input"
            />
            {unixParsed && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="text-xs text-[var(--muted)]">
                  Detected as {unixParsed.wasMs ? "milliseconds" : "seconds"}
                </div>
                <ResultRow label="ISO 8601" value={unixParsed.date.toISOString()} />
                <ResultRow label="UTC" value={formatDateUTC(unixParsed.date, use24h, showMs)} />
                <ResultRow label="Display" value={formatDisplay(unixParsed.date)} />
                <ResultRow label="Relative" value={relativeTime(unixParsed.sec)} />
                <ResultRow label="Seconds" value={String(unixParsed.sec)} />
                <ResultRow label="Milliseconds" value={String(unixParsed.ms)} />
              </div>
            )}
            {unixInput.trim() && !unixParsed && (
              <p className="text-xs text-red-500">Invalid timestamp</p>
            )}
          </Card>

          {/* ---- Human -> Unix ---- */}
          <Card title="Human to Unix" icon={<Calendar size={14} />}>
            <div className="flex gap-2">
              <input
                type="date"
                value={h2uDate}
                onChange={(e) => setH2uDate(e.target.value)}
                className={inputClass}
                aria-label="Date"
              />
              <input
                type="time"
                value={h2uTime}
                onChange={(e) => setH2uTime(e.target.value)}
                step="1"
                className={inputClass}
                aria-label="Time"
              />
            </div>
            {h2uResult && (
              <div className="flex flex-col gap-2 mt-1">
                <ResultRow label="Seconds" value={String(h2uResult.sec)} />
                <ResultRow label="Milliseconds" value={String(h2uResult.ms)} />
                <ResultRow label="ISO 8601" value={h2uResult.date.toISOString()} />
              </div>
            )}
          </Card>

          {/* ---- Time Ago ---- */}
          <Card title="Time Ago Calculator" icon={<Timer size={14} />}>
            <div className="flex gap-2">
              <input
                type="date"
                value={agoDate}
                onChange={(e) => setAgoDate(e.target.value)}
                className={inputClass}
                aria-label="Date for time ago"
              />
              <input
                type="time"
                value={agoTime}
                onChange={(e) => setAgoTime(e.target.value)}
                step="1"
                className={inputClass}
                aria-label="Time for time ago"
              />
            </div>
            {agoResult && (
              <div className="flex flex-col gap-2 mt-1">
                <ResultRow label="Relative" value={agoResult.relative} />
                <ResultRow label="Detailed" value={`${agoResult.detailed}${agoResult.past ? " ago" : " from now"}`} />
              </div>
            )}
          </Card>

          {/* ---- Duration Calculator ---- */}
          <Card title="Duration Calculator" icon={<ArrowRightLeft size={14} />}>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={durStart}
                onChange={(e) => setDurStart(e.target.value)}
                placeholder="Start (timestamp or date string)"
                className={inputClass}
                aria-label="Duration start"
              />
              <input
                type="text"
                value={durEnd}
                onChange={(e) => setDurEnd(e.target.value)}
                placeholder="End (timestamp or date string)"
                className={inputClass}
                aria-label="Duration end"
              />
            </div>
            {durResult && (
              <div className="flex flex-col gap-2 mt-1">
                <ResultRow label="Duration" value={durResult.detailed} />
                <ResultRow label="Total sec" value={String(Math.abs(Math.floor(durResult.diff / 1000)))} />
                <ResultRow label="Total ms" value={String(Math.abs(durResult.diff))} />
                <ResultRow label="Start" value={durResult.startDate.toISOString()} />
                <ResultRow label="End" value={durResult.endDate.toISOString()} />
              </div>
            )}
          </Card>

          {/* ---- Batch Convert ---- */}
          <Card title="Batch Convert" icon={<List size={14} />}>
            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"Paste timestamps, one per line\n1700000000\n1700000000000\n1609459200"}
              rows={4}
              className={`${inputClass} resize-y`}
              aria-label="Batch timestamp input"
            />
            {batchResults.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1">
                {batchResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs font-mono border-b border-[var(--border)] pb-1.5 last:border-0"
                  >
                    <span className="text-[var(--muted)] min-w-[120px] flex-shrink-0 break-all">
                      {r.input}
                    </span>
                    <span className="text-[var(--foreground)] flex-1 break-all">
                      {r.output}
                    </span>
                    {r.output !== "Invalid timestamp" && <CopyBtn text={r.output} />}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

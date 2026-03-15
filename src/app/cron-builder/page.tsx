"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                   */
/* ------------------------------------------------------------------ */

interface CronField {
  label: string;
  short: string;
  min: number;
  max: number;
  names?: string[];
}

const FIELDS: CronField[] = [
  { label: "Minute", short: "MIN", min: 0, max: 59 },
  { label: "Hour", short: "HRS", min: 0, max: 23 },
  { label: "Day of Month", short: "DOM", min: 1, max: 31 },
  {
    label: "Month",
    short: "MON",
    min: 1,
    max: 12,
    names: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  {
    label: "Day of Week",
    short: "DOW",
    min: 0,
    max: 6,
    names: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
];

interface Preset {
  label: string;
  expression: string;
}

const PRESETS: Preset[] = [
  { label: "Every minute", expression: "* * * * *" },
  { label: "Every 5 minutes", expression: "*/5 * * * *" },
  { label: "Every 15 minutes", expression: "*/15 * * * *" },
  { label: "Every hour", expression: "0 * * * *" },
  { label: "Every 6 hours", expression: "0 */6 * * *" },
  { label: "Daily at midnight", expression: "0 0 * * *" },
  { label: "Daily at noon", expression: "0 12 * * *" },
  { label: "Every Monday", expression: "0 0 * * 1" },
  { label: "Weekdays at 9am", expression: "0 9 * * 1-5" },
  { label: "1st of every month", expression: "0 0 1 * *" },
  { label: "Every Sunday at 6pm", expression: "0 18 * * 0" },
  { label: "Every 30 minutes", expression: "*/30 * * * *" },
];

/* ------------------------------------------------------------------ */
/*  Cron Parser & Helpers                                               */
/* ------------------------------------------------------------------ */

function parseCronField(field: string, min: number, max: number): number[] | null {
  if (field === "*") {
    const result: number[] = [];
    for (let i = min; i <= max; i++) result.push(i);
    return result;
  }

  const values = new Set<number>();
  const parts = field.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) return null;

    // Handle */n (step from start)
    const stepAllMatch = trimmed.match(/^\*\/(\d+)$/);
    if (stepAllMatch) {
      const step = parseInt(stepAllMatch[1], 10);
      if (step <= 0 || step > max) return null;
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }

    // Handle n-m/s (range with step)
    const rangeStepMatch = trimmed.match(/^(\d+)-(\d+)\/(\d+)$/);
    if (rangeStepMatch) {
      const start = parseInt(rangeStepMatch[1], 10);
      const end = parseInt(rangeStepMatch[2], 10);
      const step = parseInt(rangeStepMatch[3], 10);
      if (start < min || end > max || start > end || step <= 0) return null;
      for (let i = start; i <= end; i += step) values.add(i);
      continue;
    }

    // Handle n-m (range)
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start < min || end > max || start > end) return null;
      for (let i = start; i <= end; i++) values.add(i);
      continue;
    }

    // Handle plain number
    const numMatch = trimmed.match(/^(\d+)$/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n < min || n > max) return null;
      values.add(n);
      continue;
    }

    return null;
  }

  if (values.size === 0) return null;
  return Array.from(values).sort((a, b) => a - b);
}

function validateCron(expression: string): string | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return `Expected 5 fields, got ${parts.length}`;

  const fieldLabels = ["Minute", "Hour", "Day of Month", "Month", "Day of Week"];
  for (let i = 0; i < 5; i++) {
    const parsed = parseCronField(parts[i], FIELDS[i].min, FIELDS[i].max);
    if (parsed === null) return `Invalid ${fieldLabels[i]} field: "${parts[i]}"`;
  }
  return null;
}

function getNextRuns(expression: string, count: number, from?: Date): Date[] {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const minutes = parseCronField(parts[0], 0, 59);
  const hours = parseCronField(parts[1], 0, 23);
  const daysOfMonth = parseCronField(parts[2], 1, 31);
  const months = parseCronField(parts[3], 1, 12);
  const daysOfWeek = parseCronField(parts[4], 0, 6);

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return [];

  const minuteSet = new Set(minutes);
  const hourSet = new Set(hours);
  const domSet = new Set(daysOfMonth);
  const monthSet = new Set(months);
  const dowSet = new Set(daysOfWeek);

  const results: Date[] = [];
  const start = from ? new Date(from) : new Date();
  // Advance to the next minute boundary
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const current = new Date(start);
  const maxIterations = 525600; // 1 year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;

    const month = current.getMonth() + 1;
    if (!monthSet.has(month)) {
      current.setMonth(current.getMonth() + 1, 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const dom = current.getDate();
    const dow = current.getDay();
    const hour = current.getHours();
    const minute = current.getMinutes();

    // For day matching: if both DOM and DOW are restricted (not *), match either (OR logic, standard cron)
    const domIsWild = parts[2] === "*";
    const dowIsWild = parts[4] === "*";

    let dayMatches: boolean;
    if (domIsWild && dowIsWild) {
      dayMatches = true;
    } else if (domIsWild) {
      dayMatches = dowSet.has(dow);
    } else if (dowIsWild) {
      dayMatches = domSet.has(dom);
    } else {
      // Both restricted: OR semantics (standard Vixie cron behavior)
      dayMatches = domSet.has(dom) || dowSet.has(dow);
    }

    if (!dayMatches) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    if (!hourSet.has(hour)) {
      current.setHours(current.getHours() + 1, 0, 0, 0);
      continue;
    }

    if (!minuteSet.has(minute)) {
      current.setMinutes(current.getMinutes() + 1, 0, 0);
      continue;
    }

    results.push(new Date(current));
    current.setMinutes(current.getMinutes() + 1, 0, 0);
  }

  return results;
}

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid expression";
  if (validateCron(expression)) return "Invalid expression";

  const [min, hr, dom, mon, dow] = parts;

  // Check common patterns first
  if (min === "*" && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return "Every minute";
  }

  const pieces: string[] = [];

  // Minute description
  if (min === "*") {
    pieces.push("Every minute");
  } else if (min.startsWith("*/")) {
    pieces.push(`Every ${min.slice(2)} minutes`);
  } else if (min.includes(",")) {
    pieces.push(`At minutes ${min}`);
  } else if (min.includes("-")) {
    pieces.push(`Every minute from ${min.replace("-", " through ")}`);
  } else {
    pieces.push(`At minute ${min}`);
  }

  // Hour description
  if (hr === "*") {
    if (min !== "*" && !min.startsWith("*/")) pieces.push("of every hour");
  } else if (hr.startsWith("*/")) {
    pieces.push(`past every ${hr.slice(2)} hours`);
  } else if (hr.includes(",")) {
    pieces.push(`at hours ${hr}`);
  } else if (hr.includes("-")) {
    pieces.push(`during hours ${hr.replace("-", " through ")}`);
  } else {
    const h = parseInt(hr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    if (min === "0" || min === "00") {
      // Rewrite: "At minute 0" + "at 5 AM" -> cleaner
      pieces.length = 0;
      pieces.push(`At ${h12}:00 ${ampm}`);
    } else if (!min.includes("*") && !min.includes("/") && !min.includes(",") && !min.includes("-")) {
      pieces.length = 0;
      pieces.push(`At ${h12}:${min.padStart(2, "0")} ${ampm}`);
    } else {
      pieces.push(`past ${h12} ${ampm}`);
    }
  }

  // Day of month
  if (dom !== "*") {
    if (dom.includes(",")) {
      pieces.push(`on days ${dom} of the month`);
    } else if (dom.includes("-")) {
      pieces.push(`on days ${dom.replace("-", " through ")} of the month`);
    } else if (dom.startsWith("*/")) {
      pieces.push(`every ${dom.slice(2)} days`);
    } else {
      const d = parseInt(dom, 10);
      const suffix = d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th";
      pieces.push(`on the ${d}${suffix}`);
    }
  }

  // Month
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  if (mon !== "*") {
    if (mon.includes(",")) {
      const names = mon.split(",").map((m) => monthNames[parseInt(m, 10)] || m).join(", ");
      pieces.push(`in ${names}`);
    } else if (mon.includes("-")) {
      const [s, e] = mon.split("-");
      pieces.push(`from ${monthNames[parseInt(s, 10)] || s} through ${monthNames[parseInt(e, 10)] || e}`);
    } else if (mon.startsWith("*/")) {
      pieces.push(`every ${mon.slice(2)} months`);
    } else {
      pieces.push(`in ${monthNames[parseInt(mon, 10)] || mon}`);
    }
  }

  // Day of week
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (dow !== "*") {
    if (dow.includes(",")) {
      const names = dow.split(",").map((d) => dayNames[parseInt(d, 10)] || d).join(", ");
      pieces.push(`on ${names}`);
    } else if (dow.includes("-")) {
      const [s, e] = dow.split("-");
      pieces.push(`${dayNames[parseInt(s, 10)] || s} through ${dayNames[parseInt(e, 10)] || e}`);
    } else {
      pieces.push(`on ${dayNames[parseInt(dow, 10)] || dow}`);
    }
  }

  return pieces.join(" ") || "Every minute";
}

function fieldToValues(raw: string, fieldIndex: number): number[] {
  const f = FIELDS[fieldIndex];
  const parsed = parseCronField(raw, f.min, f.max);
  return parsed || [];
}

function valuesToField(values: number[], fieldIndex: number): string {
  const f = FIELDS[fieldIndex];
  if (values.length === 0) return "*";

  // Check if it covers the entire range
  const fullRange = f.max - f.min + 1;
  if (values.length === fullRange) return "*";

  // Check if it's a simple step pattern
  if (values.length > 1) {
    const step = values[1] - values[0];
    if (step > 0) {
      let isStep = true;
      for (let i = 1; i < values.length; i++) {
        if (values[i] - values[i - 1] !== step) {
          isStep = false;
          break;
        }
      }
      if (isStep && values[0] === f.min && (f.max - f.min + 1) % step === 0 && values.length === Math.floor((f.max - f.min + 1) / step)) {
        return `*/${step}`;
      }
    }
  }

  // Check if contiguous range
  if (values.length > 2) {
    let isContiguous = true;
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1] + 1) {
        isContiguous = false;
        break;
      }
    }
    if (isContiguous) return `${values[0]}-${values[values.length - 1]}`;
  }

  // Comma separated
  return values.join(",");
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function CronBuilderPage() {
  const [expression, setExpression] = useState("* * * * *");
  const [rawInput, setRawInput] = useState("* * * * *");
  const [copied, setCopied] = useState(false);
  const [fieldModes, setFieldModes] = useState<("visual" | "raw")[]>(["visual", "visual", "visual", "visual", "visual"]);

  const parts = useMemo(() => expression.trim().split(/\s+/), [expression]);
  const isValid = parts.length === 5;

  const error = useMemo(() => validateCron(expression), [expression]);
  const description = useMemo(() => (error ? null : describeCron(expression)), [expression, error]);
  const nextRuns = useMemo(() => (error ? [] : getNextRuns(expression, 10)), [expression, error]);

  // Keep raw input in sync when expression changes from visual builder
  useEffect(() => {
    setRawInput(expression);
  }, [expression]);

  const handleRawInputChange = useCallback((value: string) => {
    setRawInput(value);
    const trimmed = value.trim();
    if (trimmed.split(/\s+/).length === 5) {
      setExpression(trimmed);
    }
  }, []);

  const handleFieldChange = useCallback(
    (fieldIndex: number, value: string) => {
      const newParts = [...parts];
      if (fieldIndex < newParts.length) {
        newParts[fieldIndex] = value || "*";
      }
      setExpression(newParts.join(" "));
    },
    [parts],
  );

  const handleMultiSelect = useCallback(
    (fieldIndex: number, numValue: number) => {
      const currentValues = isValid ? fieldToValues(parts[fieldIndex], fieldIndex) : [];
      const f = FIELDS[fieldIndex];
      const fullRange = f.max - f.min + 1;
      const isAll = currentValues.length === fullRange;

      let newValues: number[];
      if (isAll) {
        // Switching from "all" to just this value
        newValues = [numValue];
      } else if (currentValues.includes(numValue)) {
        newValues = currentValues.filter((v) => v !== numValue);
      } else {
        newValues = [...currentValues, numValue].sort((a, b) => a - b);
      }

      handleFieldChange(fieldIndex, valuesToField(newValues, fieldIndex));
    },
    [parts, isValid, handleFieldChange],
  );

  const handlePreset = useCallback((preset: Preset) => {
    setExpression(preset.expression);
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(expression);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [expression]);

  const handleReset = useCallback(() => {
    setExpression("* * * * *");
  }, []);

  const toggleFieldMode = useCallback((fieldIndex: number) => {
    setFieldModes((prev) => {
      const next = [...prev];
      next[fieldIndex] = next[fieldIndex] === "visual" ? "raw" : "visual";
      return next;
    });
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 1) return "< 1 min";
    if (diffMins < 60) return `in ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      const remainMins = diffMins - diffHours * 60;
      return `in ${diffHours}h ${remainMins}m`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays}d ${diffHours - diffDays * 24}h`;
  };

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
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[var(--accent)]" />
          <h1 className="text-sm font-semibold text-[var(--foreground)]">Cron Builder</h1>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          title="Reset to default"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
          {/* Expression Display */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-medium">
              Cron Expression
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={rawInput}
                  onChange={(e) => handleRawInputChange(e.target.value)}
                  spellCheck={false}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 font-mono text-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent tracking-[0.15em] transition-shadow"
                  placeholder="* * * * *"
                  aria-label="Cron expression"
                />
                {error && (
                  <div className="absolute top-full left-0 mt-1.5 text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1.5 rounded-md border border-red-500/20">
                    {error}
                  </div>
                )}
              </div>
              <button
                onClick={handleCopy}
                className="px-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5 text-xs flex-shrink-0"
                title="Copy expression"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Description */}
          {description && !error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[var(--accent)]/8 border border-[var(--accent)]/15">
              <Zap size={14} className="text-[var(--accent)] flex-shrink-0" />
              <span className="text-sm text-[var(--foreground)] font-medium">{description}</span>
            </div>
          )}

          {/* Presets */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-medium">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.expression}
                  onClick={() => handlePreset(preset)}
                  className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                    expression === preset.expression
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Builder - 5 Columns */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-medium">
              Visual Builder
            </label>
            <div className="grid grid-cols-5 gap-2">
              {FIELDS.map((field, fi) => {
                const currentPart = isValid && parts[fi] ? parts[fi] : "*";
                const currentValues = isValid ? fieldToValues(currentPart, fi) : [];
                const fullRange = field.max - field.min + 1;
                const isAll = currentValues.length === fullRange;
                const isRaw = fieldModes[fi] === "raw";

                return (
                  <div
                    key={field.label}
                    className="flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden"
                  >
                    {/* Field header */}
                    <div className="px-2.5 py-2 border-b border-[var(--border)] bg-[var(--surface-hover)]/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                          {field.short}
                        </div>
                        <div className="text-[9px] text-[var(--muted)]">{field.label}</div>
                      </div>
                      <button
                        onClick={() => toggleFieldMode(fi)}
                        className="text-[9px] text-[var(--muted)] hover:text-[var(--foreground)] px-1.5 py-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
                        title={isRaw ? "Switch to visual" : "Switch to raw input"}
                      >
                        {isRaw ? "Visual" : "Raw"}
                      </button>
                    </div>

                    {/* Current value display */}
                    <div className="px-2.5 py-1.5 border-b border-[var(--border)] font-mono text-xs text-center text-[var(--foreground)]">
                      {currentPart}
                    </div>

                    {isRaw ? (
                      /* Raw input mode */
                      <div className="p-2">
                        <input
                          type="text"
                          value={currentPart}
                          onChange={(e) => handleFieldChange(fi, e.target.value)}
                          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1.5 font-mono text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                          placeholder="*"
                          spellCheck={false}
                          aria-label={`${field.label} value`}
                        />
                        <div className="mt-1.5 text-[9px] text-[var(--muted)] space-y-0.5">
                          <div>* = any</div>
                          <div>*/n = every n</div>
                          <div>n-m = range</div>
                          <div>a,b = list</div>
                        </div>
                      </div>
                    ) : (
                      /* Visual multi-select mode */
                      <div className="p-1.5 max-h-44 overflow-y-auto flex flex-col gap-0.5">
                        {/* "Any" toggle */}
                        <button
                          onClick={() => handleFieldChange(fi, "*")}
                          className={`w-full text-left px-2 py-1 text-[10px] rounded transition-colors ${
                            isAll
                              ? "bg-[var(--accent)] text-white"
                              : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          Any (*)
                        </button>
                        {/* Individual values */}
                        {Array.from({ length: fullRange }, (_, i) => {
                          const val = field.min + i;
                          const selected = !isAll && currentValues.includes(val);
                          const displayLabel = field.names ? field.names[val] || String(val) : String(val);
                          return (
                            <button
                              key={val}
                              onClick={() => handleMultiSelect(fi, val)}
                              className={`w-full text-left px-2 py-1 text-[10px] rounded transition-colors flex items-center justify-between ${
                                selected
                                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                                  : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                              }`}
                            >
                              <span className="font-mono">{String(val).padStart(2, "0")}</span>
                              {field.names && (
                                <span className="text-[var(--muted)]">{displayLabel}</span>
                              )}
                              {selected && <Check size={10} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Runs */}
          {!error && nextRuns.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-medium flex items-center gap-1.5">
                <Play size={10} />
                Next {nextRuns.length} Runs
              </label>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)]">
                {nextRuns.map((date, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[var(--muted)] w-5 text-right">
                        {i + 1}
                      </span>
                      <span className="text-xs text-[var(--foreground)] font-mono">
                        {formatDate(date)}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--muted)]">
                      {getRelativeTime(date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Field reference */}
          <div className="pb-4">
            <div className="flex items-center gap-5 text-[10px] text-[var(--muted)] justify-center">
              <span className="font-mono">*</span><span>any</span>
              <span className="font-mono">*/n</span><span>every n</span>
              <span className="font-mono">n-m</span><span>range</span>
              <span className="font-mono">a,b</span><span>list</span>
              <span className="font-mono">n-m/s</span><span>range+step</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

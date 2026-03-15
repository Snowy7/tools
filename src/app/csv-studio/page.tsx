"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  FileSpreadsheet,
  FileJson,
  Filter,
  Hash,
  Calendar,
  Type,
  ToggleLeft,
  Table,
  Code,
  BarChart3,
  Upload,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ColType = "number" | "string" | "date" | "boolean";
type SortDir = "asc" | "desc" | null;
type OutputMode = "json-objects" | "json-arrays" | "stats";
type ViewMode = "input" | "table";

interface ColMeta {
  name: string;
  type: ColType;
  index: number;
}

interface SortState {
  col: number;
  dir: SortDir;
}

interface ColStats {
  count: number;
  unique: number;
  min?: number;
  max?: number;
}

/* ------------------------------------------------------------------ */
/*  Delimiter detection                                                */
/* ------------------------------------------------------------------ */

const DELIMITERS = [",", "\t", ";", "|"] as const;

function detectDelimiter(text: string): string {
  const firstLines = text.split("\n").slice(0, 10);
  let best = ",";
  let bestScore = 0;

  for (const d of DELIMITERS) {
    const counts = firstLines.map((l) => l.split(d).length - 1);
    const consistent = counts.length > 1 && counts.every((c) => c === counts[0] && c > 0);
    const score = (consistent ? 1000 : 0) + counts.reduce((a, b) => a + b, 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  CSV parsing (handles quoted fields)                                */
/* ------------------------------------------------------------------ */

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }

  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Column type detection                                              */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}[-/]\d{2}[-/]\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;
const BOOL_RE = /^(true|false|yes|no|0|1)$/i;

function detectColType(values: string[]): ColType {
  const samples = values.filter((v) => v.trim() !== "").slice(0, 200);
  if (samples.length === 0) return "string";

  let nums = 0,
    dates = 0,
    bools = 0;
  for (const v of samples) {
    const t = v.trim();
    if (BOOL_RE.test(t)) bools++;
    if (!isNaN(Number(t)) && t !== "") nums++;
    if (DATE_RE.test(t)) dates++;
  }

  const n = samples.length;
  if (bools / n > 0.8) return "boolean";
  if (dates / n > 0.8) return "date";
  if (nums / n > 0.8) return "number";
  return "string";
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

function computeStats(values: string[], type: ColType): ColStats {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  const unique = new Set(nonEmpty).size;
  const stats: ColStats = { count: nonEmpty.length, unique };

  if (type === "number") {
    const nums = nonEmpty.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      stats.min = Math.min(...nums);
      stats.max = Math.max(...nums);
    }
  }
  return stats;
}

/* ------------------------------------------------------------------ */
/*  Serializers                                                        */
/* ------------------------------------------------------------------ */

function toCSVString(headers: string[], rows: string[][], delimiter: string): string {
  const escape = (v: string) => {
    if (v.includes(delimiter) || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(delimiter)];
  for (const row of rows) {
    lines.push(row.map((c) => escape(c ?? "")).join(delimiter));
  }
  return lines.join("\n");
}

function jsonToCSV(json: string): { headers: string[]; rows: string[][] } | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    if (typeof parsed[0] === "object" && !Array.isArray(parsed[0])) {
      const headers = Array.from(
        parsed.reduce((s: Set<string>, obj: Record<string, unknown>) => {
          Object.keys(obj).forEach((k) => s.add(k));
          return s;
        }, new Set<string>())
      ) as string[];
      const rows = parsed.map((obj: Record<string, unknown>) =>
        headers.map((h) => String(obj[h] ?? ""))
      );
      return { headers, rows };
    }

    if (Array.isArray(parsed[0])) {
      const headers = parsed[0].map(String);
      const rows = parsed.slice(1).map((r: unknown[]) => r.map(String));
      return { headers, rows };
    }

    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Transpose                                                          */
/* ------------------------------------------------------------------ */

function transpose(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
  const all = [headers, ...rows];
  const maxCols = Math.max(...all.map((r) => r.length));
  const transposed: string[][] = [];

  for (let c = 0; c < maxCols; c++) {
    transposed.push(all.map((r) => r[c] ?? ""));
  }

  return { headers: transposed[0] ?? [], rows: transposed.slice(1) };
}

/* ------------------------------------------------------------------ */
/*  Icon for column type                                               */
/* ------------------------------------------------------------------ */

function ColTypeIcon({ type }: { type: ColType }) {
  const size = 12;
  switch (type) {
    case "number":
      return <Hash size={size} />;
    case "date":
      return <Calendar size={size} />;
    case "boolean":
      return <ToggleLeft size={size} />;
    default:
      return <Type size={size} />;
  }
}

/* ------------------------------------------------------------------ */
/*  SAMPLE DATA                                                        */
/* ------------------------------------------------------------------ */

const SAMPLE_CSV = `name,age,email,active,joined
Alice,30,alice@example.com,true,2023-01-15
Bob,25,bob@example.com,false,2022-06-20
Charlie,35,charlie@example.com,true,2024-03-10
Diana,28,diana@example.com,true,2023-11-05
Eve,42,eve@example.com,false,2021-09-01`;

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function CsvStudioPage() {
  const [rawInput, setRawInput] = useState(SAMPLE_CSV);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [outputMode, setOutputMode] = useState<OutputMode>("json-objects");
  const [filterQuery, setFilterQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ col: -1, dir: null });
  const [editCell, setEditCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- Parse ---- */
  const delimiter = useMemo(() => detectDelimiter(rawInput), [rawInput]);
  const parsed = useMemo(() => parseCSV(rawInput, delimiter), [rawInput, delimiter]);
  const headers = useMemo(() => (parsed.length > 0 ? parsed[0] : []), [parsed]);
  const dataRows = useMemo(() => parsed.slice(1), [parsed]);

  /* ---- Column metadata ---- */
  const colMeta: ColMeta[] = useMemo(
    () =>
      headers.map((name, i) => ({
        name,
        type: detectColType(dataRows.map((r) => r[i] ?? "")),
        index: i,
      })),
    [headers, dataRows]
  );

  /* ---- Filter ---- */
  const filteredRows = useMemo(() => {
    if (!filterQuery.trim()) return dataRows;
    const q = filterQuery.toLowerCase();
    return dataRows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [dataRows, filterQuery]);

  /* ---- Sort ---- */
  const sortedRows = useMemo(() => {
    if (sort.col < 0 || !sort.dir) return filteredRows;
    const col = sort.col;
    const dir = sort.dir === "asc" ? 1 : -1;
    const type = colMeta[col]?.type ?? "string";

    return [...filteredRows].sort((a, b) => {
      const va = a[col] ?? "";
      const vb = b[col] ?? "";
      if (type === "number") {
        return (Number(va) - Number(vb)) * dir;
      }
      return va.localeCompare(vb) * dir;
    });
  }, [filteredRows, sort, colMeta]);

  /* ---- Stats ---- */
  const statsMap = useMemo(() => {
    return colMeta.map((cm) => ({
      ...cm,
      stats: computeStats(
        dataRows.map((r) => r[cm.index] ?? ""),
        cm.type
      ),
    }));
  }, [colMeta, dataRows]);

  /* ---- Output ---- */
  const outputText = useMemo(() => {
    if (outputMode === "json-objects") {
      const objs = sortedRows.map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const v = row[i] ?? "";
          const type = colMeta[i]?.type;
          if (type === "number" && v !== "" && !isNaN(Number(v))) obj[h] = Number(v);
          else if (type === "boolean") obj[h] = /^(true|yes|1)$/i.test(v);
          else obj[h] = v;
        });
        return obj;
      });
      return JSON.stringify(objs, null, 2);
    }
    if (outputMode === "json-arrays") {
      const arrays = [headers, ...sortedRows];
      return JSON.stringify(arrays, null, 2);
    }
    // stats
    return JSON.stringify(
      statsMap.map((s) => ({ column: s.name, type: s.type, ...s.stats })),
      null,
      2
    );
  }, [outputMode, sortedRows, headers, colMeta, statsMap]);

  /* ---- Handlers ---- */
  const handleSort = useCallback(
    (col: number) => {
      setSort((prev) => {
        if (prev.col === col) {
          if (prev.dir === "asc") return { col, dir: "desc" };
          if (prev.dir === "desc") return { col: -1, dir: null };
        }
        return { col, dir: "asc" };
      });
    },
    []
  );

  const handleCellEdit = useCallback(
    (rowIdx: number, colIdx: number) => {
      setEditCell({ row: rowIdx, col: colIdx });
      setEditValue(dataRows[rowIdx]?.[colIdx] ?? "");
    },
    [dataRows]
  );

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const lines = rawInput.split("\n");
    const rowLine = editCell.row + 1; // +1 for header
    if (rowLine < lines.length) {
      const rowParsed = parseCSV(lines[rowLine], delimiter)[0] ?? [];
      rowParsed[editCell.col] = editValue;
      const escape = (v: string) => {
        if (v.includes(delimiter) || v.includes('"') || v.includes("\n")) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      };
      lines[rowLine] = rowParsed.map(escape).join(delimiter);
      setRawInput(lines.join("\n"));
    }
    setEditCell(null);
  }, [editCell, editValue, rawInput, delimiter]);

  const handleUpload = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setRawInput(text);
        setViewMode("table");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleTranspose = useCallback(() => {
    const { headers: nh, rows: nr } = transpose(headers, dataRows);
    setRawInput(toCSVString(nh, nr, delimiter));
    setSort({ col: -1, dir: null });
  }, [headers, dataRows, delimiter]);

  const handleJsonToCSV = useCallback(() => {
    const result = jsonToCSV(jsonInput);
    if (result) {
      setRawInput(toCSVString(result.headers, result.rows, ","));
      setJsonInput("");
      setViewMode("table");
    }
  }, [jsonInput]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [outputText]);

  const handleDownload = useCallback(
    (format: "csv" | "tsv" | "json") => {
      let content: string;
      let mime: string;
      let ext: string;

      if (format === "json") {
        content = outputText;
        mime = "application/json";
        ext = "json";
      } else {
        const d = format === "tsv" ? "\t" : ",";
        content = toCSVString(headers, sortedRows, d);
        mime = "text/plain";
        ext = format;
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [outputText, headers, sortedRows]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawInput(text);
        setViewMode("table");
      }
    } catch {
      /* clipboard permission denied */
    }
  }, []);

  const delimiterLabel = delimiter === "\t" ? "TAB" : delimiter === "," ? "," : delimiter === ";" ? ";" : "|";

  /* ---- Render ---- */
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* ===== Header ===== */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <FileSpreadsheet size={14} />
          <span className="text-sm font-semibold">CSV Studio</span>
        </div>

        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--muted)] font-mono">
          delim: {delimiterLabel}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* View toggle */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "input" ? "table" : "input")}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            {viewMode === "input" ? <Table size={12} /> : <Code size={12} />}
            {viewMode === "input" ? "Table" : "Source"}
          </button>

          <button
            type="button"
            onClick={handlePaste}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <ClipboardPaste size={12} />
            Paste
          </button>

          <button
            type="button"
            onClick={handleUpload}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <Upload size={12} />
            Upload
          </button>

          <button
            type="button"
            onClick={handleTranspose}
            disabled={headers.length === 0}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)] disabled:opacity-40"
          >
            <RotateCcw size={12} />
            Transpose
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </header>

      {/* ===== Main split ===== */}
      <div className="flex-1 flex min-h-0">
        {/* ---- Left: Input / Table ---- */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border)]">
          {/* Filter bar */}
          {viewMode === "table" && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
              <Search size={12} className="text-[var(--muted)]" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter rows..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted)] text-[var(--foreground)]"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <X size={12} />
                </button>
              )}
              <span className="text-[10px] text-[var(--muted)]">
                {filteredRows.length} / {dataRows.length} rows
              </span>
            </div>
          )}

          {viewMode === "input" ? (
            <textarea
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setSort({ col: -1, dir: null });
              }}
              spellCheck={false}
              className="flex-1 w-full resize-none bg-[var(--background)] text-[var(--foreground)] text-xs font-mono p-3 outline-none"
              placeholder="Paste CSV, TSV, or delimited data here..."
            />
          ) : (
            <div className="flex-1 overflow-auto">
              {headers.length > 0 ? (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[var(--surface)]">
                      <th className="px-2 py-1.5 text-left text-[var(--muted)] font-medium border-b border-r border-[var(--border)] w-10 text-center">
                        #
                      </th>
                      {colMeta.map((cm) => (
                        <th
                          key={cm.index}
                          onClick={() => handleSort(cm.index)}
                          className="px-2 py-1.5 text-left font-medium border-b border-r border-[var(--border)] cursor-pointer hover:bg-[var(--surface-hover)] select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--muted)]">
                              <ColTypeIcon type={cm.type} />
                            </span>
                            <span className="truncate text-[var(--foreground)]">{cm.name}</span>
                            <span className="ml-auto text-[var(--muted)]">
                              {sort.col === cm.index && sort.dir === "asc" && <ArrowUp size={11} />}
                              {sort.col === cm.index && sort.dir === "desc" && <ArrowDown size={11} />}
                              {sort.col !== cm.index && <ArrowUpDown size={11} className="opacity-30" />}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]"
                      >
                        <td className="px-2 py-1 text-center text-[var(--muted)] border-r border-[var(--border)] tabular-nums">
                          {ri + 1}
                        </td>
                        {headers.map((_, ci) => {
                          const isEditing = editCell?.row === ri && editCell?.col === ci;
                          return (
                            <td
                              key={ci}
                              className="px-2 py-1 border-r border-[var(--border)] max-w-[200px] truncate cursor-text"
                              onClick={() => !isEditing && handleCellEdit(ri, ci)}
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitEdit();
                                    if (e.key === "Escape") setEditCell(null);
                                  }}
                                  className="w-full bg-[var(--background)] border border-[var(--accent)] rounded px-1 py-0 text-xs outline-none text-[var(--foreground)]"
                                />
                              ) : (
                                <span>{row[ci] ?? ""}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
                  No data. Paste or upload a CSV file.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Right: Output ---- */}
        <div className="w-[420px] flex-shrink-0 flex flex-col min-h-0 bg-[var(--background)]">
          {/* Output mode tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setOutputMode("json-objects")}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                outputMode === "json-objects"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <FileJson size={11} />
              Objects
            </button>
            <button
              type="button"
              onClick={() => setOutputMode("json-arrays")}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                outputMode === "json-arrays"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <FileJson size={11} />
              Arrays
            </button>
            <button
              type="button"
              onClick={() => setOutputMode("stats")}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                outputMode === "stats"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <BarChart3 size={11} />
              Stats
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Output code */}
          <div className="flex-1 overflow-auto">
            <pre className="text-xs font-mono p-3 whitespace-pre-wrap text-[var(--foreground)] leading-relaxed">
              {outputText}
            </pre>
          </div>

          {/* JSON to CSV input */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileJson size={11} className="text-[var(--muted)]" />
              <span className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider">
                JSON to CSV
              </span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='Paste JSON array here...'
                className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs px-2 py-1 outline-none text-[var(--foreground)] placeholder:text-[var(--muted)] font-mono"
              />
              <button
                type="button"
                onClick={handleJsonToCSV}
                disabled={!jsonInput.trim()}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Bottom bar ===== */}
      <footer className="flex items-center gap-3 px-4 py-1.5 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <Filter size={10} />
            {dataRows.length} rows
          </span>
          <span className="flex items-center gap-1">
            <Table size={10} />
            {headers.length} cols
          </span>
          {filterQuery && (
            <span className="text-[var(--accent)]">
              {filteredRows.length} matched
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleDownload("csv")}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
          >
            <Download size={10} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownload("tsv")}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
          >
            <Download size={10} />
            TSV
          </button>
          <button
            type="button"
            onClick={() => handleDownload("json")}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
          >
            <Download size={10} />
            JSON
          </button>
        </div>
      </footer>
    </div>
  );
}

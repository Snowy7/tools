"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Copy,
  Check,
  Globe,
  Loader2,
  Plus,
  Send,
  Trash2,
  AlertTriangle,
  History,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

type BodyMode = "none" | "json" | "text" | "formdata";
type AuthMode = "none" | "bearer" | "basic";
type RequestTab = "params" | "headers" | "body" | "auth";
type ResponseTab = "body" | "headers" | "timing";

interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

interface HistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  timestamp: number;
  status: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#a855f7",
  DELETE: "#ef4444",
  HEAD: "#6b7280",
  OPTIONS: "#06b6d4",
};

const COMMON_HEADERS = [
  "Content-Type",
  "Authorization",
  "Accept",
  "Cache-Control",
  "X-Requested-With",
  "X-API-Key",
  "Origin",
  "User-Agent",
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

let _idCounter = 0;
function uid(): string {
  return `kv_${Date.now()}_${++_idCounter}`;
}

function emptyKv(): KeyValue {
  return { id: uid(), key: "", value: "", enabled: true };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function tryPrettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusColor(code: number): string {
  if (code < 300) return "#22c55e";
  if (code < 400) return "#f59e0b";
  return "#ef4444";
}

function parseUrlParams(url: string): KeyValue[] {
  try {
    const u = new URL(url);
    const params: KeyValue[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ id: uid(), key, value, enabled: true });
    });
    if (params.length === 0) params.push(emptyKv());
    return params;
  } catch {
    return [emptyKv()];
  }
}

function buildUrlWithParams(baseUrl: string, params: KeyValue[]): string {
  try {
    const u = new URL(baseUrl.split("?")[0]);
    params.forEach((p) => {
      if (p.enabled && p.key) u.searchParams.set(p.key, p.value);
    });
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/* -------------------------------------------------------------------------- */
/*  Shared styles                                                             */
/* -------------------------------------------------------------------------- */

const inputClass =
  "w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const btnSecondary =
  "inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]";

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function KeyValueEditor({
  rows,
  onChange,
  suggestions,
}: {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  suggestions?: string[];
}) {
  const update = (id: string, field: keyof KeyValue, val: string | boolean) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length ? next : [emptyKv()]);
  };
  const add = () => onChange([...rows, emptyKv()]);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(row.id, "enabled", e.target.checked)}
            className="accent-[var(--accent)] shrink-0"
          />
          <input
            placeholder="Key"
            value={row.key}
            onChange={(e) => update(row.id, "key", e.target.value)}
            list={suggestions ? `hdr-suggestions-${row.id}` : undefined}
            className={inputClass}
          />
          {suggestions && (
            <datalist id={`hdr-suggestions-${row.id}`}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
          <input
            placeholder="Value"
            value={row.value}
            onChange={(e) => update(row.id, "value", e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            className="shrink-0 p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)]"
            aria-label="Remove row"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={`${btnSecondary} self-start mt-0.5`}>
        <Plus size={12} />
        Add
      </button>
    </div>
  );
}

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function ApiTesterPage() {
  /* --- Request state --- */
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [methodOpen, setMethodOpen] = useState(false);
  const methodRef = useRef<HTMLDivElement>(null);

  const [params, setParams] = useState<KeyValue[]>(() => parseUrlParams(url));
  const [headers, setHeaders] = useState<KeyValue[]>([emptyKv()]);
  const [bodyMode, setBodyMode] = useState<BodyMode>("none");
  const [bodyText, setBodyText] = useState("");
  const [formDataRows, setFormDataRows] = useState<KeyValue[]>([emptyKv()]);
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [bearerToken, setBearerToken] = useState("");
  const [basicUser, setBasicUser] = useState("");
  const [basicPass, setBasicPass] = useState("");

  const [requestTab, setRequestTab] = useState<RequestTab>("params");

  /* --- Response state --- */
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedResp, setCopiedResp] = useState(false);

  /* --- History --- */
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  /* Close method dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (methodRef.current && !methodRef.current.contains(e.target as Node)) {
        setMethodOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* Sync params -> URL */
  const syncingRef = useRef(false);
  const handleParamsChange = useCallback(
    (next: KeyValue[]) => {
      setParams(next);
      syncingRef.current = true;
      setUrl(buildUrlWithParams(url, next));
      setTimeout(() => (syncingRef.current = false), 0);
    },
    [url],
  );

  /* Sync URL -> params */
  const handleUrlChange = useCallback((newUrl: string) => {
    setUrl(newUrl);
    if (!syncingRef.current) {
      setParams(parseUrlParams(newUrl));
    }
  }, []);

  /* --- Send request --- */
  const sendRequest = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setResponseTab("body");

    const start = performance.now();

    try {
      const reqHeaders: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.enabled && h.key) reqHeaders[h.key] = h.value;
      });

      /* Auth */
      if (authMode === "bearer" && bearerToken) {
        reqHeaders["Authorization"] = `Bearer ${bearerToken}`;
      } else if (authMode === "basic" && basicUser) {
        reqHeaders["Authorization"] = `Basic ${btoa(`${basicUser}:${basicPass}`)}`;
      }

      /* Body */
      let body: string | FormData | undefined;
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        if (bodyMode === "json") {
          reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
          body = bodyText;
        } else if (bodyMode === "text") {
          reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "text/plain";
          body = bodyText;
        } else if (bodyMode === "formdata") {
          const fd = new FormData();
          formDataRows.forEach((r) => {
            if (r.enabled && r.key) fd.append(r.key, r.value);
          });
          body = fd;
        }
      }

      const res = await fetch(url, { method, headers: reqHeaders, body });
      const elapsed = performance.now() - start;
      const text = await res.text();

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      const data: ResponseData = {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: text,
        time: Math.round(elapsed),
        size: new Blob([text]).size,
      };

      setResponse(data);
      addHistory(method, url, data.status);
    } catch (err: unknown) {
      const elapsed = performance.now() - start;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      addHistory(method, url, null);
      void elapsed;
    } finally {
      setLoading(false);
    }
  }, [url, method, headers, bodyMode, bodyText, formDataRows, authMode, bearerToken, basicUser, basicPass]);

  function addHistory(m: HttpMethod, u: string, status: number | null) {
    setHistory((prev) => {
      const entry: HistoryEntry = { id: uid(), method: m, url: u, timestamp: Date.now(), status };
      return [entry, ...prev].slice(0, 10);
    });
  }

  function loadHistory(entry: HistoryEntry) {
    setMethod(entry.method);
    setUrl(entry.url);
    setParams(parseUrlParams(entry.url));
    setShowHistory(false);
  }

  async function copyResponse() {
    if (!response) return;
    await navigator.clipboard.writeText(response.body);
    setCopiedResp(true);
    setTimeout(() => setCopiedResp(false), 1500);
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>
        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Globe size={14} />
          <span className="text-sm font-semibold">API Tester</span>
        </div>

        {/* History toggle */}
        <button
          type="button"
          onClick={() => setShowHistory((p) => !p)}
          className={`${btnSecondary} ml-auto relative`}
        >
          <History size={12} />
          History
          {history.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[10px] flex items-center justify-center">
              {history.length}
            </span>
          )}
        </button>
      </header>

      {/* ---- URL bar ---- */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        {/* Method dropdown */}
        <div ref={methodRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMethodOpen((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-bold hover:bg-[var(--surface-hover)] min-w-[100px] justify-between"
            style={{ color: METHOD_COLORS[method] }}
          >
            {method}
            <ChevronDown size={13} className="text-[var(--muted)]" />
          </button>
          {methodOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    setMethodOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm font-bold hover:bg-[var(--surface-hover)]"
                  style={{ color: METHOD_COLORS[m] }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* URL input */}
        <input
          type="text"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendRequest();
          }}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={sendRequest}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] text-sm font-semibold px-5 py-2 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send
        </button>
      </div>

      {/* ---- CORS note ---- */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] shrink-0">
        <AlertTriangle size={12} />
        <span className="text-[11px]">
          Browser CORS restrictions may block some cross-origin requests. Use a proxy or backend for full control.
        </span>
      </div>

      {/* ---- Main content ---- */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* History overlay */}
        {showHistory && (
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 shrink-0 max-h-52 overflow-y-auto">
            <div className="text-xs font-semibold text-[var(--muted)] mb-2">Recent Requests</div>
            {history.length === 0 ? (
              <div className="text-xs text-[var(--muted)]">No history yet.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => loadHistory(entry)}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-left w-full"
                  >
                    <span
                      className="text-xs font-bold w-16 shrink-0"
                      style={{ color: METHOD_COLORS[entry.method] }}
                    >
                      {entry.method}
                    </span>
                    <span className="text-xs font-mono text-[var(--foreground)] truncate flex-1">
                      {entry.url}
                    </span>
                    {entry.status !== null && (
                      <span
                        className="text-xs font-bold shrink-0"
                        style={{ color: statusColor(entry.status) }}
                      >
                        {entry.status}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--muted)] shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- Request tabs panel ---- */}
        <div className="border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          <div className="flex items-center gap-1 px-4 py-2">
            {(["params", "headers", "body", "auth"] as RequestTab[]).map((tab) => (
              <Tab
                key={tab}
                label={tab === "params" ? "Params" : tab === "headers" ? "Headers" : tab === "body" ? "Body" : "Auth"}
                active={requestTab === tab}
                onClick={() => setRequestTab(tab)}
              />
            ))}
          </div>
        </div>

        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 shrink-0 max-h-64 overflow-y-auto">
          {/* Params */}
          {requestTab === "params" && (
            <KeyValueEditor rows={params} onChange={handleParamsChange} />
          )}

          {/* Headers */}
          {requestTab === "headers" && (
            <KeyValueEditor rows={headers} onChange={setHeaders} suggestions={COMMON_HEADERS} />
          )}

          {/* Body */}
          {requestTab === "body" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                {(["none", "json", "text", "formdata"] as BodyMode[]).map((mode) => (
                  <Tab
                    key={mode}
                    label={mode === "formdata" ? "Form Data" : mode === "json" ? "JSON" : mode === "text" ? "Text" : "None"}
                    active={bodyMode === mode}
                    onClick={() => setBodyMode(mode)}
                  />
                ))}
              </div>
              {bodyMode === "none" && (
                <div className="text-xs text-[var(--muted)] py-2">No body for this request.</div>
              )}
              {(bodyMode === "json" || bodyMode === "text") && (
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder={bodyMode === "json" ? '{\n  "key": "value"\n}' : "Enter request body..."}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono resize-none h-28"
                  spellCheck={false}
                />
              )}
              {bodyMode === "formdata" && (
                <KeyValueEditor rows={formDataRows} onChange={setFormDataRows} />
              )}
            </div>
          )}

          {/* Auth */}
          {requestTab === "auth" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                {(["none", "bearer", "basic"] as AuthMode[]).map((mode) => (
                  <Tab
                    key={mode}
                    label={mode === "bearer" ? "Bearer Token" : mode === "basic" ? "Basic Auth" : "None"}
                    active={authMode === mode}
                    onClick={() => setAuthMode(mode)}
                  />
                ))}
              </div>
              {authMode === "none" && (
                <div className="text-xs text-[var(--muted)] py-2">No authentication.</div>
              )}
              {authMode === "bearer" && (
                <input
                  type="text"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="Enter bearer token..."
                  className={`${inputClass} font-mono`}
                />
              )}
              {authMode === "basic" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={basicUser}
                    onChange={(e) => setBasicUser(e.target.value)}
                    placeholder="Username"
                    className={inputClass}
                  />
                  <input
                    type="password"
                    value={basicPass}
                    onChange={(e) => setBasicPass(e.target.value)}
                    placeholder="Password"
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Response panel ---- */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Response header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
            <span className="text-xs font-semibold text-[var(--muted)]">Response</span>

            {response && (
              <>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{
                    color: statusColor(response.status),
                    backgroundColor: `${statusColor(response.status)}18`,
                  }}
                >
                  {response.status} {response.statusText}
                </span>
                <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                  <Clock size={11} />
                  {response.time} ms
                </span>
                <span className="text-xs text-[var(--muted)]">{formatBytes(response.size)}</span>
              </>
            )}

            <div className="ml-auto flex items-center gap-1">
              {response && (
                <button
                  type="button"
                  onClick={copyResponse}
                  className={btnSecondary}
                >
                  {copiedResp ? <Check size={12} /> : <Copy size={12} />}
                  {copiedResp ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>

          {/* Response tabs */}
          {response && (
            <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
              {(["body", "headers", "timing"] as ResponseTab[]).map((tab) => (
                <Tab
                  key={tab}
                  label={tab === "body" ? "Body" : tab === "headers" ? "Headers" : "Timing"}
                  active={responseTab === tab}
                  onClick={() => setResponseTab(tab)}
                />
              ))}
            </div>
          )}

          {/* Response body */}
          <div className="flex-1 overflow-auto bg-[var(--background)] p-4">
            {loading && (
              <div className="flex items-center justify-center h-full text-[var(--muted)]">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Sending request...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <AlertTriangle size={24} className="text-red-500" />
                <span className="text-sm font-semibold text-red-500">Request Failed</span>
                <span className="text-xs text-[var(--muted)] max-w-md">{error}</span>
              </div>
            )}

            {!response && !loading && !error && (
              <div className="flex items-center justify-center h-full text-[var(--muted)]">
                <span className="text-sm">Enter a URL and click Send to make a request.</span>
              </div>
            )}

            {response && !loading && (
              <>
                {responseTab === "body" && (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all text-[var(--foreground)] leading-relaxed">
                    {tryPrettyJson(response.body) || "(empty response)"}
                  </pre>
                )}

                {responseTab === "headers" && (
                  <div className="flex flex-col gap-1">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className="flex gap-3 text-xs font-mono py-1 border-b border-[var(--border)]">
                        <span className="font-semibold text-[var(--accent)] shrink-0 min-w-[180px]">{k}</span>
                        <span className="text-[var(--foreground)] break-all">{v}</span>
                      </div>
                    ))}
                    {Object.keys(response.headers).length === 0 && (
                      <div className="text-xs text-[var(--muted)]">
                        No headers exposed. CORS may restrict visible headers.
                      </div>
                    )}
                  </div>
                )}

                {responseTab === "timing" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">Total Time</span>
                        <span className="text-2xl font-bold text-[var(--foreground)]">{response.time} ms</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">Response Size</span>
                        <span className="text-2xl font-bold text-[var(--foreground)]">{formatBytes(response.size)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--muted)]">Status</span>
                        <span
                          className="text-2xl font-bold"
                          style={{ color: statusColor(response.status) }}
                        >
                          {response.status}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((response.time / 2000) * 100, 100)}%`,
                          backgroundColor: response.time < 200 ? "#22c55e" : response.time < 1000 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--muted)]">
                      <span>0 ms</span>
                      <span>200 ms</span>
                      <span>1000 ms</span>
                      <span>2000 ms</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

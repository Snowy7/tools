"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Copy,
  FileCode,
  FileUp,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Download,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Mode =
  | "base64-encode"
  | "base64-decode"
  | "url-encode"
  | "url-decode"
  | "html-encode"
  | "html-decode"
  | "hex-encode"
  | "hex-decode";

interface ModeInfo {
  key: Mode;
  label: string;
  shortLabel: string;
  inverse: Mode;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MODES: ModeInfo[] = [
  { key: "base64-encode", label: "Base64 Encode", shortLabel: "B64 Enc", inverse: "base64-decode" },
  { key: "base64-decode", label: "Base64 Decode", shortLabel: "B64 Dec", inverse: "base64-encode" },
  { key: "url-encode", label: "URL Encode", shortLabel: "URL Enc", inverse: "url-decode" },
  { key: "url-decode", label: "URL Decode", shortLabel: "URL Dec", inverse: "url-encode" },
  { key: "html-encode", label: "HTML Encode", shortLabel: "HTML Enc", inverse: "html-decode" },
  { key: "html-decode", label: "HTML Decode", shortLabel: "HTML Dec", inverse: "html-encode" },
  { key: "hex-encode", label: "Hex Encode", shortLabel: "Hex Enc", inverse: "hex-decode" },
  { key: "hex-decode", label: "Hex Decode", shortLabel: "Hex Dec", inverse: "hex-encode" },
];

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_DECODE_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": "\u00A0",
  "&copy;": "\u00A9",
  "&reg;": "\u00AE",
  "&trade;": "\u2122",
  "&euro;": "\u20AC",
  "&pound;": "\u00A3",
  "&yen;": "\u00A5",
  "&cent;": "\u00A2",
  "&mdash;": "\u2014",
  "&ndash;": "\u2013",
  "&hellip;": "\u2026",
  "&laquo;": "\u00AB",
  "&raquo;": "\u00BB",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function byteCount(text: string): number {
  return textToBytes(text).length;
}

function toUrlSafeBase64(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlSafeBase64(b64: string): string {
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return s;
}

function wrapLines(str: string, lineLen: number): string {
  const lines: string[] = [];
  for (let i = 0; i < str.length; i += lineLen) {
    lines.push(str.slice(i, i + lineLen));
  }
  return lines.join("\n");
}

function htmlEncode(text: string, encodeAll: boolean): string {
  if (encodeAll) {
    return Array.from(text)
      .map((ch) => {
        const code = ch.codePointAt(0)!;
        if (code > 127 || HTML_ENTITIES[ch]) {
          return HTML_ENTITIES[ch] || `&#${code};`;
        }
        return ch;
      })
      .join("");
  }
  return text.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] || ch);
}

function htmlDecode(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_DECODE_MAP)) {
    result = result.split(entity).join(char);
  }
  // Handle numeric entities: &#123; and &#x1F; forms
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  return result;
}

function hexEncode(text: string): string {
  return Array.from(textToBytes(text))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexDecode(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex string must have an even number of characters");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (isNaN(byte)) throw new Error(`Invalid hex characters at position ${i}`);
    bytes[i / 2] = byte;
  }
  return bytesToText(bytes);
}

function isValidBase64(str: string): boolean {
  const clean = str.replace(/\s+/g, "");
  if (clean.length === 0) return false;
  return /^[A-Za-z0-9+/\-_]*={0,2}$/.test(clean);
}

function isValidHex(str: string): boolean {
  const clean = str.replace(/\s+/g, "");
  return clean.length > 0 && clean.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(clean);
}

function smartDetect(input: string): Mode {
  const trimmed = input.trim();
  if (!trimmed) return "base64-encode";
  if (trimmed.startsWith("data:")) return "base64-decode";
  if (/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/.test(trimmed)) return "html-decode";
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) return "url-decode";
  if (isValidHex(trimmed) && trimmed.length >= 4) return "hex-decode";
  if (isValidBase64(trimmed) && trimmed.length >= 4) return "base64-decode";
  return "base64-encode";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Base64ToolPage() {
  const [mode, setMode] = useState<Mode>("base64-encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileMode, setFileMode] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileMime, setFileMime] = useState<string>("application/octet-stream");

  // Options
  const [lineWrap, setLineWrap] = useState(false);
  const [urlSafeBase64, setUrlSafeBase64] = useState(false);
  const [spacesAsPlus, setSpacesAsPlus] = useState(false);
  const [encodeAllHtml, setEncodeAllHtml] = useState(false);
  const [dataUriPrefix, setDataUriPrefix] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const modeInfo = useMemo(() => MODES.find((m) => m.key === mode)!, [mode]);

  /* ---- Conversion ---- */
  const convert = useCallback(
    (text: string): string => {
      if (!text && !fileData) return "";
      try {
        switch (mode) {
          case "base64-encode": {
            if (fileMode && fileData) {
              let b64 = arrayBufferToBase64(fileData);
              if (urlSafeBase64) b64 = toUrlSafeBase64(b64);
              if (lineWrap) b64 = wrapLines(b64, 76);
              if (dataUriPrefix) b64 = `data:${fileMime};base64,${b64}`;
              return b64;
            }
            let b64 = btoa(unescape(encodeURIComponent(text)));
            if (urlSafeBase64) b64 = toUrlSafeBase64(b64);
            if (lineWrap) b64 = wrapLines(b64, 76);
            return b64;
          }
          case "base64-decode": {
            let clean = text.trim();
            if (clean.startsWith("data:")) {
              clean = clean.split(",")[1] || "";
            }
            clean = clean.replace(/\s+/g, "");
            if (urlSafeBase64) clean = fromUrlSafeBase64(clean);
            return decodeURIComponent(escape(atob(clean)));
          }
          case "url-encode": {
            let encoded = encodeURIComponent(text);
            if (spacesAsPlus) encoded = encoded.replace(/%20/g, "+");
            return encoded;
          }
          case "url-decode": {
            let decoded = text;
            if (spacesAsPlus) decoded = decoded.replace(/\+/g, "%20");
            return decodeURIComponent(decoded);
          }
          case "html-encode":
            return htmlEncode(text, encodeAllHtml);
          case "html-decode":
            return htmlDecode(text);
          case "hex-encode":
            return hexEncode(text);
          case "hex-decode":
            return hexDecode(text);
          default:
            return text;
        }
      } catch (e: unknown) {
        throw new Error(e instanceof Error ? e.message : "Conversion failed");
      }
    },
    [mode, fileMode, fileData, fileMime, urlSafeBase64, lineWrap, dataUriPrefix, spacesAsPlus, encodeAllHtml],
  );

  /* ---- Live conversion ---- */
  useEffect(() => {
    try {
      const result = convert(input);
      setOutput(result);
      setError(null);
    } catch (e: unknown) {
      setOutput("");
      setError(e instanceof Error ? e.message : "Conversion failed");
    }
  }, [input, convert]);

  /* ---- File handling ---- */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setFileMime(file.type || "application/octet-stream");

      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        setFileData(buffer);
        setInput(`[File: ${file.name} (${formatBytes(buffer.byteLength)})]`);
      };
      reader.readAsArrayBuffer(file);
    },
    [],
  );

  const handleDownloadDecoded = useCallback(() => {
    if (!output) return;
    try {
      const inputClean = input.trim().startsWith("data:") ? input.trim().split(",")[1] || "" : input.trim().replace(/\s+/g, "");
      const buffer = base64ToArrayBuffer(urlSafeBase64 ? fromUrlSafeBase64(inputClean) : inputClean);
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "decoded-file";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Text download fallback
      const blob = new Blob([output], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "decoded.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [input, output, urlSafeBase64]);

  /* ---- Actions ---- */
  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const handleSwap = useCallback(() => {
    const newMode = modeInfo.inverse;
    setMode(newMode);
    setInput(output);
    setFileMode(false);
    setFileData(null);
    setFileName(null);
  }, [output, modeInfo]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setFileData(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSmartDetect = useCallback(() => {
    const detected = smartDetect(input);
    setMode(detected);
  }, [input]);

  const toggleFileMode = useCallback(() => {
    setFileMode((prev) => !prev);
    setFileData(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ---- Stats ---- */
  const inputChars = input.length;
  const inputBytes = useMemo(() => byteCount(input), [input]);
  const outputChars = output.length;
  const outputBytes = useMemo(() => byteCount(output), [output]);

  /* ---- Options panel for current mode ---- */
  const showBase64Options = mode === "base64-encode" || mode === "base64-decode";
  const showUrlOptions = mode === "url-encode";
  const showHtmlOptions = mode === "html-encode";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <FileCode size={14} />
          <span className="text-sm font-semibold">Encode / Decode</span>
        </div>

        {/* Smart detect */}
        <button
          type="button"
          onClick={handleSmartDetect}
          title="Auto-detect input format"
          className="ml-4 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Sparkles size={12} />
          Smart Detect
        </button>

        {/* File mode toggle */}
        <button
          type="button"
          onClick={toggleFileMode}
          title="Toggle file input mode"
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            fileMode
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          <FileUp size={12} />
          File
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={handleClear}
          title="Clear all"
          className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </header>

      {/* ---- Mode Tabs ---- */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0 overflow-x-auto">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              mode === m.key
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            }`}
          >
            {m.shortLabel}
          </button>
        ))}
      </div>

      {/* ---- Options Bar ---- */}
      {(showBase64Options || showUrlOptions || showHtmlOptions) && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0 text-xs">
          {showBase64Options && (
            <>
              <button
                type="button"
                onClick={() => setUrlSafeBase64(!urlSafeBase64)}
                className="inline-flex items-center gap-1.5 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
              >
                {urlSafeBase64 ? <ToggleRight size={14} className="text-[var(--accent)]" /> : <ToggleLeft size={14} />}
                URL-safe
              </button>
              {mode === "base64-encode" && (
                <>
                  <button
                    type="button"
                    onClick={() => setLineWrap(!lineWrap)}
                    className="inline-flex items-center gap-1.5 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                  >
                    {lineWrap ? <ToggleRight size={14} className="text-[var(--accent)]" /> : <ToggleLeft size={14} />}
                    Line wrap (76)
                  </button>
                  {fileMode && (
                    <button
                      type="button"
                      onClick={() => setDataUriPrefix(!dataUriPrefix)}
                      className="inline-flex items-center gap-1.5 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                    >
                      {dataUriPrefix ? <ToggleRight size={14} className="text-[var(--accent)]" /> : <ToggleLeft size={14} />}
                      data: URI
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {showUrlOptions && (
            <button
              type="button"
              onClick={() => setSpacesAsPlus(!spacesAsPlus)}
              className="inline-flex items-center gap-1.5 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
            >
              {spacesAsPlus ? <ToggleRight size={14} className="text-[var(--accent)]" /> : <ToggleLeft size={14} />}
              Spaces as +
            </button>
          )}
          {showHtmlOptions && (
            <button
              type="button"
              onClick={() => setEncodeAllHtml(!encodeAllHtml)}
              className="inline-flex items-center gap-1.5 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
            >
              {encodeAllHtml ? <ToggleRight size={14} className="text-[var(--accent)]" /> : <ToggleLeft size={14} />}
              Encode all chars
            </button>
          )}
        </div>
      )}

      {/* ---- Main Content: Split View ---- */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel: Input */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border)]">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Input</span>
            <span className="text-[10px] text-[var(--muted)] ml-auto font-mono">
              {inputChars} chars / {inputBytes} bytes
            </span>
          </div>

          {fileMode && mode === "base64-encode" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <FileUp size={32} className="text-[var(--muted)] mb-3" />
                <span className="text-sm text-[var(--foreground)] font-medium">
                  {fileName || "Click to upload a file"}
                </span>
                <span className="text-xs text-[var(--muted)] mt-1">Any file type supported</span>
              </label>
              {fileName && fileData && (
                <span className="text-xs text-[var(--muted)]">
                  {fileName} ({formatBytes(fileData.byteLength)})
                </span>
              )}
            </div>
          ) : (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or paste your input here..."
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-4 outline-none placeholder:text-[var(--muted)]/40"
            />
          )}
        </div>

        {/* Center: Swap button */}
        <div className="flex items-center justify-center flex-shrink-0">
          <button
            type="button"
            onClick={handleSwap}
            title="Swap input and output (switches to inverse mode)"
            className="w-9 h-9 -mx-[18px] z-10 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] flex items-center justify-center text-[var(--muted)] transition-colors"
          >
            <ArrowRightLeft size={14} />
          </button>
        </div>

        {/* Right panel: Output */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Output</span>
            <span className="text-[10px] text-[var(--muted)] ml-auto font-mono">
              {outputChars} chars / {outputBytes} bytes
            </span>
          </div>

          {error ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-sm text-red-500 font-mono text-center max-w-md">{error}</p>
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              className="flex-1 w-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-4 outline-none"
            />
          )}
        </div>
      </div>

      {/* ---- Bottom Bar ---- */}
      <footer className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <span className="text-xs text-[var(--muted)]">{modeInfo.label}</span>

        {error && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            Error in conversion
          </span>
        )}

        {!error && output && (
          <span className="text-xs text-[var(--muted)]">
            {inputBytes} bytes in / {outputBytes} bytes out
            {outputBytes > 0 && inputBytes > 0 && (
              <> ({((outputBytes / inputBytes) * 100).toFixed(0)}%)</>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {mode === "base64-decode" && output && (
            <button
              type="button"
              onClick={handleDownloadDecoded}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Download size={12} />
              Download
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!output}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            type="button"
            onClick={handleSwap}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowRightLeft size={12} />
            Swap
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

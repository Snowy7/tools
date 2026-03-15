"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Dice5,
  FileUp,
  Hash,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = "uuid" | "hash";
type IdType = "uuid-v4" | "ulid" | "nanoid";
type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

/* ------------------------------------------------------------------ */
/*  UUID v4 Implementation                                             */
/* ------------------------------------------------------------------ */

function generateUUIDv4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Manual fallback
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/* ------------------------------------------------------------------ */
/*  ULID Implementation                                                */
/* ------------------------------------------------------------------ */

const ULID_ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateULID(): string {
  const now = Date.now();
  let timeStr = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    timeStr = ULID_ENCODING[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  let randomStr = "";
  for (let i = 0; i < 16; i++) {
    const byteIndex = Math.floor((i * 10) / 16);
    const val = randomBytes[byteIndex] % 32;
    randomStr += ULID_ENCODING[val];
  }
  return timeStr + randomStr;
}

/* ------------------------------------------------------------------ */
/*  Nanoid-style Implementation                                        */
/* ------------------------------------------------------------------ */

const NANOID_DEFAULT_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function generateNanoid(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1;
  let id = "";
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] & mask] || alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

/* ------------------------------------------------------------------ */
/*  Hash Helpers                                                       */
/* ------------------------------------------------------------------ */

async function computeHash(
  data: ArrayBuffer,
  algorithm: HashAlgorithm,
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashText(
  text: string,
  algorithm: HashAlgorithm,
): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  return computeHash(encoded.buffer as ArrayBuffer, algorithm);
}

async function hashFile(
  file: File,
  algorithm: HashAlgorithm,
): Promise<string> {
  const buffer = await file.arrayBuffer();
  return computeHash(buffer, algorithm);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function UuidHashPage() {
  const [tab, setTab] = useState<Tab>("uuid");

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
          <Hash size={14} />
          <span className="text-sm font-semibold">UUID &amp; Hash Generator</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <button
          type="button"
          onClick={() => setTab("uuid")}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            tab === "uuid"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Dice5 size={12} />
            UUID Generator
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("hash")}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            tab === "hash"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Hash size={12} />
            Hash Generator
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "uuid" ? <UuidPanel /> : <HashPanel />}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  UUID Panel                                                         */
/* ================================================================== */

function UuidPanel() {
  const [idType, setIdType] = useState<IdType>("uuid-v4");
  const [ids, setIds] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Nanoid options
  const [nanoidLength, setNanoidLength] = useState(21);
  const [nanoidAlphabet, setNanoidAlphabet] = useState(NANOID_DEFAULT_ALPHABET);

  const generate = useCallback(() => {
    const newIds: string[] = [];
    for (let i = 0; i < count; i++) {
      let id: string;
      switch (idType) {
        case "uuid-v4":
          id = generateUUIDv4();
          break;
        case "ulid":
          id = generateULID();
          break;
        case "nanoid":
          id = generateNanoid(nanoidLength, nanoidAlphabet || NANOID_DEFAULT_ALPHABET);
          break;
        default:
          id = generateUUIDv4();
      }
      newIds.push(id);
    }
    setIds(newIds);
    setCopiedIndex(null);
    setCopiedAll(false);
  }, [count, idType, nanoidLength, nanoidAlphabet]);

  const formatId = useCallback(
    (id: string): string => {
      let result = id;
      if (idType === "uuid-v4" && noDashes) {
        result = result.replace(/-/g, "");
      }
      if (uppercase) {
        result = result.toUpperCase();
      } else if (idType !== "ulid") {
        result = result.toLowerCase();
      }
      return result;
    },
    [uppercase, noDashes, idType],
  );

  const formattedIds = useMemo(() => ids.map(formatId), [ids, formatId]);

  const handleCopyOne = useCallback(
    async (index: number) => {
      await navigator.clipboard.writeText(formattedIds[index]);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    },
    [formattedIds],
  );

  const handleCopyAll = useCallback(async () => {
    await navigator.clipboard.writeText(formattedIds.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }, [formattedIds]);

  const handleClear = useCallback(() => {
    setIds([]);
    setCopiedIndex(null);
    setCopiedAll(false);
  }, []);

  // Generate one on mount
  useEffect(() => {
    setIds([generateUUIDv4()]);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        {/* ID type selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] overflow-hidden">
          {(["uuid-v4", "ulid", "nanoid"] as IdType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setIdType(t)}
              className={`text-xs font-medium px-2.5 py-1.5 transition-colors ${
                idType === t
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              }`}
            >
              {t === "uuid-v4" ? "UUID v4" : t === "ulid" ? "ULID" : "Nanoid"}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="uuid-count" className="text-xs text-[var(--muted)]">
            Count:
          </label>
          <input
            id="uuid-count"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
            }
            className="w-16 text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] text-center"
          />
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={generate}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          <RefreshCw size={12} />
          Generate
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Options */}
        {idType === "uuid-v4" && (
          <button
            type="button"
            onClick={() => setNoDashes(!noDashes)}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
          >
            {noDashes ? (
              <ToggleRight size={14} className="text-[var(--accent)]" />
            ) : (
              <ToggleLeft size={14} />
            )}
            No dashes
          </button>
        )}

        <button
          type="button"
          onClick={() => setUppercase(!uppercase)}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
        >
          {uppercase ? (
            <ToggleRight size={14} className="text-[var(--accent)]" />
          ) : (
            <ToggleLeft size={14} />
          )}
          Uppercase
        </button>

        {/* Copy All & Clear */}
        {formattedIds.length > 0 && (
          <>
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {copiedAll ? (
                <Check size={12} className="text-green-500" />
              ) : (
                <Copy size={12} />
              )}
              {copiedAll ? "Copied" : "Copy All"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* Nanoid options row */}
      {idType === "nanoid" && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <label htmlFor="nanoid-length" className="text-xs text-[var(--muted)]">
              Length:
            </label>
            <input
              id="nanoid-length"
              type="range"
              min={6}
              max={36}
              value={nanoidLength}
              onChange={(e) => setNanoidLength(parseInt(e.target.value))}
              className="w-28 accent-[var(--accent)]"
            />
            <span className="text-xs text-[var(--foreground)] font-mono w-6 text-center">
              {nanoidLength}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <label htmlFor="nanoid-alphabet" className="text-xs text-[var(--muted)] flex-shrink-0">
              Alphabet:
            </label>
            <input
              id="nanoid-alphabet"
              type="text"
              value={nanoidAlphabet}
              onChange={(e) => setNanoidAlphabet(e.target.value)}
              placeholder={NANOID_DEFAULT_ALPHABET}
              className="flex-1 min-w-0 text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      )}

      {/* Output */}
      <div className="flex-1 overflow-auto p-4">
        {formattedIds.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
            Click Generate to create IDs
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {formattedIds.map((id, i) => (
              <div
                key={`${id}-${i}`}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                <span className="text-[10px] text-[var(--muted)] font-mono w-6 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 font-mono text-sm text-[var(--foreground)] select-all break-all">
                  {id}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyOne(i)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                  aria-label={`Copy ID ${i + 1}`}
                >
                  {copiedIndex === i ? (
                    <Check size={12} className="text-green-500" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Hash Panel                                                         */
/* ================================================================== */

function HashPanel() {
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [hashResult, setHashResult] = useState("");
  const [isHashing, setIsHashing] = useState(false);
  const [uppercase, setUppercase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareHash, setCompareHash] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const algorithms: HashAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

  // Auto-compute hash when text/file/algorithm changes
  useEffect(() => {
    let cancelled = false;

    async function compute() {
      if (inputMode === "text") {
        if (!text) {
          setHashResult("");
          setError(null);
          return;
        }
        setIsHashing(true);
        setError(null);
        try {
          const result = await hashText(text, algorithm);
          if (!cancelled) setHashResult(result);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Hashing failed");
            setHashResult("");
          }
        } finally {
          if (!cancelled) setIsHashing(false);
        }
      } else {
        if (!file) {
          setHashResult("");
          setError(null);
          return;
        }
        setIsHashing(true);
        setError(null);
        try {
          const result = await hashFile(file, algorithm);
          if (!cancelled) setHashResult(result);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Hashing failed");
            setHashResult("");
          }
        } finally {
          if (!cancelled) setIsHashing(false);
        }
      }
    }

    compute();
    return () => {
      cancelled = true;
    };
  }, [text, file, algorithm, inputMode]);

  const formattedHash = useMemo(
    () => (uppercase ? hashResult.toUpperCase() : hashResult.toLowerCase()),
    [hashResult, uppercase],
  );

  const compareResult = useMemo(() => {
    if (!compareMode || !compareHash.trim() || !formattedHash) return null;
    const a = compareHash.trim().toLowerCase().replace(/\s+/g, "");
    const b = hashResult.toLowerCase().replace(/\s+/g, "");
    return a === b;
  }, [compareMode, compareHash, hashResult, formattedHash]);

  const handleCopy = useCallback(async () => {
    if (!formattedHash) return;
    await navigator.clipboard.writeText(formattedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [formattedHash]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) setFile(f);
    },
    [],
  );

  const handleClear = useCallback(() => {
    setText("");
    setFile(null);
    setHashResult("");
    setError(null);
    setCompareHash("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        {/* Algorithm selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] overflow-hidden">
          {algorithms.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlgorithm(a)}
              className={`text-xs font-medium px-2.5 py-1.5 transition-colors ${
                algorithm === a
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Input mode */}
        <button
          type="button"
          onClick={() => {
            setInputMode(inputMode === "text" ? "file" : "text");
            setFile(null);
            setText("");
            setHashResult("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            inputMode === "file"
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          <FileUp size={12} />
          File
        </button>

        {/* Uppercase toggle */}
        <button
          type="button"
          onClick={() => setUppercase(!uppercase)}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
        >
          {uppercase ? (
            <ToggleRight size={14} className="text-[var(--accent)]" />
          ) : (
            <ToggleLeft size={14} />
          )}
          Uppercase
        </button>

        {/* Compare toggle */}
        <button
          type="button"
          onClick={() => setCompareMode(!compareMode)}
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            compareMode
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          <ShieldCheck size={12} />
          Compare
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Input side */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border)]">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              Input
            </span>
            {inputMode === "text" && text && (
              <span className="text-[10px] text-[var(--muted)] ml-auto font-mono">
                {new TextEncoder().encode(text).length} bytes
              </span>
            )}
            {inputMode === "file" && file && (
              <span className="text-[10px] text-[var(--muted)] ml-auto font-mono">
                {formatBytes(file.size)}
              </span>
            )}
          </div>

          {inputMode === "text" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to hash..."
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent font-mono text-sm text-[var(--foreground)] p-4 outline-none placeholder:text-[var(--muted)]/40"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="hash-file-upload"
              />
              <label
                htmlFor="hash-file-upload"
                className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <FileUp size={32} className="text-[var(--muted)] mb-3" />
                <span className="text-sm text-[var(--foreground)] font-medium">
                  {file ? file.name : "Click to upload a file"}
                </span>
                <span className="text-xs text-[var(--muted)] mt-1">
                  Any file type supported
                </span>
              </label>
              {file && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)]">
                    {file.name} ({formatBytes(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setHashResult("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Output side */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              {algorithm} Hash
            </span>
            {formattedHash && (
              <span className="text-[10px] text-[var(--muted)] ml-auto font-mono">
                {formattedHash.length} hex chars
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
            {isHashing ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm text-[var(--muted)] animate-pulse">
                  Computing hash...
                </span>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-red-500 font-mono text-center max-w-md">
                  {error}
                </p>
              </div>
            ) : formattedHash ? (
              <>
                {/* Hash output */}
                <div className="relative">
                  <div className="font-mono text-sm text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 break-all select-all">
                    {formattedHash}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                    aria-label="Copy hash"
                  >
                    {copied ? (
                      <Check size={12} className="text-green-500" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>

                {/* Compare section */}
                {compareMode && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="compare-hash"
                      className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide"
                    >
                      Compare with known hash
                    </label>
                    <input
                      id="compare-hash"
                      type="text"
                      value={compareHash}
                      onChange={(e) => setCompareHash(e.target.value)}
                      placeholder="Paste a hash to compare..."
                      spellCheck={false}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/40"
                    />
                    {compareResult !== null && (
                      <div
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg w-fit ${
                          compareResult
                            ? "bg-green-500/10 text-green-500 border border-green-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}
                      >
                        {compareResult ? (
                          <>
                            <ShieldCheck size={12} />
                            Match -- hashes are identical
                          </>
                        ) : (
                          <>
                            <ShieldX size={12} />
                            Mismatch -- hashes differ
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
                {inputMode === "text"
                  ? "Enter text to compute its hash"
                  : "Upload a file to compute its hash"}
              </div>
            )}
          </div>
        </div>
      </div>
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

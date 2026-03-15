"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileWarning,
  Hash,
  KeyRound,
  Shield,
  Sparkles,
  User,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Sample JWT                                                                 */
/* -------------------------------------------------------------------------- */

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlNub3d5IiwiZW1haWwiOiJzbm93eUBzbm93eWRldi54eXoiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MTA0NjE2MDAsImV4cCI6MTc0MTk5NzYwMCwiaXNzIjoic25vd3lkZXYueHl6IiwiYXVkIjoiaHR0cHM6Ly90b29scy5zbm93eWRldi54eXoiLCJqdGkiOiJhYmMxMjMifQ.fake_signature_placeholder";

/* -------------------------------------------------------------------------- */
/*  Pure-JS JWT helpers (no external libraries)                                */
/* -------------------------------------------------------------------------- */

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const final = pad ? padded + "=".repeat(4 - pad) : padded;
  return atob(final);
}

interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  rawParts: [string, string, string];
}

function decodeJwt(token: string): DecodedJwt | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload, signature: parts[2], rawParts: [parts[0], parts[1], parts[2]] };
  } catch {
    return null;
  }
}

function getValidationError(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  if (parts.length !== 3) return `JWT must have 3 parts separated by dots, found ${parts.length}.`;
  try {
    base64UrlDecode(parts[0]);
  } catch {
    return "Header (part 1) contains invalid base64url characters.";
  }
  try {
    JSON.parse(base64UrlDecode(parts[0]));
  } catch {
    return "Header (part 1) is not valid JSON.";
  }
  try {
    base64UrlDecode(parts[1]);
  } catch {
    return "Payload (part 2) contains invalid base64url characters.";
  }
  try {
    JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return "Payload (part 2) is not valid JSON.";
  }
  return "Unknown error decoding JWT.";
}

/* -------------------------------------------------------------------------- */
/*  Time helpers                                                               */
/* -------------------------------------------------------------------------- */

function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function timeAgo(unix: number): string {
  const now = Date.now() / 1000;
  const diff = Math.abs(now - unix);
  const future = unix > now;
  const units: [string, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, seconds] of units) {
    const count = Math.floor(diff / seconds);
    if (count >= 1) {
      const label = count === 1 ? unit : unit + "s";
      return future ? `in ${count} ${label}` : `${count} ${label} ago`;
    }
  }
  return "just now";
}

function isExpired(payload: Record<string, unknown>): boolean | null {
  if (typeof payload.exp !== "number") return null;
  return payload.exp * 1000 < Date.now();
}

/* -------------------------------------------------------------------------- */
/*  Known claims map                                                           */
/* -------------------------------------------------------------------------- */

const CLAIM_LABELS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not Before",
  iat: "Issued At",
  jti: "JWT ID",
};

const TIMESTAMP_CLAIMS = new Set(["exp", "nbf", "iat"]);

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

/* -------------------------------------------------------------------------- */
/*  Collapsible Section component                                              */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} />
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Copy button helper                                                         */
/* -------------------------------------------------------------------------- */

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                        */
/* -------------------------------------------------------------------------- */

export default function JwtInspectorPage() {
  const [token, setToken] = useState("");

  const decoded = useMemo(() => decodeJwt(token), [token]);
  const error = useMemo(() => (token.trim() && !decoded ? getValidationError(token) : null), [token, decoded]);
  const expired = useMemo(() => (decoded ? isExpired(decoded.payload) : null), [decoded]);

  const handlePasteSample = useCallback(() => {
    setToken(SAMPLE_JWT);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* ------------------------------------------------------------------ */}
      {/*  Header                                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>
        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <KeyRound size={14} />
          <span className="text-sm font-semibold">JWT Inspector</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePasteSample}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)]"
          >
            <Sparkles size={12} />
            Paste sample
          </button>
          <button
            type="button"
            onClick={() => setToken("")}
            disabled={!token}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-xs px-2.5 py-1 text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/*  Content: two-panel split                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ---- Left panel: JWT input ---- */}
        <div className="flex-1 flex flex-col border-r border-[var(--border)] min-w-0">
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full resize-none bg-[var(--background)] text-[var(--foreground)] font-mono text-sm leading-6 p-4 outline-none"
            placeholder="Paste your JWT token here..."
          />

          {/* Token part preview */}
          {decoded && (
            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0 overflow-x-auto">
              <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2 font-semibold">
                Token Parts
              </p>
              <div className="font-mono text-xs break-all leading-5">
                <span className="text-orange-400">{decoded.rawParts[0]}</span>
                <span className="text-[var(--muted)]">.</span>
                <span className="text-violet-400">{decoded.rawParts[1]}</span>
                <span className="text-[var(--muted)]">.</span>
                <span className="text-emerald-400">{decoded.rawParts[2]}</span>
              </div>
            </div>
          )}

          {/* Footer: char count */}
          <div className="flex items-center px-4 py-1.5 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0 text-xs text-[var(--muted)]">
            {token.length.toLocaleString()} characters
          </div>
        </div>

        {/* ---- Right panel: Decoded output ---- */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {!token.trim() && (
            <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
              <div className="text-center space-y-2">
                <KeyRound size={32} className="mx-auto opacity-30" />
                <p>Paste a JWT token to inspect it</p>
              </div>
            </div>
          )}

          {token.trim() && !decoded && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-3 max-w-sm">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
                  <FileWarning size={20} className="text-red-400" />
                </div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Invalid JWT</p>
                <p className="text-xs text-[var(--muted)] leading-5">{error}</p>
              </div>
            </div>
          )}

          {decoded && (
            <div className="flex-1 overflow-y-auto">
              {/* Status bar */}
              <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400">
                  Valid JWT
                </span>
                {typeof decoded.header.alg === "string" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-400">
                    {decoded.header.alg}
                  </span>
                )}
                {typeof decoded.header.typ === "string" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-hover)] text-[var(--foreground)]">
                    {decoded.header.typ}
                  </span>
                )}
                {expired === true && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/15 text-red-400">
                    <Clock size={10} />
                    Expired
                  </span>
                )}
                {expired === false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400">
                    <Clock size={10} />
                    Active
                  </span>
                )}
              </div>

              {/* Header section */}
              <Section title="Header" icon={Shield} defaultOpen>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                    JOSE Header
                  </span>
                  <CopyButton text={JSON.stringify(decoded.header, null, 2)} />
                </div>
                <pre className="text-xs font-mono leading-6 bg-[var(--background)] rounded-lg p-3 overflow-x-auto text-[var(--foreground)]">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  {typeof decoded.header.alg === "string" && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                      alg: {decoded.header.alg}
                    </span>
                  )}
                  {typeof decoded.header.typ === "string" && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400">
                      typ: {decoded.header.typ}
                    </span>
                  )}
                </div>
              </Section>

              {/* Payload section */}
              <Section title="Payload" icon={User} defaultOpen>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                    Claims Set
                  </span>
                  <CopyButton text={JSON.stringify(decoded.payload, null, 2)} />
                </div>
                <pre className="text-xs font-mono leading-6 bg-[var(--background)] rounded-lg p-3 overflow-x-auto text-[var(--foreground)]">
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
                <div className="mt-3 space-y-1.5">
                  {Object.entries(decoded.payload).map(([key, value]) => {
                    const label = CLAIM_LABELS[key];
                    const isTimestamp = TIMESTAMP_CLAIMS.has(key) && typeof value === "number";
                    return (
                      <div
                        key={key}
                        className="flex items-start gap-2 text-xs py-1.5 border-b border-[var(--border)] last:border-0"
                      >
                        <span className="font-mono text-[var(--muted)] shrink-0 w-16">{key}</span>
                        {label && (
                          <span className="text-[var(--foreground)] font-medium shrink-0">{label}</span>
                        )}
                        <span className="text-[var(--foreground)] ml-auto text-right">
                          {isTimestamp ? (
                            <span className="space-x-2">
                              <span>{formatTimestamp(value as number)}</span>
                              <span className="text-[var(--muted)]">({timeAgo(value as number)})</span>
                            </span>
                          ) : (
                            <span className="font-mono">
                              {typeof value === "string" ? value : JSON.stringify(value)}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Claims analysis */}
              <Section title="Claims Analysis" icon={Hash} defaultOpen={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" role="table">
                    <thead>
                      <tr className="text-left text-[var(--muted)]">
                        <th className="pb-2 pr-4 font-semibold">Claim</th>
                        <th className="pb-2 pr-4 font-semibold">Type</th>
                        <th className="pb-2 pr-4 font-semibold">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(decoded.payload).map(([key, value]) => {
                        const isTimestamp = TIMESTAMP_CLAIMS.has(key) && typeof value === "number";
                        const displayValue = isTimestamp
                          ? `${value} (${formatTimestamp(value as number)})`
                          : typeof value === "string"
                            ? truncate(value, 60)
                            : truncate(JSON.stringify(value), 60);
                        return (
                          <tr key={key} className="border-t border-[var(--border)]">
                            <td className="py-2 pr-4 font-mono text-[var(--foreground)]">{key}</td>
                            <td className="py-2 pr-4">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--muted)] text-[10px] uppercase font-medium">
                                {typeOf(value)}
                              </span>
                            </td>
                            <td className="py-2 font-mono text-[var(--foreground)] break-all">
                              {displayValue}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Signature section */}
              <Section title="Signature" icon={KeyRound} defaultOpen={false}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                    Raw Signature
                  </span>
                  <CopyButton text={decoded.signature} />
                </div>
                <pre className="text-xs font-mono leading-6 bg-[var(--background)] rounded-lg p-3 overflow-x-auto text-[var(--foreground)] break-all whitespace-pre-wrap">
                  {decoded.signature}
                </pre>
                <p className="mt-2 text-[11px] text-[var(--muted)] leading-4">
                  Signature verification requires the secret/key and is not performed client-side.
                </p>
              </Section>

              {/* Token stats */}
              <Section title="Token Stats" icon={Hash} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Total Length", `${token.trim().length} chars`],
                    ["Header Size", `${decoded.rawParts[0].length} chars`],
                    ["Payload Size", `${decoded.rawParts[1].length} chars`],
                    ["Signature Size", `${decoded.rawParts[2].length} chars`],
                    ["Number of Claims", `${Object.keys(decoded.payload).length}`],
                    ["Header Fields", `${Object.keys(decoded.header).length}`],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-[var(--background)] rounded-lg p-3">
                      <p className="text-[11px] text-[var(--muted)] mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-[var(--foreground)] font-mono">{val}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

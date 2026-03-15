"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import QRCode from "qrcode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentType = "text" | "url" | "wifi" | "email" | "phone" | "sms";
type QRStyle = "square" | "dots" | "rounded";
type ErrorLevel = "L" | "M" | "Q" | "H";

interface WifiFields {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
}

interface EmailFields {
  to: string;
  subject: string;
  body: string;
}

interface PhoneFields {
  number: string;
}

interface SmsFields {
  number: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQRString(
  type: ContentType,
  text: string,
  wifi: WifiFields,
  email: EmailFields,
  phone: PhoneFields,
  sms: SmsFields
): string {
  switch (type) {
    case "url":
    case "text":
      return text;
    case "wifi":
      return `WIFI:T:${wifi.encryption};S:${wifi.ssid};P:${wifi.password};;`;
    case "email": {
      const params = new URLSearchParams();
      if (email.subject) params.set("subject", email.subject);
      if (email.body) params.set("body", email.body);
      const qs = params.toString();
      return `mailto:${email.to}${qs ? "?" + qs : ""}`;
    }
    case "phone":
      return `tel:${phone.number}`;
    case "sms": {
      const msg = sms.message ? `?body=${encodeURIComponent(sms.message)}` : "";
      return `sms:${sms.number}${msg}`;
    }
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
      >
        {title}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable inputs
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
      {children}
    </label>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0 disabled:opacity-40"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 text-sm font-mono px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] disabled:opacity-40"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function QRGeneratorPage() {
  // Content state
  const [contentType, setContentType] = useState<ContentType>("text");
  const [text, setText] = useState("https://example.com");
  const [wifi, setWifi] = useState<WifiFields>({
    ssid: "",
    password: "",
    encryption: "WPA",
  });
  const [email, setEmail] = useState<EmailFields>({
    to: "",
    subject: "",
    body: "",
  });
  const [phone, setPhone] = useState<PhoneFields>({ number: "" });
  const [sms, setSms] = useState<SmsFields>({ number: "", message: "" });

  // Appearance
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparentBg, setTransparentBg] = useState(false);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [qrStyle, setQrStyle] = useState<QRStyle>("square");

  // Error correction
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");

  // Size
  const [width, setWidth] = useState(800);
  const [margin, setMargin] = useState(4);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataURL, setLogoDataURL] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(20);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clipboard feedback
  const [copied, setCopied] = useState(false);

  // Build the QR data string
  const rawData = useMemo(
    () => buildQRString(contentType, text, wifi, email, phone, sms),
    [contentType, text, wifi, email, phone, sms]
  );
  const debouncedData = useDebounce(rawData, 300);
  const qrData = debouncedData || " ";

  // Read logo file into data URL
  useEffect(() => {
    if (!logoFile) {
      setLogoDataURL(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataURL(reader.result as string);
    reader.readAsDataURL(logoFile);
  }, [logoFile]);

  // ---------------------------------------------------------------------------
  // Render QR onto canvas
  // ---------------------------------------------------------------------------
  const renderQR = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const opts = {
      errorCorrectionLevel: errorLevel,
      margin,
      width,
      color: {
        dark: fgColor,
        light: transparentBg ? "#00000000" : bgColor,
      },
    };

    // For "square" style we can just use toCanvas
    if (qrStyle === "square") {
      try {
        await QRCode.toCanvas(canvas, qrData, opts);
      } catch {
        // invalid data, draw empty
        canvas.width = width;
        canvas.height = width;
        ctx.clearRect(0, 0, width, width);
        return;
      }
    } else {
      // Custom drawing for dots / rounded
      let qrObj: { modules: { size: number; data: Uint8Array } };
      try {
        qrObj = QRCode.create(qrData, {
          errorCorrectionLevel: errorLevel,
        }) as any;
      } catch {
        canvas.width = width;
        canvas.height = width;
        ctx.clearRect(0, 0, width, width);
        return;
      }

      const moduleCount = qrObj.modules.size;
      const totalModules = moduleCount + margin * 2;
      const moduleSize = width / totalModules;

      canvas.width = width;
      canvas.height = width;

      // Background
      if (!transparentBg) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, width);
      } else {
        ctx.clearRect(0, 0, width, width);
      }

      ctx.fillStyle = fgColor;

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          const idx = row * moduleCount + col;
          if (qrObj.modules.data[idx]) {
            const x = (col + margin) * moduleSize;
            const y = (row + margin) * moduleSize;

            if (qrStyle === "dots") {
              const radius = moduleSize / 2;
              ctx.beginPath();
              ctx.arc(x + radius, y + radius, radius * 0.85, 0, Math.PI * 2);
              ctx.fill();
            } else if (qrStyle === "rounded") {
              const r = Math.min(cornerRadius, moduleSize / 2) * (moduleSize / 50);
              const clampedR = Math.min(r, moduleSize / 2);
              const s = moduleSize * 0.95;
              const offset = (moduleSize - s) / 2;
              ctx.beginPath();
              ctx.roundRect(x + offset, y + offset, s, s, clampedR);
              ctx.fill();
            }
          }
        }
      }
    }

    // Draw logo overlay
    if (logoDataURL) {
      const img = new Image();
      img.onload = () => {
        const logoW = canvas.width * (logoSize / 100);
        const logoH = (img.height / img.width) * logoW;
        const lx = (canvas.width - logoW) / 2;
        const ly = (canvas.height - logoH) / 2;

        // White background pad behind logo
        const pad = logoW * 0.08;
        ctx.fillStyle = transparentBg ? "#ffffff" : bgColor;
        ctx.beginPath();
        ctx.roundRect(lx - pad, ly - pad, logoW + pad * 2, logoH + pad * 2, pad);
        ctx.fill();

        ctx.drawImage(img, lx, ly, logoW, logoH);
      };
      img.src = logoDataURL;
    }
  }, [
    qrData,
    fgColor,
    bgColor,
    transparentBg,
    cornerRadius,
    qrStyle,
    errorLevel,
    width,
    margin,
    logoDataURL,
    logoSize,
  ]);

  useEffect(() => {
    renderQR();
  }, [renderQR]);

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------
  const downloadPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qr-code.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const downloadSVG = useCallback(async () => {
    try {
      const svgStr = await QRCode.toString(qrData, {
        type: "svg",
        errorCorrectionLevel: errorLevel,
        margin,
        width,
        color: {
          dark: fgColor,
          light: transparentBg ? "#00000000" : bgColor,
        },
      });
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.download = "qr-code.svg";
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      // ignore invalid data
    }
  }, [qrData, errorLevel, margin, width, fgColor, bgColor, transparentBg]);

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // clipboard not available
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Content type tabs
  // ---------------------------------------------------------------------------
  const contentTypes: { value: ContentType; label: string }[] = [
    { value: "text", label: "Text" },
    { value: "url", label: "URL" },
    { value: "wifi", label: "WiFi" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "sms", label: "SMS" },
  ];

  const errorLevels: { value: ErrorLevel; label: string; desc: string }[] = [
    { value: "L", label: "L", desc: "7%" },
    { value: "M", label: "M", desc: "15%" },
    { value: "Q", label: "Q", desc: "25%" },
    { value: "H", label: "H", desc: "30%" },
  ];

  const styles: { value: QRStyle; label: string }[] = [
    { value: "square", label: "Square" },
    { value: "dots", label: "Dots" },
    { value: "rounded", label: "Rounded" },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <Link
          href="/"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Back to home"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
        <h1 className="text-base font-semibold">QR Generator</h1>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: Preview */}
        <div className="flex-[3] flex flex-col min-w-0">
          {/* Checkerboard preview area */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto p-8"
            style={{
              backgroundImage: `
                linear-gradient(45deg, var(--border) 25%, transparent 25%),
                linear-gradient(-45deg, var(--border) 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, var(--border) 75%),
                linear-gradient(-45deg, transparent 75%, var(--border) 75%)
              `,
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            }}
          >
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full"
              style={{
                imageRendering: "pixelated",
                width: Math.min(width, 500),
                height: Math.min(width, 500),
              }}
            />
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <button
              onClick={downloadPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PNG
            </button>
            <button
              onClick={downloadSVG}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              SVG
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {copied ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Right panel: Settings */}
        <div className="flex-[2] border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
          {/* Content */}
          <Section title="Content" defaultOpen>
            <div className="flex flex-wrap gap-1">
              {contentTypes.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setContentType(ct.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    contentType === ct.value
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>

            {(contentType === "text" || contentType === "url") && (
              <div className="flex flex-col gap-1">
                <Label>{contentType === "url" ? "URL" : "Text"}</Label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder={
                    contentType === "url"
                      ? "https://example.com"
                      : "Enter text..."
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            )}

            {contentType === "wifi" && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>SSID</Label>
                  <input
                    type="text"
                    value={wifi.ssid}
                    onChange={(e) =>
                      setWifi((w) => ({ ...w, ssid: e.target.value }))
                    }
                    placeholder="Network name"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Password</Label>
                  <input
                    type="text"
                    value={wifi.password}
                    onChange={(e) =>
                      setWifi((w) => ({ ...w, password: e.target.value }))
                    }
                    placeholder="Password"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Encryption</Label>
                  <div className="flex gap-2">
                    {(["WPA", "WEP", "nopass"] as const).map((enc) => (
                      <button
                        key={enc}
                        onClick={() =>
                          setWifi((w) => ({ ...w, encryption: enc }))
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          wifi.encryption === enc
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                        }`}
                      >
                        {enc === "nopass" ? "None" : enc}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {contentType === "email" && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>To</Label>
                  <input
                    type="email"
                    value={email.to}
                    onChange={(e) =>
                      setEmail((em) => ({ ...em, to: e.target.value }))
                    }
                    placeholder="recipient@example.com"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Subject</Label>
                  <input
                    type="text"
                    value={email.subject}
                    onChange={(e) =>
                      setEmail((em) => ({ ...em, subject: e.target.value }))
                    }
                    placeholder="Subject line"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Body</Label>
                  <textarea
                    value={email.body}
                    onChange={(e) =>
                      setEmail((em) => ({ ...em, body: e.target.value }))
                    }
                    rows={2}
                    placeholder="Email body"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </>
            )}

            {contentType === "phone" && (
              <div className="flex flex-col gap-1">
                <Label>Phone Number</Label>
                <input
                  type="tel"
                  value={phone.number}
                  onChange={(e) =>
                    setPhone((p) => ({ ...p, number: e.target.value }))
                  }
                  placeholder="+1234567890"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            )}

            {contentType === "sms" && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>Phone Number</Label>
                  <input
                    type="tel"
                    value={sms.number}
                    onChange={(e) =>
                      setSms((s) => ({ ...s, number: e.target.value }))
                    }
                    placeholder="+1234567890"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Message</Label>
                  <textarea
                    value={sms.message}
                    onChange={(e) =>
                      setSms((s) => ({ ...s, message: e.target.value }))
                    }
                    rows={2}
                    placeholder="Message text"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </>
            )}
          </Section>

          {/* Appearance */}
          <Section title="Appearance" defaultOpen>
            <ColorPicker
              label="Foreground"
              value={fgColor}
              onChange={setFgColor}
            />
            <ColorPicker
              label="Background"
              value={bgColor}
              onChange={setBgColor}
              disabled={transparentBg}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)]"
              />
              <span className="text-sm">Transparent background</span>
            </label>

            <div className="flex flex-col gap-1">
              <Label>Style</Label>
              <div className="flex gap-1">
                {styles.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setQrStyle(s.value)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      qrStyle === s.value
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {qrStyle === "rounded" && (
              <Slider
                label="Corner Radius"
                value={cornerRadius}
                min={0}
                max={50}
                onChange={setCornerRadius}
              />
            )}
          </Section>

          {/* Error Correction */}
          <Section title="Error Correction" defaultOpen={false}>
            <div className="grid grid-cols-4 gap-1">
              {errorLevels.map((el) => (
                <button
                  key={el.value}
                  onClick={() => setErrorLevel(el.value)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                    errorLevel === el.value
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                  }`}
                >
                  <span className="font-semibold">{el.label}</span>
                  <span
                    className={`text-[10px] ${
                      errorLevel === el.value
                        ? "text-white/70"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {el.desc}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Size */}
          <Section title="Size" defaultOpen={false}>
            <Slider
              label="Width"
              value={width}
              min={200}
              max={2000}
              step={50}
              onChange={setWidth}
              suffix="px"
            />
            <Slider
              label="Margin"
              value={margin}
              min={0}
              max={10}
              onChange={setMargin}
              suffix=" modules"
            />
          </Section>

          {/* Logo */}
          <Section title="Logo" defaultOpen={false}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {logoFile ? "Change Logo" : "Upload Logo"}
              </button>
              {logoFile && (
                <button
                  onClick={() => {
                    setLogoFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-3 py-1.5 text-sm text-red-500 font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            {logoFile && (
              <>
                <div className="flex items-center gap-2">
                  {logoDataURL && (
                    <img
                      src={logoDataURL}
                      alt="Logo preview"
                      className="w-10 h-10 object-contain rounded border border-[var(--border)]"
                    />
                  )}
                  <span className="text-xs text-[var(--muted)] truncate">
                    {logoFile.name}
                  </span>
                </div>
                <Slider
                  label="Logo Size"
                  value={logoSize}
                  min={10}
                  max={40}
                  onChange={setLogoSize}
                  suffix="%"
                />
              </>
            )}
            {logoFile && (
              <p className="text-[10px] text-[var(--muted)]">
                Tip: Use error correction level H (30%) when adding a logo for best scan reliability.
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

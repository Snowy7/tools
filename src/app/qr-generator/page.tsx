"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  QrCode,
  Wifi,
  Mail,
  Phone,
  MessageSquare,
  Type,
  Link as LinkIcon,
  Upload,
  Trash2,
  ChevronDown,
  Image as ImageIcon,
  Circle,
  Square,
  RectangleHorizontal,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentType = "text" | "url" | "wifi" | "email" | "phone" | "sms";
type QRStyle = "square" | "dots" | "rounded";
type ErrorLevel = "L" | "M" | "Q" | "H";
type LogoShape = "square" | "circle" | "rounded";

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
      const msg = sms.message
        ? `?body=${encodeURIComponent(sms.message)}`
        : "";
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
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
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
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
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

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  rows?: number;
}) {
  const cls =
    "w-full text-sm px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content type config
// ---------------------------------------------------------------------------

const contentTypeConfig: {
  value: ContentType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "text", label: "Text", icon: <Type size={14} /> },
  { value: "url", label: "URL", icon: <LinkIcon size={14} /> },
  { value: "wifi", label: "WiFi", icon: <Wifi size={14} /> },
  { value: "email", label: "Email", icon: <Mail size={14} /> },
  { value: "phone", label: "Phone", icon: <Phone size={14} /> },
  { value: "sms", label: "SMS", icon: <MessageSquare size={14} /> },
];

const errorLevels: { value: ErrorLevel; label: string; desc: string }[] = [
  { value: "L", label: "L", desc: "7%" },
  { value: "M", label: "M", desc: "15%" },
  { value: "Q", label: "Q", desc: "25%" },
  { value: "H", label: "H", desc: "30%" },
];

const qrStyles: { value: QRStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "dots", label: "Dots" },
  { value: "rounded", label: "Rounded" },
];

const logoShapes: { value: LogoShape; label: string; icon: React.ReactNode }[] =
  [
    { value: "square", label: "Square", icon: <Square size={14} /> },
    { value: "circle", label: "Circle", icon: <Circle size={14} /> },
    {
      value: "rounded",
      label: "Rounded",
      icon: <RectangleHorizontal size={14} />,
    },
  ];

// ---------------------------------------------------------------------------
// Checkerboard CSS for transparent background indicator
// ---------------------------------------------------------------------------

const checkerboardStyle: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, #d0d0d0 25%, transparent 25%),
    linear-gradient(-45deg, #d0d0d0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d0d0d0 75%),
    linear-gradient(-45deg, transparent 75%, #d0d0d0 75%)
  `,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

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
  const [logoShape, setLogoShape] = useState<LogoShape>("rounded");
  const [logoBgColor, setLogoBgColor] = useState("#ffffff");
  const [logoPadding, setLogoPadding] = useState(10);
  const [logoOpacity, setLogoOpacity] = useState(100);

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
        // Force the canvas to be square (toCanvas sets width/height)
        canvas.width = width;
        canvas.height = width;
        await QRCode.toCanvas(canvas, qrData, opts);
      } catch {
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
              ctx.arc(
                x + radius,
                y + radius,
                radius * 0.85,
                0,
                Math.PI * 2
              );
              ctx.fill();
            } else if (qrStyle === "rounded") {
              const r =
                Math.min(cornerRadius, moduleSize / 2) * (moduleSize / 50);
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

        // Padding as percentage of logo size
        const pad = logoW * (logoPadding / 100);

        // Draw background pad with selected shape
        ctx.fillStyle = logoBgColor;
        ctx.beginPath();
        if (logoShape === "circle") {
          const rx = (logoW + pad * 2) / 2;
          const ry = (logoH + pad * 2) / 2;
          const cx = lx - pad + rx;
          const cy = ly - pad + ry;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        } else if (logoShape === "rounded") {
          const rr = Math.min(logoW + pad * 2, logoH + pad * 2) * 0.15;
          ctx.roundRect(
            lx - pad,
            ly - pad,
            logoW + pad * 2,
            logoH + pad * 2,
            rr
          );
        } else {
          ctx.rect(lx - pad, ly - pad, logoW + pad * 2, logoH + pad * 2);
        }
        ctx.fill();

        // Clip for the logo image based on shape
        ctx.save();
        ctx.globalAlpha = logoOpacity / 100;
        ctx.beginPath();
        if (logoShape === "circle") {
          const rx = logoW / 2;
          const ry = logoH / 2;
          ctx.ellipse(lx + rx, ly + ry, rx, ry, 0, 0, Math.PI * 2);
          ctx.clip();
        } else if (logoShape === "rounded") {
          const rr = Math.min(logoW, logoH) * 0.12;
          ctx.roundRect(lx, ly, logoW, logoH, rr);
          ctx.clip();
        }

        ctx.drawImage(img, lx, ly, logoW, logoH);
        ctx.restore();
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
    logoShape,
    logoBgColor,
    logoPadding,
    logoOpacity,
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
  // Logo file handler
  // ---------------------------------------------------------------------------
  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLogoFile(e.target.files?.[0] ?? null);
    },
    []
  );

  const handleLogoRemove = useCallback(() => {
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <QrCode size={20} className="text-[var(--accent)]" />
          <h1 className="text-base font-semibold">QR Generator</h1>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: Preview */}
        <div className="flex-[3] flex flex-col min-w-0">
          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-[var(--background)]">
            <div className="relative">
              {/* Checkerboard behind QR only when transparent bg is on */}
              {transparentBg && (
                <div
                  className="absolute inset-0 rounded-xl"
                  style={checkerboardStyle}
                />
              )}
              <canvas
                ref={canvasRef}
                className="relative aspect-square max-w-full max-h-[60vh] rounded-xl shadow-lg"
                width={width}
                height={width}
                style={{
                  imageRendering: "pixelated",
                }}
              />
            </div>
          </div>

          {/* Export bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <button
              onClick={downloadPNG}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Download size={14} />
              PNG
            </button>
            <button
              onClick={downloadSVG}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Download size={14} />
              SVG
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Right panel: Settings */}
        <div className="flex-[2] border-l border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
          {/* Content */}
          <Section title="Content" icon={<QrCode size={16} />} defaultOpen>
            <div className="flex flex-wrap gap-1">
              {contentTypeConfig.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setContentType(ct.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    contentType === ct.value
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                  }`}
                >
                  {ct.icon}
                  {ct.label}
                </button>
              ))}
            </div>

            {(contentType === "text" || contentType === "url") && (
              <TextInput
                label={contentType === "url" ? "URL" : "Text"}
                value={text}
                onChange={setText}
                placeholder={
                  contentType === "url"
                    ? "https://example.com"
                    : "Enter text..."
                }
                rows={3}
              />
            )}

            {contentType === "wifi" && (
              <>
                <TextInput
                  label="SSID"
                  value={wifi.ssid}
                  onChange={(v) => setWifi((w) => ({ ...w, ssid: v }))}
                  placeholder="Network name"
                />
                <TextInput
                  label="Password"
                  value={wifi.password}
                  onChange={(v) => setWifi((w) => ({ ...w, password: v }))}
                  placeholder="Password"
                />
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
                <TextInput
                  label="To"
                  value={email.to}
                  onChange={(v) => setEmail((em) => ({ ...em, to: v }))}
                  placeholder="recipient@example.com"
                  type="email"
                />
                <TextInput
                  label="Subject"
                  value={email.subject}
                  onChange={(v) => setEmail((em) => ({ ...em, subject: v }))}
                  placeholder="Subject line"
                />
                <TextInput
                  label="Body"
                  value={email.body}
                  onChange={(v) => setEmail((em) => ({ ...em, body: v }))}
                  placeholder="Email body"
                  rows={2}
                />
              </>
            )}

            {contentType === "phone" && (
              <TextInput
                label="Phone Number"
                value={phone.number}
                onChange={(v) => setPhone((p) => ({ ...p, number: v }))}
                placeholder="+1234567890"
                type="tel"
              />
            )}

            {contentType === "sms" && (
              <>
                <TextInput
                  label="Phone Number"
                  value={sms.number}
                  onChange={(v) => setSms((s) => ({ ...s, number: v }))}
                  placeholder="+1234567890"
                  type="tel"
                />
                <TextInput
                  label="Message"
                  value={sms.message}
                  onChange={(v) => setSms((s) => ({ ...s, message: v }))}
                  placeholder="Message text"
                  rows={2}
                />
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
                {qrStyles.map((s) => (
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
          <Section
            title="Error Correction"
            icon={<Shield size={16} />}
            defaultOpen={false}
          >
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
          <Section
            title="Logo"
            icon={<ImageIcon size={16} />}
            defaultOpen={false}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <Upload size={14} />
                {logoFile ? "Change Logo" : "Upload Logo"}
              </button>
              {logoFile && (
                <button
                  onClick={handleLogoRemove}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <Trash2 size={14} />
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

                <div className="flex flex-col gap-1">
                  <Label>Logo Shape</Label>
                  <div className="flex gap-1">
                    {logoShapes.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setLogoShape(s.value)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          logoShape === s.value
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                        }`}
                      >
                        {s.icon}
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ColorPicker
                  label="Logo Background"
                  value={logoBgColor}
                  onChange={setLogoBgColor}
                />

                <Slider
                  label="Logo Padding"
                  value={logoPadding}
                  min={5}
                  max={30}
                  onChange={setLogoPadding}
                  suffix="%"
                />

                <Slider
                  label="Logo Opacity"
                  value={logoOpacity}
                  min={50}
                  max={100}
                  onChange={setLogoOpacity}
                  suffix="%"
                />

                <p className="text-[10px] text-[var(--muted)]">
                  Tip: Use error correction level H (30%) when adding a logo for
                  best scan reliability.
                </p>
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  FileText,
  ImageDown,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  companyName: string;
  logoDataUrl: string;
  clientName: string;
  clientAddress: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  currency: string;
  taxRate: number;
  notes: string;
  items: LineItem[];
}

const CURRENCIES: { code: string; symbol: string }[] = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "\u20ac" },
  { code: "GBP", symbol: "\u00a3" },
  { code: "JPY", symbol: "\u00a5" },
  { code: "CAD", symbol: "C$" },
  { code: "AUD", symbol: "A$" },
  { code: "CHF", symbol: "CHF" },
  { code: "INR", symbol: "\u20b9" },
  { code: "BRL", symbol: "R$" },
  { code: "SAR", symbol: "SAR" },
];

function generateInvoiceNumber(): string {
  const d = new Date();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${rand}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function in30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InvoiceGeneratorPage() {
  const [data, setData] = useState<InvoiceData>({
    companyName: "",
    logoDataUrl: "",
    clientName: "",
    clientAddress: "",
    invoiceNumber: generateInvoiceNumber(),
    date: todayStr(),
    dueDate: in30Days(),
    currency: "USD",
    taxRate: 0,
    notes: "",
    items: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }],
  });
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currencySymbol = useMemo(
    () => CURRENCIES.find((c) => c.code === data.currency)?.symbol ?? "$",
    [data.currency],
  );

  const subtotal = useMemo(
    () => data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [data.items],
  );
  const taxAmount = useMemo(() => subtotal * (data.taxRate / 100), [subtotal, data.taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const fmt = useCallback(
    (n: number) => {
      return `${currencySymbol}${n.toFixed(2)}`;
    },
    [currencySymbol],
  );

  const set = useCallback(
    <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateItem = useCallback((id: string, field: keyof LineItem, value: string | number) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }, []);

  const addItem = useCallback(() => {
    setData((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), description: "", quantity: 1, unitPrice: 0 }],
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : prev.items,
    }));
  }, []);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  }, [set]);

  /* ---------------------------------------------------------------- */
  /*  Export as image via canvas                                       */
  /* ---------------------------------------------------------------- */

  const exportAsImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 2100;
    const H = 2970;
    canvas.width = W;
    canvas.height = H;
    const s = 3; // scale factor for print resolution

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    let y = 120;
    const marginL = 150;
    const marginR = W - 150;

    // Logo
    if (data.logoDataUrl) {
      try {
        const img = new Image();
        img.src = data.logoDataUrl;
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        });
        ctx.drawImage(img, marginL, y, 180, 180);
      } catch { /* skip logo on error */ }
    }

    // Company name
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${22 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(data.companyName || "Your Company", marginR, y + 50);

    // INVOICE title
    ctx.font = `bold ${14 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = "#2563eb";
    ctx.fillText("INVOICE", marginR, y + 110);

    y += 200;

    // Invoice details
    ctx.textAlign = "right";
    ctx.font = `${10 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = "#666";
    ctx.fillText(`Invoice #: ${data.invoiceNumber}`, marginR, y);
    ctx.fillText(`Date: ${data.date}`, marginR, y + 40);
    ctx.fillText(`Due: ${data.dueDate}`, marginR, y + 80);

    // Client info
    ctx.textAlign = "left";
    ctx.fillStyle = "#999";
    ctx.font = `${9 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText("BILL TO", marginL, y);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${11 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText(data.clientName || "Client Name", marginL, y + 45);
    ctx.font = `${10 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = "#666";
    const addrLines = (data.clientAddress || "").split("\n");
    addrLines.forEach((line, i) => {
      ctx.fillText(line, marginL, y + 80 + i * 35);
    });

    y += 180 + addrLines.length * 25;

    // Table header
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(marginL, y, marginR - marginL, 55);
    ctx.fillStyle = "#666";
    ctx.font = `bold ${9 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Description", marginL + 20, y + 36);
    ctx.textAlign = "center";
    ctx.fillText("Qty", marginR - 550, y + 36);
    ctx.fillText("Unit Price", marginR - 350, y + 36);
    ctx.textAlign = "right";
    ctx.fillText("Total", marginR - 20, y + 36);

    y += 55;

    // Table rows
    ctx.font = `${10 * s}px 'Segoe UI', system-ui, sans-serif`;
    data.items.forEach((item) => {
      y += 50;
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "left";
      ctx.fillText(item.description || "—", marginL + 20, y);
      ctx.textAlign = "center";
      ctx.fillText(String(item.quantity), marginR - 550, y);
      ctx.fillText(fmt(item.unitPrice), marginR - 350, y);
      ctx.textAlign = "right";
      ctx.fillText(fmt(item.quantity * item.unitPrice), marginR - 20, y);

      // Separator line
      y += 15;
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginL, y);
      ctx.lineTo(marginR, y);
      ctx.stroke();
    });

    y += 60;

    // Totals
    const totalsX = marginR - 20;
    const labelX = marginR - 350;
    ctx.font = `${10 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = "#666";
    ctx.textAlign = "right";
    ctx.fillText("Subtotal", labelX, y);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(fmt(subtotal), totalsX, y);

    if (data.taxRate > 0) {
      y += 40;
      ctx.fillStyle = "#666";
      ctx.fillText(`Tax (${data.taxRate}%)`, labelX, y);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillText(fmt(taxAmount), totalsX, y);
    }

    y += 50;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(labelX - 80, y - 30, marginR - labelX + 100, 50);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${12 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText("Total", labelX + 20, y + 5);
    ctx.fillText(fmt(total), totalsX, y + 5);

    // Notes
    if (data.notes) {
      y += 100;
      ctx.fillStyle = "#999";
      ctx.font = `${9 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Notes / Terms", marginL, y);
      y += 35;
      ctx.fillStyle = "#666";
      ctx.font = `${10 * s}px 'Segoe UI', system-ui, sans-serif`;
      data.notes.split("\n").forEach((line) => {
        ctx.fillText(line, marginL, y);
        y += 32;
      });
    }

    // Download
    const link = document.createElement("a");
    link.download = `${data.invoiceNumber || "invoice"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [data, subtotal, taxAmount, total, fmt, currencySymbol]);

  /* ---------------------------------------------------------------- */
  /*  Export as HTML                                                    */
  /* ---------------------------------------------------------------- */

  const exportAsHTML = useCallback(() => {
    const itemsHTML = data.items
      .map(
        (item) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${item.description || "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(item.unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(item.quantity * item.unitPrice)}</td>
      </tr>`,
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${data.invoiceNumber}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 40px; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .company { font-size: 24px; font-weight: 700; }
  .invoice-title { font-size: 14px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; }
  .meta { text-align: right; font-size: 13px; color: #666; line-height: 1.8; }
  .bill-to-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .client-name { font-size: 16px; font-weight: 600; }
  .client-address { font-size: 13px; color: #666; white-space: pre-line; }
  th { background: #f5f5f5; text-align: left; padding: 10px 12px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .totals { margin-top: 20px; text-align: right; }
  .totals td { padding: 6px 12px; }
  .total-row { background: #2563eb; color: #fff; font-weight: 700; font-size: 16px; }
  .total-row td { padding: 12px; }
  .notes { margin-top: 40px; font-size: 13px; color: #666; }
  .notes-label { font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 6px; }
  @media print { body { margin: 0; padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${data.logoDataUrl ? `<img src="${data.logoDataUrl}" alt="Logo" style="max-height:60px;margin-bottom:8px;display:block;">` : ""}
      <div class="company">${data.companyName || "Your Company"}</div>
    </div>
    <div style="text-align:right;">
      <div class="invoice-title">Invoice</div>
      <div class="meta">
        <div>#${data.invoiceNumber}</div>
        <div>Date: ${data.date}</div>
        <div>Due: ${data.dueDate}</div>
      </div>
    </div>
  </div>

  <div style="margin-bottom:30px;">
    <div class="bill-to-label">Bill To</div>
    <div class="client-name">${data.clientName || "Client Name"}</div>
    <div class="client-address">${data.clientAddress || ""}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;width:80px;">Qty</th>
        <th style="text-align:right;width:120px;">Unit Price</th>
        <th style="text-align:right;width:120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <table class="totals" style="width:300px;margin-left:auto;">
    <tr><td style="color:#666;">Subtotal</td><td>${fmt(subtotal)}</td></tr>
    ${data.taxRate > 0 ? `<tr><td style="color:#666;">Tax (${data.taxRate}%)</td><td>${fmt(taxAmount)}</td></tr>` : ""}
    <tr class="total-row"><td>Total</td><td>${fmt(total)}</td></tr>
  </table>

  ${data.notes ? `<div class="notes"><div class="notes-label">Notes / Terms</div><div style="white-space:pre-line;">${data.notes}</div></div>` : ""}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.invoiceNumber || "invoice"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, subtotal, taxAmount, total, fmt]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      <canvas ref={canvasRef} className="hidden" />
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

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
          <span className="text-sm font-semibold">Invoice Generator</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={exportAsHTML}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Download size={12} />
            Export HTML
          </button>
          <button
            type="button"
            onClick={exportAsImage}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            <ImageDown size={12} />
            Export Image
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Form */}
        <div className="w-[420px] flex-shrink-0 border-r border-[var(--border)] overflow-y-auto p-4 space-y-4">
          {/* Company */}
          <Section title="Your Company">
            <input
              type="text"
              placeholder="Company Name"
              value={data.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors w-full justify-center mt-2"
            >
              <Upload size={12} />
              {data.logoDataUrl ? "Change Logo" : "Upload Logo"}
            </button>
            {data.logoDataUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={data.logoDataUrl} alt="Logo" className="h-8 object-contain" />
                <button
                  type="button"
                  onClick={() => set("logoDataUrl", "")}
                  className="text-xs text-[var(--muted)] hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </Section>

          {/* Client */}
          <Section title="Bill To">
            <input
              type="text"
              placeholder="Client Name"
              value={data.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
            <textarea
              placeholder="Client Address"
              value={data.clientAddress}
              onChange={(e) => set("clientAddress", e.target.value)}
              rows={2}
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] resize-none mt-2"
            />
          </Section>

          {/* Invoice Details */}
          <Section title="Invoice Details">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--muted)]">
                Invoice #
                <input
                  type="text"
                  value={data.invoiceNumber}
                  onChange={(e) => set("invoiceNumber", e.target.value)}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] mt-0.5"
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Currency
                <select
                  value={data.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] mt-0.5"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--muted)]">
                Date
                <input
                  type="date"
                  value={data.date}
                  onChange={(e) => set("date", e.target.value)}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] mt-0.5"
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Due Date
                <input
                  type="date"
                  value={data.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] mt-0.5"
                />
              </label>
            </div>
          </Section>

          {/* Line Items */}
          <Section title="Line Items">
            <div className="space-y-2">
              {data.items.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-1.5 group">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        placeholder="Qty"
                        min={0}
                        value={item.quantity || ""}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        className="w-20 text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                      />
                      <input
                        type="number"
                        placeholder="Unit Price"
                        min={0}
                        step={0.01}
                        value={item.unitPrice || ""}
                        onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                        className="flex-1 text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                      />
                      <div className="w-20 text-sm px-2 py-1 text-right text-[var(--muted)]">
                        {fmt(item.quantity * item.unitPrice)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="mt-2 p-1 text-[var(--muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] mt-2"
            >
              <Plus size={12} />
              Add Item
            </button>
          </Section>

          {/* Tax */}
          <Section title="Tax">
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              Tax Rate (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={data.taxRate || ""}
                onChange={(e) => set("taxRate", Number(e.target.value))}
                className="w-20 text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          </Section>

          {/* Notes */}
          <Section title="Notes / Terms">
            <textarea
              placeholder="Payment terms, bank details, etc."
              value={data.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--accent)] resize-none"
            />
          </Section>
        </div>

        {/* Live Preview */}
        <div className="flex-1 overflow-auto bg-[var(--background)] p-6 flex justify-center">
          <div
            className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-[680px] p-10"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: 900 }}
          >
            {/* Preview Header */}
            <div className="flex justify-between items-start mb-10">
              <div>
                {data.logoDataUrl && (
                  <img src={data.logoDataUrl} alt="Logo" className="h-12 object-contain mb-2" />
                )}
                <div className="text-xl font-bold text-gray-900">
                  {data.companyName || "Your Company"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                  Invoice
                </div>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <div>#{data.invoiceNumber}</div>
                  <div>Date: {data.date}</div>
                  <div>Due: {data.dueDate}</div>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                Bill To
              </div>
              <div className="text-sm font-semibold">
                {data.clientName || "Client Name"}
              </div>
              {data.clientAddress && (
                <div className="text-xs text-gray-500 whitespace-pre-line">
                  {data.clientAddress}
                </div>
              )}
            </div>

            {/* Table */}
            <table className="w-full text-xs mb-6">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                    Description
                  </th>
                  <th className="text-center py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] w-14">
                    Qty
                  </th>
                  <th className="text-right py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] w-24">
                    Unit Price
                  </th>
                  <th className="text-right py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] w-24">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2.5 px-3 text-gray-800">
                      {item.description || "\u2014"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right text-gray-600">
                      {fmt(item.unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-800 font-medium">
                      {fmt(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {data.taxRate > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tax ({data.taxRate}%)</span>
                    <span>{fmt(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between bg-blue-600 text-white font-bold text-sm px-3 py-2 rounded">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {data.notes && (
              <div className="mt-10 pt-6 border-t border-gray-100">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  Notes / Terms
                </div>
                <div className="text-xs text-gray-500 whitespace-pre-line">{data.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

import Link from "next/link";
import { Type, QrCode, Eraser } from "lucide-react";

const tools = [
  {
    name: "Font Creator",
    description: "Draw, import, or extract glyphs to build custom fonts",
    href: "/font-creator",
    icon: <Type size={28} strokeWidth={1.5} />,
  },
  {
    name: "QR Generator",
    description: "Create customizable QR codes with colors, logos, styles, and export options",
    href: "/qr-generator",
    icon: <QrCode size={28} strokeWidth={1.5} />,
  },
  {
    name: "Background Remover",
    description: "Remove image backgrounds instantly using AI, right in your browser",
    href: "/bg-remover",
    icon: <Eraser size={28} strokeWidth={1.5} />,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Tools</h1>
        <p className="text-[var(--muted)] mb-12">A collection of creative tools.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col gap-3 p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <div className="text-[var(--accent)]">{tool.icon}</div>
              <div>
                <h2 className="font-medium mb-1 group-hover:text-[var(--accent)] transition-colors">
                  {tool.name}
                </h2>
                <p className="text-sm text-[var(--muted)]">{tool.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

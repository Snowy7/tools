import Link from "next/link";

const tools = [
  {
    name: "Font Creator",
    description: "Draw, import, or extract glyphs to build custom fonts",
    href: "/font-creator",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
  {
    name: "QR Generator",
    description: "Create customizable QR codes with colors, logos, styles, and export options",
    href: "/qr-generator",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" />
        <path d="M14 14h2v2h-2z" /><path d="M20 14h2v2h-2z" /><path d="M14 20h2v2h-2z" /><path d="M20 20h2v2h-2z" /><path d="M17 17h2v2h-2z" />
      </svg>
    ),
  },
  {
    name: "Background Remover",
    description: "Remove image backgrounds instantly using AI, right in your browser",
    href: "/bg-remover",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.83 14.83a4 4 0 0 0 0-5.66l-5-5a4 4 0 0 0-5.66 0L3.83 10.5a4 4 0 0 0 0 5.66l5 5a4 4 0 0 0 5.66 0z" />
        <path d="m6 12 6 6" /><path d="m18 12-6-6" />
      </svg>
    ),
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

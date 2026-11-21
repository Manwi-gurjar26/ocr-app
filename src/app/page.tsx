"use client";

import { ChartPieSlice, Files, IdentificationCard, Invoice, Receipt, Scan, Sparkle, UploadSimple } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { qs, relativeTime, useFetch, type Doc, type Stats } from "@/lib/client";
import { formatMoney, headline, TYPE_LABEL } from "@/lib/format";
import { AppButton, AppIcon, Bezel, Eyebrow, Pill, Reveal, StatusBadge, TypeIcon, type Tone } from "@/components/ui";

export default function Dashboard() {
  const { data: stats } = useFetch<Stats>("/api/stats", (s) => (s.byStatus.processing ?? 0) > 0);
  const { data: recent } = useFetch<{ items: Doc[] }>(`/api/documents${qs({ limit: 6 })}`, (r) => r.items.some((d) => d.status === "processing"));

  const total = stats?.total ?? 0;
  const tiles: { label: string; value: number; icon: typeof Invoice; tone: Tone; href: string }[] = [
    { label: "Invoices", value: stats?.byType.invoice ?? 0, icon: Invoice, tone: "blue", href: "/documents?type=invoice" },
    { label: "Receipts", value: stats?.byType.receipt ?? 0, icon: Receipt, tone: "orange", href: "/documents?type=receipt" },
    { label: "ID Cards", value: stats?.byType.id_card ?? 0, icon: IdentificationCard, tone: "green", href: "/documents?type=id_card" },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
      {/* Hero */}
      <Reveal className="md:col-span-8 md:row-span-2">
        <Bezel className="h-full" coreClassName="p-8 md:p-12">
          <div className="flex h-full flex-col justify-between gap-12">
            <div className="space-y-6">
              <Eyebrow>Document intelligence</Eyebrow>
              <h1 className="max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.045em] md:text-7xl">
                Paper in.
                <br />
                <span className="bg-gradient-to-r from-[#7cd4ff] via-[#a594ff] to-[#ff9ac2] bg-clip-text text-transparent">Data out.</span>
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-muted">
                Drop invoices, receipts and ID cards. DocScan reads them, pulls out every field, files it in your database and
                writes the report for you.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Pill href="/scan" icon={UploadSimple}>
                Scan documents
              </Pill>
              <Pill href="/reports" variant="glass" icon={ChartPieSlice}>
                Build a report
              </Pill>
            </div>
          </div>
        </Bezel>
      </Reveal>

      {/* Total */}
      <Reveal delay={0.08} className="md:col-span-4">
        <Bezel className="h-full" coreClassName="p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Documents stored</p>
              <motion.p key={total} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-6xl font-semibold tracking-[-0.05em]">
                {stats ? total : <span className="skeleton inline-block h-14 w-20 rounded-xl" />}
              </motion.p>
            </div>
            <AppIcon icon={Files} tone="teal" size={48} />
          </div>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/5">
            {tiles.map((t, i) => (
              <motion.div
                key={t.label}
                className={`tone-${t.tone} h-full`}
                style={{ background: "linear-gradient(90deg,var(--c1),var(--c2))" }}
                initial={{ width: 0 }}
                animate={{ width: total ? `${(t.value / total) * 100}%` : 0 }}
                transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: [0.32, 0.72, 0, 1] }}
              />
            ))}
          </div>
        </Bezel>
      </Reveal>

      {/* Quick actions — iPhone home screen */}
      <Reveal delay={0.14} className="md:col-span-4">
        <Bezel className="h-full" coreClassName="p-6">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Quick actions</p>
          <div className="grid grid-cols-4 gap-2">
            <AppButton icon={Scan} tone="blue" label="Scan" href="/scan" size={54} />
            <AppButton icon={Files} tone="teal" label="Library" href="/documents" size={54} />
            <AppButton icon={ChartPieSlice} tone="pink" label="Reports" href="/reports" size={54} />
            <AppButton icon={Sparkle} tone="indigo" label="AI" href="#engine" size={54} />
          </div>
        </Bezel>
      </Reveal>

      {/* Per-type tiles */}
      {tiles.map((t, i) => (
        <Reveal key={t.label} delay={0.1 + i * 0.06} className="md:col-span-4">
          <Link href={t.href} className="group block">
            <Bezel coreClassName="p-6 transition-transform duration-700 ease-spring group-hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <AppIcon icon={t.icon} tone={t.tone} size={48} />
                <div>
                  <p className="text-3xl font-semibold tracking-tight">{t.value}</p>
                  <p className="text-sm text-muted">{t.label}</p>
                </div>
              </div>
            </Bezel>
          </Link>
        </Reveal>
      ))}

      {/* Recent */}
      <Reveal delay={0.1} className="md:col-span-8">
        <Bezel coreClassName="p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent scans</h2>
            <Link href="/documents" className="text-sm text-muted transition-colors hover:text-fg">
              View all
            </Link>
          </div>
          {!recent ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : recent.items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <AppIcon icon={Scan} tone="blue" size={64} />
              <p className="text-muted">No documents yet. Scan your first one.</p>
              <Pill href="/scan" icon={UploadSimple}>Start scanning</Pill>
            </div>
          ) : (
            <ul className="space-y-1">
              {recent.items.map((d, i) => {
                const h = headline(d.docType, d.fields);
                return (
                  <motion.li key={d.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}>
                    <Link href={`/documents/${d.id}`} className="flex items-center gap-4 rounded-2xl p-3 transition-colors duration-500 ease-spring hover:bg-white/[0.05]">
                      <TypeIcon type={d.docType} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{h.title ?? d.fileName}</p>
                        <p className="truncate text-xs text-faint">
                          {TYPE_LABEL[d.docType]} · {relativeTime(d.createdAt)}
                        </p>
                      </div>
                      {h.amount != null && <span className="hidden font-mono text-sm sm:block">{formatMoney(h.amount, d.fields.currency)}</span>}
                      <StatusBadge status={d.status} />
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Bezel>
      </Reveal>

      {/* Engine */}
      <Reveal delay={0.16} className="md:col-span-4" id="engine">
        <Bezel className="h-full" coreClassName="p-6 md:p-8">
          <AppIcon icon={Sparkle} tone={stats?.aiEnabled ? "indigo" : "gray"} size={48} />
          <h3 className="mt-5 text-lg font-semibold tracking-tight">{stats?.aiEnabled ? "AI vision is on" : "Offline OCR mode"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {stats?.aiEnabled
              ? "Claude reads each page for high-accuracy fields and line items, with Tesseract OCR as a fallback."
              : "Tesseract OCR with smart field rules — free and private. Add ANTHROPIC_API_KEY to .env for AI-grade accuracy."}
          </p>
        </Bezel>
      </Reveal>
    </div>
  );
}

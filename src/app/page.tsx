"use client";

import { Bank, Certificate, ChartPieSlice, CircleNotch, Eye, Files, IdentificationCard, Invoice, Lightning, Scan, Sparkle, UploadSimple } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { qs, relativeTime, useFetch, type Doc, type Stats } from "@/lib/client";
import { formatMoney, headline, TYPE_LABEL } from "@/lib/format";
import { isBusy } from "@/lib/types";
import { AppButton, AppIcon, Bezel, Eyebrow, Pill, Reveal, StatusBadge, TypeIcon, type Tone } from "@/components/ui";

export default function Dashboard() {
  const { data: stats } = useFetch<Stats>("/api/stats", (s) => Object.entries(s.byStatus).some(([k, n]) => isBusy(k as never) && (n ?? 0) > 0));
  const { data: recent } = useFetch<{ items: Doc[] }>(`/api/documents${qs({ limit: 6 })}`, (r) => r.items.some((d) => isBusy(d.status)));

  const total = stats?.total ?? 0;
  const processing = (["uploaded", "processing", "extracted", "validation_pending"] as const).reduce((a, k) => a + (stats?.byStatus[k] ?? 0), 0);
  const review = stats?.byStatus.manual_review ?? 0;
  const tiles: { label: string; value: number; icon: typeof Invoice; tone: Tone; href: string }[] = [
    { label: "Needs review", value: review, icon: Eye, tone: "red", href: "/documents?status=manual_review" },
    { label: "Electricity bills", value: stats?.byType.electricity_bill ?? 0, icon: Lightning, tone: "orange", href: "/documents?type=electricity_bill" },
    { label: "GST certificates", value: stats?.byType.gst_certificate ?? 0, icon: Certificate, tone: "indigo", href: "/documents?type=gst_certificate" },
    { label: "Bank statements", value: stats?.byType.bank_statement ?? 0, icon: Bank, tone: "teal", href: "/documents?type=bank_statement" },
    { label: "KYC documents", value: stats?.byType.id_card ?? 0, icon: IdentificationCard, tone: "green", href: "/documents?type=id_card" },
    { label: "Invoices", value: stats?.byType.invoice ?? 0, icon: Invoice, tone: "blue", href: "/documents?type=invoice" },
  ];

  const typeTiles = tiles.filter((t) => t.href.includes("type="));

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
      {/* Hero */}
      <Reveal className="md:col-span-8 md:row-span-2">
        <Bezel className="h-full" coreClassName="p-8 md:p-12">
          <div className="flex h-full flex-col justify-between gap-12">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow>Document intelligence</Eyebrow>
                <AnimatePresence>
                  {processing > 0 && (
                    <motion.span
                      key="processing-pill"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-info pulse-ring"
                    >
                      <CircleNotch size={11} className="animate-spin" />
                      {processing} processing
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <h1 className="max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.045em] md:text-7xl">
                Paper in.
                <br />
                <span className="hero-gradient">Data out.</span>
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-muted">
                Electricity bills, GST certificates, bank statements and KYC documents for KiloWattX. DocScan reads them,
                extracts every field, checks them against business rules and sends anything doubtful to manual review.
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
        <Bezel className="h-full card-glow" coreClassName="p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Documents stored</p>
              <motion.p key={total} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-6xl font-semibold tracking-[-0.05em]">
                {stats ? total : <span className="skeleton inline-block h-14 w-20 rounded-xl" />}
              </motion.p>
            </div>
            <AppIcon icon={Files} tone="teal" size={48} />
          </div>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-ink/5">
            {typeTiles.map((t, i) => (
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
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3">
            {typeTiles.map((t) => (
              <Link key={t.label} href={t.href} className="flex items-center gap-1.5 text-[11px] text-faint transition-colors hover:text-muted">
                <span className={`tone-${t.tone} inline-block h-2 w-2 rounded-full`} style={{ background: "var(--c2)" }} />
                {t.label}
                {stats && <span className="font-medium text-fg/60">({t.value})</span>}
              </Link>
            ))}
          </div>
        </Bezel>
      </Reveal>

      {/* Quick actions — iPhone home screen */}
      <Reveal delay={0.14} className="md:col-span-4">
        <Bezel className="h-full card-glow" coreClassName="p-6">
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
            <Bezel coreClassName="p-6 transition-transform duration-700 ease-spring group-hover:-translate-y-1 card-glow">
              <div className="flex items-center gap-4">
                <AppIcon icon={t.icon} tone={t.tone} size={48} />
                <div className="min-w-0 flex-1">
                  <motion.p key={t.value} className="text-3xl font-semibold tracking-tight count-in">{t.value}</motion.p>
                  <p className="text-sm text-muted">{t.label}</p>
                </div>
                {/* mini share bar */}
                {total > 0 && (
                  <div className="hidden flex-col items-end gap-1 sm:flex">
                    <span className="text-[11px] font-mono text-faint">
                      {Math.round((t.value / total) * 100)}%
                    </span>
                    <div className="conf-bar-track w-16">
                      <motion.div
                        className={`tone-${t.tone} conf-bar-fill`}
                        style={{ background: "linear-gradient(90deg,var(--c1),var(--c2))" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(t.value / total) * 100}%` }}
                        transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: [0.32, 0.72, 0, 1] }}
                      />
                    </div>
                  </div>
                )}
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
            <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
              View all <span className="text-faint">→</span>
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
                    <Link href={`/documents/${d.id}`} className="flex items-center gap-4 rounded-2xl p-3 transition-colors duration-500 ease-spring hover:bg-ink/[0.05]">
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
              ? "Claude reads each page for high-accuracy fields, with OCR rules as a fallback."
              : "Field rules over OCR text — free and private. Add ANTHROPIC_API_KEY to .env for AI-grade accuracy."}
          </p>
          <ul className="mt-4 space-y-1.5 text-xs">
            {[
              ["Amazon Textract", "bills & GST", stats?.providers?.textract],
              ["Perfios", "KYC & bank", stats?.providers?.perfios],
            ].map(([name, scope, on]) => (
              <li key={name as string} className="flex items-center gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-ok" : "bg-faint"}`} />
                <span className="text-muted">{name as string}</span>
                <span className="text-faint">({scope as string}) · {on ? "connected" : "using local OCR"}</span>
              </li>
            ))}
          </ul>
          {/* live status dot */}
          <div className="mt-6 flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${stats?.aiEnabled ? "bg-ok pulse-ring" : "bg-faint"}`} />
            <span className="text-xs text-faint">{stats?.aiEnabled ? "Connected · Claude vision" : "Offline mode active"}</span>
          </div>
        </Bezel>
      </Reveal>
    </div>
  );
}

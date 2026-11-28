"use client";

import { ArrowRight, ChartBar, CheckCircle, Eye, UploadSimple, FileText, MagnifyingGlass, Sparkle, SealCheck, XCircle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { CountUp, RooftopScene, SolarScene, StarField } from "@/components/art";
import { DocTable, Panel } from "@/components/doc-table";
import { Pill, Reveal, TypeIcon, cn } from "@/components/ui";
import { qs, useFetch, type Doc, type Stats } from "@/lib/client";
import { TYPE_LABEL } from "@/lib/format";
import { BUSY_STATUSES, isBusy, type DocType } from "@/lib/types";

const TYPE_ORDER: DocType[] = ["electricity_bill", "gst_certificate", "bank_statement", "id_card", "invoice", "receipt"];

export default function Overview() {
  const { data: stats } = useFetch<Stats>("/api/stats", (s) => BUSY_STATUSES.some((k) => (s.byStatus[k] ?? 0) > 0));
  const { data: recent } = useFetch<{ items: Doc[] }>(`/api/documents${qs({ limit: 8 })}`, (r) => r.items.some((d) => isBusy(d.status)));
  const { data: queue } = useFetch<{ items: Doc[]; total: number }>(`/api/documents${qs({ status: "manual_review", limit: 6 })}`);

  const by = stats?.byStatus ?? {};
  const total = stats?.total ?? 0;
  const processing = BUSY_STATUSES.reduce((a, k) => a + (by[k] ?? 0), 0);
  const decided = (by.verified ?? 0) + (by.manual_review ?? 0) + (by.failed ?? 0);
  const rate = decided ? Math.round(((by.verified ?? 0) / decided) * 1000) / 10 : null;

  const kpis = [
    { label: "Documents", value: total, note: processing ? `${processing} processing now` : "All processed", href: "/documents" },
    {
      label: "Verified",
      value: by.verified ?? 0,
      note: rate != null ? `${rate}% pass rate` : "No decisions yet",
      href: "/documents?status=verified",
      tone: "text-ok",
    },
    { label: "Needs review", value: by.manual_review ?? 0, note: "Awaiting a reviewer", href: "/documents?status=manual_review", tone: "text-warn" },
    { label: "Failed", value: by.failed ?? 0, note: "Rejected or unreadable", href: "/documents?status=failed", tone: "text-danger" },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Reveal className="relative mb-6 overflow-hidden rounded-2xl border border-hair bg-surface shadow-[var(--shadow-md)]">
        {/* Background: star field + solar farm landscape */}
        <div className="pointer-events-none absolute inset-0">
          {/* Star field — dark sky layer */}
          <StarField
            className="absolute inset-0 h-full w-full text-faint opacity-60"
            count={80}
          />
          {/* Solar farm scene at bottom */}
          <SolarScene variant="hero" className="absolute inset-0 h-full w-full" />
          {/* gradient to keep text legible on the left */}
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent md:via-surface/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative flex min-h-[360px] flex-col justify-center gap-6 p-6 md:min-h-[400px] md:max-w-[55%] md:p-12">
          {/* Live status pill */}
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="inline-flex w-max items-center gap-2 rounded-full border border-hair bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            {processing ? `${processing} document${processing === 1 ? "" : "s"} processing` : "Verification pipeline online"}
          </motion.span>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-4"
          >
            <h1 className="text-4xl font-semibold tracking-[-0.035em] text-fg md:text-5xl md:leading-[1.1]">
              Document{" "}
              <span className="hero-gradient-animated">verification</span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">
              Electricity bills, GST certificates, bank statements and KYC documents are read, checked against KiloWattX rules, and
              either verified or routed to a reviewer.
            </p>
          </motion.div>

          {/* KPI quick glance — inline in hero */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              {kpis.slice(0, 3).map((k) => (
                <Link key={k.label} href={k.href} className="group flex items-center gap-2 rounded-xl border border-hair bg-surface/60 px-4 py-2.5 backdrop-blur transition-all hover:border-hair-strong hover:shadow-[var(--shadow-sm)]">
                  <span className={cn("text-xl font-semibold tabular-nums tracking-tight", k.tone ?? "text-fg")}>
                    <CountUp value={k.value} duration={600} />
                  </span>
                  <span className="text-xs text-muted">{k.label}</span>
                </Link>
              ))}
            </motion.div>
          )}

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-wrap gap-2"
          >
            <Pill href="/scan" icon={UploadSimple}>
              Upload documents
            </Pill>
            <Pill href="/documents?status=manual_review" variant="glass" icon={Eye}>
              Review queue
            </Pill>
            <Pill href="/reports" variant="glass" icon={ChartBar}>
              Reports
            </Pill>
          </motion.div>
        </div>
      </Reveal>

      {/* ── KPI tiles ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
          >
          <Link
            href={k.href}
            className="lift group block h-full rounded-xl border border-hair bg-surface p-4 shadow-[var(--shadow-sm)]"
          >
            <p className="text-[13px] font-medium text-muted">{k.label}</p>
            {stats ? (
              <p className={cn("mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular", k.tone ?? "text-fg")}>
                <CountUp value={k.value} />
              </p>
            ) : (
              <div className="skeleton mt-2 h-7 w-14 rounded" />
            )}
            <p className="mt-2 flex items-center justify-between text-xs text-muted">
              {k.note}
              <ArrowRight size={12} className="-translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" />
            </p>
          </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Review queue + illustration (fills the column so it lines up with the side panels) */}
        <Reveal delay={0.05} className="flex flex-col gap-6 lg:col-span-8">
          <Panel
            title="Review queue"
            description={queue ? `${queue.total} document${queue.total === 1 ? "" : "s"} failed at least one check` : "Loading\u2026"}
            action={
              queue && queue.total > 0 ? (
                <Link href="/documents?status=manual_review" className="text-xs font-medium text-accent hover:underline">
                  View all
                </Link>
              ) : null
            }
          >
            <DocTable
              docs={queue?.items}
              compact
              showReason
              empty={
                <span className="inline-flex items-center gap-2">
                  <CheckCircle size={16} className="text-ok" weight="fill" />
                  Nothing waiting for review.
                </span>
              }
            />
          </Panel>

          <section className="relative min-h-[300px] flex-1 overflow-hidden rounded-xl border border-hair bg-surface shadow-[var(--shadow-sm)]">
            <RooftopScene className="absolute inset-0 h-full w-full" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-surface via-surface/70 to-transparent" />
            <div className="relative p-5">
              <h2 className="text-sm font-semibold text-fg">From rooftop to verified</h2>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
                A factory&apos;s electricity bill is read, its consumption checked against KiloWattX rules, and the document verified
                before the solar project moves ahead.
              </p>
              <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium">
                {["Bill read", "Units & dates checked", "Verified"].map((step, i) => (
                  <li key={step} className="flex items-center gap-1.5">
                    {i > 0 && <ArrowRight size={11} className="text-faint" />}
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 backdrop-blur",
                        i === 2 ? "border-ok/30 bg-ok-soft text-ok" : "border-hair bg-surface/80 text-muted",
                      )}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </Reveal>

        {/* Side column */}
        <Reveal delay={0.1} className="space-y-6 lg:col-span-4">
          <Panel title="By document type">
            <ul className="divide-y divide-hair">
              {TYPE_ORDER.map((t) => {
                const n = stats?.byType[t] ?? 0;
                return (
                  <li key={t}>
                    <Link href={`/documents?type=${t}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
                      <TypeIcon type={t} size={28} />
                      <span className="flex-1 text-sm">{TYPE_LABEL[t]}</span>
                      <span className="w-16">
                        <span className="conf-bar-track block">
                          <span
                            className="conf-bar-fill block bg-accent/70"
                            style={{ width: total ? `${Math.max((n / total) * 100, n ? 4 : 0)}%` : 0 }}
                          />
                        </span>
                      </span>
                      <span className="w-6 text-right text-sm font-medium tabular">{n}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Verification providers" description="Where each document type is read">
            <ul className="divide-y divide-hair text-sm">
              {[
                { name: "Local OCR (Tesseract)", scope: "Fallback for all types", on: true },
                { name: "Amazon Textract", scope: "Electricity bills, GST", on: !!stats?.providers?.textract },
                { name: "Perfios", scope: "KYC, bank statements", on: !!stats?.providers?.perfios },
                { name: "Claude vision", scope: "Field extraction", on: !!stats?.aiEnabled },
              ].map((p) => (
                <li key={p.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", p.on ? "bg-ok" : "bg-hair-strong")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.scope}</span>
                  </span>
                  <span className={cn("text-xs", p.on ? "text-ok" : "text-faint")}>{p.on ? "Active" : "Not configured"}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>

      <Reveal delay={0.12} className="mt-6">
        {/* ── Verification Pipeline strip ───────────────────────────────── */}
        <Panel title="Verification pipeline" description="Live document flow across all processing stages">
          <div className="relative overflow-hidden px-4 pb-6 pt-4">
            {/* Connecting line behind the steps */}
            <div className="absolute left-0 right-0 top-[52px] mx-[calc(100%/10)] hidden h-px bg-hair md:block" />
            {/* Animated pulse travelling along the line */}
            <div className="pipeline-pulse absolute left-0 right-0 top-[52px] mx-[calc(100%/10)] hidden h-px md:block" />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                {
                  icon: FileText,
                  label: "Uploaded",
                  value: total,
                  color: "text-accent",
                  bg: "bg-accent/10",
                  desc: "Total received",
                },
                {
                  icon: MagnifyingGlass,
                  label: "Processing",
                  value: processing,
                  color: "text-info",
                  bg: "bg-info/10",
                  desc: "OCR + extraction",
                },
                {
                  icon: Sparkle,
                  label: "Reviewed",
                  value: by.manual_review ?? 0,
                  color: "text-warn",
                  bg: "bg-warn/10",
                  desc: "Needs a reviewer",
                },
                {
                  icon: SealCheck,
                  label: "Verified",
                  value: by.verified ?? 0,
                  color: "text-ok",
                  bg: "bg-ok/10",
                  desc: "Passed all checks",
                },
                {
                  icon: XCircle,
                  label: "Failed",
                  value: by.failed ?? 0,
                  color: "text-danger",
                  bg: "bg-danger/10",
                  desc: "Rejected / unreadable",
                },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 + i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  {/* Icon bubble */}
                  <div className={`relative flex h-14 w-14 items-center justify-center rounded-full border border-hair ${step.bg} shadow-[var(--shadow-sm)]`}>
                    <step.icon size={22} className={step.color} weight="duotone" />
                    {/* Pulsing ring for processing step */}
                    {step.label === "Processing" && processing > 0 && (
                      <span className="absolute inset-0 animate-ping rounded-full border-2 border-info opacity-40 motion-reduce:hidden" />
                    )}
                    {/* Step number badge */}
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface border border-hair text-[9px] font-bold text-muted">
                      {i + 1}
                    </span>
                  </div>
                  {/* Count */}
                  {stats ? (
                    <p className={`text-2xl font-semibold leading-none tracking-tight tabular-nums ${step.color}`}>
                      <CountUp value={step.value} duration={700} />
                    </p>
                  ) : (
                    <div className="skeleton h-7 w-10 rounded" />
                  )}
                  <p className="text-[13px] font-medium text-fg">{step.label}</p>
                  <p className="text-[11px] text-muted">{step.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Pass-rate bar */}
            {decided > 0 && (
              <div className="mt-6 space-y-1.5 border-t border-hair pt-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Overall verification rate</span>
                  <span className="font-semibold tabular-nums text-fg">{rate ?? 0}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-ok/70 to-ok"
                    initial={{ width: 0 }}
                    animate={{ width: `${rate ?? 0}%` }}
                    transition={{ duration: 1.2, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                </div>
                <p className="text-[11px] text-muted">
                  {by.verified ?? 0} verified out of {decided} decided documents
                </p>
              </div>
            )}
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={0.16} className="mt-6">
        <Panel
          title="Recent uploads"
          action={
            <Link href="/documents" className="text-xs font-medium text-accent hover:underline">
              All documents
            </Link>
          }
        >
          <DocTable
            docs={recent?.items}
            empty={
              <span>
                No documents yet.{" "}
                <Link href="/scan" className="font-medium text-accent hover:underline">
                  Upload the first one
                </Link>
              </span>
            }
          />
        </Panel>
      </Reveal>
    </>
  );
}

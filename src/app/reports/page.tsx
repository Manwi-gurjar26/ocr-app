"use client";

import { Bank, CalendarBlank, Certificate, DownloadSimple, FilePdf, Files, IdentificationCard, Lightning } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { qs, useFetch, type Doc } from "@/lib/client";
import { formatMoney, headline } from "@/lib/format";
import { AppButton, Bezel, PageHeader, Pill, Reveal, Segmented } from "@/components/ui";

type T = "all" | "electricity_bill" | "gst_certificate" | "bank_statement" | "id_card" | "invoice" | "receipt";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ReportsPage() {
  const [type, setType] = useState<T>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filter = { type: type === "all" ? undefined : type, from, to };
  const { data } = useFetch<{ items: Doc[]; total: number }>(`/api/documents${qs({ ...filter, limit: 500 })}`);
  const amount = (data?.items ?? []).reduce((a, d) => a + (headline(d.docType, d.fields).amount ?? 0), 0);
  const summaryUrl = `/api/reports/summary${qs(filter)}`;

  const presets: { label: string; from: () => string }[] = [
    { label: "All time", from: () => "" },
    { label: "This month", from: monthStart },
    { label: "Last 7 days", from: () => new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="PDF reports, instantly."
        subtitle="Choose a document type and date range to generate a summary report. Single-document reports are on each document’s page."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Bezel coreClassName="p-6 md:p-8">
            <div className="space-y-8">
              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Document type</p>
                <Segmented
                  id="report-type"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "all", label: "All" },
                    { value: "electricity_bill", label: "Electricity" },
                    { value: "gst_certificate", label: "GST" },
                    { value: "bank_statement", label: "Bank" },
                    { value: "id_card", label: "KYC" },
                    { value: "invoice", label: "Invoices" },
                    { value: "receipt", label: "Receipts" },
                  ]}
                />
              </div>

              <div>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Uploaded between</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <CalendarBlank size={13} /> From
                    </span>
                    <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <CalendarBlank size={13} /> To
                    </span>
                    <input type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setFrom(p.from());
                        setTo("");
                      }}
                      className="rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs text-muted transition-colors duration-500 ease-spring hover:bg-ink/10 hover:text-fg"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-6">
                <Pill href={`${summaryUrl}${summaryUrl.includes("?") ? "&" : "?"}download=1`} icon={DownloadSimple} external>
                  Download summary PDF
                </Pill>
                <Pill href={summaryUrl} variant="glass" icon={FilePdf} external>
                  Preview
                </Pill>
              </div>
            </div>
          </Bezel>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-5">
          <Bezel className="h-full" coreClassName="flex h-full flex-col justify-between gap-8 p-6 md:p-8">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Report will include</p>
              <motion.p key={data?.total} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-6xl font-semibold tracking-[-0.05em]">
                {data ? data.total : "—"}
              </motion.p>
              <p className="text-sm text-muted">documents</p>
            </div>
            {(type === "invoice" || type === "receipt" || type === "electricity_bill") && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Combined amount</p>
                <p className="mt-2 font-mono text-2xl">{formatMoney(amount)}</p>
              </div>
            )}
            <div>
              <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Quick reports</p>
              <div className="grid grid-cols-5 gap-2">
                <AppButton icon={Files} tone="gray" label="All" href="/api/reports/summary" size={50} />
                <AppButton icon={Lightning} tone="orange" label="Bills" href="/api/reports/summary?type=electricity_bill" size={50} />
                <AppButton icon={Certificate} tone="indigo" label="GST" href="/api/reports/summary?type=gst_certificate" size={50} />
                <AppButton icon={Bank} tone="teal" label="Bank" href="/api/reports/summary?type=bank_statement" size={50} />
                <AppButton icon={IdentificationCard} tone="green" label="KYC" href="/api/reports/summary?type=id_card" size={50} />
              </div>
            </div>
          </Bezel>
        </Reveal>
      </div>
    </>
  );
}

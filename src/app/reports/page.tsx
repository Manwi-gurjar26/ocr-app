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
        title="Summary reports"
        subtitle="Pick a document type and date range to export a PDF summary. Single-document reports are on each document’s page."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <Bezel coreClassName="p-5">
            <div className="space-y-8">
              <div>
                <p className="mb-3 text-[13px] font-medium text-muted">Document type</p>
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
                <p className="mb-3 text-[13px] font-medium text-muted">Uploaded between</p>
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
                      className="rounded-md border border-hair bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-hair-strong hover:text-fg"
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
          <Bezel className="h-full" coreClassName="flex h-full flex-col gap-6 p-5">
            <div>
              <p className="text-[13px] font-medium text-muted">Report will include</p>
              <motion.p key={data?.total} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular">
                {data ? data.total : "—"}
              </motion.p>
              <p className="text-sm text-muted">documents</p>
            </div>
            {(type === "invoice" || type === "receipt" || type === "electricity_bill") && (
              <div>
                <p className="text-[13px] font-medium text-muted">Combined amount</p>
                <p className="mt-1.5 text-xl font-semibold tabular">{formatMoney(amount)}</p>
              </div>
            )}
            <div>
              <p className="mb-4 text-[13px] font-medium text-muted">Quick reports</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AppButton icon={Files} tone="gray" label="All documents" href="/api/reports/summary" />
                <AppButton icon={Lightning} tone="orange" label="Electricity bills" href="/api/reports/summary?type=electricity_bill" />
                <AppButton icon={Certificate} tone="indigo" label="GST certificates" href="/api/reports/summary?type=gst_certificate" />
                <AppButton icon={Bank} tone="teal" label="Bank statements" href="/api/reports/summary?type=bank_statement" />
                <AppButton icon={IdentificationCard} tone="green" label="KYC documents" href="/api/reports/summary?type=id_card" />
              </div>
            </div>
          </Bezel>
        </Reveal>
      </div>
    </>
  );
}

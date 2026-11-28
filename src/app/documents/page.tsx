"use client";

import { MagnifyingGlass, UploadSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DocTable } from "@/components/doc-table";
import { PageHeader, Pill, Reveal, Segmented } from "@/components/ui";
import { qs, useDebounced, useFetch, type Doc } from "@/lib/client";
import { isBusy, type DocStatus, type DocType } from "@/lib/types";

type Filter = "all" | DocType;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "electricity_bill", label: "Electricity" },
  { value: "gst_certificate", label: "GST" },
  { value: "bank_statement", label: "Bank" },
  { value: "id_card", label: "KYC" },
  { value: "invoice", label: "Invoices" },
  { value: "receipt", label: "Receipts" },
  { value: "unknown", label: "Other" },
];

type StatusFilter = "all" | DocStatus;
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "manual_review", label: "Needs review" },
  { value: "verified", label: "Verified" },
  { value: "failed", label: "Failed" },
];

function DocumentsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get("type") as Filter) ?? "all";
  const [type, setType] = useState<Filter>(FILTERS.some((f) => f.value === initial) ? initial : "all");
  const initialStatus = (params.get("status") as StatusFilter) ?? "all";
  const [status, setStatus] = useState<StatusFilter>(STATUS_FILTERS.some((f) => f.value === initialStatus) ? initialStatus : "all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);

  const url = `/api/documents${qs({ type: type === "all" ? undefined : type, status: status === "all" ? undefined : status, q: dq, limit: 200 })}`;
  const { data, error } = useFetch<{ items: Doc[]; total: number }>(url, (r) => r.items.some((d) => isBusy(d.status)));

  const go = (t: Filter, st: StatusFilter) =>
    router.replace(`/documents${qs({ type: t === "all" ? undefined : t, status: st === "all" ? undefined : st })}`, { scroll: false });
  const changeType = (t: Filter) => {
    setType(t);
    go(t, status);
  };
  const changeStatus = (st: StatusFilter) => {
    setStatus(st);
    go(type, st);
  };
  const filtered = Boolean(dq) || type !== "all" || status !== "all";
  const clear = () => {
    setQ("");
    setType("all");
    setStatus("all");
    go("all", "all");
  };

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title={status === "manual_review" ? "Review queue" : "All documents"}
        subtitle={
          data
            ? `${data.total.toLocaleString("en-IN")} document${data.total === 1 ? "" : "s"}${filtered ? " match the current filters" : ""}.`
            : "Loading…"
        }
        actions={
          <Pill href="/scan" icon={UploadSimple}>
            Upload documents
          </Pill>
        }
      />

      <Reveal className="overflow-hidden rounded-xl border border-hair bg-surface shadow-[var(--shadow-sm)]">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-hair p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <Segmented id="doc-filter" value={type} onChange={changeType} options={FILTERS} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="Status"
              className="field sm:w-40"
              value={status}
              onChange={(e) => changeStatus(e.target.value as StatusFilter)}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <label className="relative block sm:w-72">
              <span className="sr-only">Search</span>
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, numbers, text" className="field pl-9" />
            </label>
          </div>
        </div>

        {error ? (
          <p className="px-4 py-10 text-center text-sm text-danger">Couldn’t load documents: {error}</p>
        ) : (
          <DocTable
            docs={data?.items}
            empty={
              filtered ? (
                <span>
                  No documents match these filters.{" "}
                  <button onClick={clear} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    <X size={12} /> Clear filters
                  </button>
                </span>
              ) : (
                <span>
                  No documents yet.{" "}
                  <Link href="/scan" className="font-medium text-accent hover:underline">
                    Upload the first one
                  </Link>
                </span>
              )
            }
          />
        )}
      </Reveal>
    </>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsInner />
    </Suspense>
  );
}

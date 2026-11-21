"use client";

import { CaretRight, MagnifyingGlass, Scan, UploadSimple } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { qs, relativeTime, useDebounced, useFetch, type Doc } from "@/lib/client";
import { formatMoney, headline, TYPE_LABEL } from "@/lib/format";
import { AppIcon, Bezel, PageHeader, Pill, Reveal, Segmented, StatusBadge, TypeIcon } from "@/components/ui";

type Filter = "all" | "invoice" | "receipt" | "id_card" | "unknown";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "invoice", label: "Invoices" },
  { value: "receipt", label: "Receipts" },
  { value: "id_card", label: "ID Cards" },
  { value: "unknown", label: "Other" },
];

function DocumentsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get("type") as Filter) ?? "all";
  const [type, setType] = useState<Filter>(FILTERS.some((f) => f.value === initial) ? initial : "all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);

  const url = `/api/documents${qs({ type: type === "all" ? undefined : type, q: dq, limit: 200 })}`;
  const { data, error } = useFetch<{ items: Doc[]; total: number }>(url, (r) => r.items.some((d) => d.status === "processing"));

  const changeType = (t: Filter) => {
    setType(t);
    router.replace(`/documents${qs({ type: t === "all" ? undefined : t })}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Your documents"
        subtitle={data ? `${data.total} document${data.total === 1 ? "" : "s"} stored in PostgreSQL.` : "Loading…"}
        actions={<Pill href="/scan" icon={UploadSimple}>Scan new</Pill>}
      />

      <Reveal className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Segmented id="doc-filter" value={type} onChange={changeType} options={FILTERS} />
        <label className="glass flex w-full items-center gap-2 rounded-full px-4 md:w-80">
          <MagnifyingGlass size={16} className="relative z-[2] text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search names, numbers, text…"
            className="relative z-[2] w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-faint"
          />
        </label>
      </Reveal>

      {error && <p className="text-danger">{error}</p>}

      <Bezel coreClassName="p-2 md:p-3">
        {!data ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[68px] rounded-2xl" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <AppIcon icon={Scan} tone="gray" size={64} />
            <p className="text-muted">{dq || type !== "all" ? "Nothing matches these filters." : "No documents yet."}</p>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {data.items.map((d, i) => {
                const h = headline(d.docType, d.fields);
                return (
                  <motion.li
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.55, delay: Math.min(i, 12) * 0.03, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <Link
                      href={`/documents/${d.id}`}
                      className="group flex items-center gap-4 rounded-[1.4rem] p-3 transition-colors duration-500 ease-spring hover:bg-ink/[0.05] md:p-4"
                    >
                      <TypeIcon type={d.docType} size={46} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{h.title ?? d.fileName}</p>
                        <p className="truncate text-xs text-faint">
                          {TYPE_LABEL[d.docType]} · {d.fileName} · {relativeTime(d.createdAt)}
                        </p>
                      </div>
                      {h.amount != null && <span className="hidden font-mono text-sm md:block">{formatMoney(h.amount, d.fields.currency)}</span>}
                      <StatusBadge status={d.status} />
                      <CaretRight size={16} className="text-faint transition-transform duration-500 ease-spring group-hover:translate-x-1" />
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Bezel>
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

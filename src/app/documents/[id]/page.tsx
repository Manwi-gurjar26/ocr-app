"use client";

import {
  ArrowLeft,
  ArrowsClockwise,
  DownloadSimple,
  Eye,
  EyeSlash,
  FilePdf,
  FloppyDisk,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, useFetch, type Doc } from "@/lib/client";
import { maskIdNumber } from "@/lib/extract/rules/id-card";
import { FIELD_DEFS, formatMoney, ID_TYPE_LABEL, itemsOf, TYPE_LABEL } from "@/lib/format";
import type { DocType } from "@/lib/types";
import { Bezel, cn, Eyebrow, Pill, Reveal, Segmented, spring, StatusBadge, TypeIcon } from "@/components/ui";

const TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "id_card", label: "ID Card" },
  { value: "unknown", label: "Other" },
];

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: doc, error, setData, refresh } = useFetch<Doc>(`/api/documents/${id}`, (d) => d.status === "processing");

  const [type, setType] = useState<DocType>("unknown");
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"fields" | "text">("fields");

  // Reset the editable copy whenever the server version changes (adjust-state-during-render pattern).
  const version = doc ? `${doc.id}:${doc.updatedAt}` : "";
  const [syncedVersion, setSyncedVersion] = useState("");
  if (doc && version !== syncedVersion) {
    setSyncedVersion(version);
    setType(doc.docType);
    setFields(doc.fields ?? {});
  }

  const dirty = useMemo(() => doc && (type !== doc.docType || JSON.stringify(fields) !== JSON.stringify(doc.fields)), [doc, type, fields]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api<Doc>(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docType: type, fields }),
      });
      setData(updated);
      flash("Saved to database");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reprocess = async () => {
    const d = await api<Doc>(`/api/documents/${id}/reprocess`, { method: "POST" });
    setData(d);
    refresh();
  };

  const remove = async () => {
    if (!confirm("Delete this document and its file permanently?")) return;
    await api(`/api/documents/${id}`, { method: "DELETE" });
    router.push("/documents");
  };

  if (error) return <p className="text-danger">{error}</p>;
  if (!doc)
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="skeleton h-[60vh] rounded-[2rem]" />
        <div className="skeleton h-[60vh] rounded-[2rem]" />
      </div>
    );

  const items = itemsOf(type, fields);
  const defs = type === "unknown" ? [] : FIELD_DEFS[type];
  const fileUrl = `/api/documents/${id}/file`;

  return (
    <>
      <Reveal className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/documents" className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-fg">
          <ArrowLeft size={14} className="relative z-[2]" />
          <span className="relative z-[2]">Library</span>
        </Link>
        <div className="flex flex-wrap gap-3">
          <Pill href={`/api/documents/${id}/report?download=1`} icon={DownloadSimple} external>
            Download PDF report
          </Pill>
          <Pill href={`/api/documents/${id}/report`} variant="glass" icon={FilePdf} external>
            Preview
          </Pill>
        </div>
      </Reveal>

      <Reveal className="mb-10 flex items-center gap-5">
        <TypeIcon type={type} size={68} />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>{TYPE_LABEL[type]}</Eyebrow>
            <StatusBadge status={doc.status} />
          </div>
          <h1 className="truncate text-3xl font-semibold tracking-[-0.035em] md:text-5xl">{doc.fileName}</h1>
          <p className="text-sm text-faint">
            {doc.extractionMethod === "ai" ? "AI vision" : "OCR rules"} · confidence {doc.ocrConfidence != null ? `${Math.round(doc.ocrConfidence)}%` : "—"} ·{" "}
            {new Date(doc.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
      </Reveal>

      {doc.status === "failed" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={18} /> {doc.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Preview */}
        <Reveal className="lg:col-span-5">
          <Bezel coreClassName="p-3">
            <div className="relative overflow-hidden rounded-[1.4rem] bg-well">
              {doc.mimeType === "application/pdf" ? (
                <iframe src={fileUrl} title="Document preview" className="h-[70vh] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt={doc.fileName} className="max-h-[70vh] w-full object-contain" />
              )}
              {doc.status === "processing" && (
                <>
                  <div className="absolute inset-0 bg-bg/40" />
                  <div className="scan-line" />
                </>
              )}
            </div>
          </Bezel>
        </Reveal>

        {/* Data */}
        <Reveal delay={0.08} className="lg:col-span-7">
          <Bezel coreClassName="p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Segmented
                id="detail-tab"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "fields", label: "Extracted data" },
                  { value: "text", label: "OCR text" },
                ]}
              />
              {type === "id_card" && tab === "fields" && (
                <button onClick={() => setReveal((r) => !r)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
                  {reveal ? <EyeSlash size={14} /> : <Eye size={14} />} {reveal ? "Hide ID number" : "Reveal ID number"}
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {tab === "text" ? (
                <motion.pre
                  key="text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-well p-5 font-mono text-[12.5px] leading-relaxed text-fg/80"
                >
                  {doc.rawText || "No text recognised."}
                </motion.pre>
              ) : (
                <motion.div key="fields" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Document type</p>
                    <Segmented id="doc-type" value={type} onChange={setType} options={TYPE_OPTIONS} />
                  </div>

                  {defs.length === 0 ? (
                    <p className="text-sm text-muted">Pick a document type to edit its fields.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {defs.map((def) => {
                        const v = fields[def.key];
                        const set = (val: unknown) => setFields((f) => ({ ...f, [def.key]: val }));
                        const masked = def.key === "idNumber" && fields.idType === "aadhaar" && !reveal;
                        return (
                          <label key={def.key} className={cn("block space-y-1.5", def.key === "address" && "sm:col-span-2")}>
                            <span className="text-xs text-muted">{def.label}</span>
                            {def.kind === "idType" ? (
                              <select className="field" value={(v as string) ?? ""} onChange={(e) => set(e.target.value || null)}>
                                <option value="">—</option>
                                {Object.entries(ID_TYPE_LABEL).map(([k, l]) => (
                                  <option key={k} value={k}>
                                    {l}
                                  </option>
                                ))}
                              </select>
                            ) : def.kind === "money" ? (
                              <input
                                className="field font-mono"
                                inputMode="decimal"
                                value={v == null ? "" : String(v)}
                                onChange={(e) => {
                                  const n = e.target.value.replace(/[^\d.]/g, "");
                                  set(n === "" ? null : Number(n));
                                }}
                              />
                            ) : def.kind === "date" ? (
                              <input type="date" className="field" value={(v as string) ?? ""} onChange={(e) => set(e.target.value || null)} />
                            ) : masked ? (
                              <input className="field font-mono" disabled value={maskIdNumber("aadhaar", v as string) ?? ""} />
                            ) : (
                              <input className="field" value={(v as string) ?? ""} onChange={(e) => set(e.target.value || null)} />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {items.length > 0 && (
                    <div>
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-faint">Line items</p>
                      <div className="overflow-hidden rounded-2xl bg-well">
                        <table className="w-full text-sm">
                          <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
                            <tr>
                              <th className="p-3 font-medium">Item</th>
                              <th className="p-3 text-right font-medium">Qty</th>
                              <th className="p-3 text-right font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, i) => (
                              <tr key={i} className="border-t border-ink/10">
                                <td className="p-3">{it.description}</td>
                                <td className="p-3 text-right font-mono">{it.quantity ?? ""}</td>
                                <td className="p-3 text-right font-mono">{formatMoney(it.amount, fields.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6">
              <Pill onClick={save} icon={FloppyDisk} busy={saving} disabled={!dirty}>
                Save changes
              </Pill>
              <Pill onClick={reprocess} variant="glass" icon={ArrowsClockwise} disabled={doc.status === "processing"}>
                Re-scan
              </Pill>
              <Pill onClick={remove} variant="danger" icon={Trash} className="ml-auto">
                Delete
              </Pill>
            </div>
          </Bezel>
        </Reveal>
      </div>

      <AnimatePresence>
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center md:bottom-10">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={spring}
              className="glass glass-strong rounded-full px-5 py-3 text-sm"
            >
              <span className="relative z-[2]">{toast}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

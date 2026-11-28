"use client";

import {
  ArrowLeft,
  ArrowsClockwise,
  CheckCircle,
  CloudArrowUp,
  DownloadSimple,
  Eye,
  EyeSlash,
  FilePdf,
  FloppyDisk,
  Trash,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, relativeTime, useFetch, type Doc, type DocEvent } from "@/lib/client";
import { maskIdNumber } from "@/lib/extract/rules/id-card";
import { FIELD_DEFS, formatMoney, ID_TYPE_LABEL, itemsOf, maskAccount, STATUS_LABEL, transactionsOf, TYPE_LABEL } from "@/lib/format";
import { DOC_TYPES, isBusy, type DocType, type ReviewAction, type ValidationCheck } from "@/lib/types";
import { Bezel, cn, ConfidenceBar, Eyebrow, Pill, Reveal, Segmented, spring, StatusBadge, TypeIcon } from "@/components/ui";

const checksLabel = (n: number) => (n === 0 ? "Checks · passed" : `Checks · ${n} issue${n === 1 ? "" : "s"}`);

const METHOD_LABEL: Record<string, string> = { ai: "AI vision", rules: "OCR rules", textract: "Amazon Textract", perfios: "Perfios" };
const PROVIDER_LABEL: Record<string, string> = { tesseract: "Local OCR", textract: "Amazon Textract", perfios: "Perfios" };

const CHECK_STYLE: Record<ValidationCheck["status"], { I: typeof CheckCircle; cls: string }> = {
  pass: { I: CheckCircle, cls: "text-ok" },
  warn: { I: WarningCircle, cls: "text-warn" },
  fail: { I: XCircle, cls: "text-danger" },
};

function ValidationPanel({ checks }: { checks: ValidationCheck[] }) {
  if (!checks.length) return null;
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  return (
    <ul className="space-y-2">
      {[...checks]
        .sort((a, b) => order[a.status] - order[b.status])
        .map((c) => {
          const st = CHECK_STYLE[c.status];
          return (
            <li key={c.id} className="flex items-start gap-3 rounded-lg border border-hair px-3.5 py-2.5">
              <st.I size={18} weight="fill" className={cn("mt-0.5 shrink-0", st.cls)} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted">{c.message}</p>
              </div>
            </li>
          );
        })}
    </ul>
  );
}

function ReviewPanel({ doc, onDone }: { doc: Doc; onDone: (d: Doc, msg: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const act = async (action: ReviewAction) => {
    setBusy(action);
    setErr(null);
    try {
      const d = await api<Doc>(`/api/documents/${doc.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      setNote("");
      onDone(d, action === "approve" ? "Approved \u2014 marked verified" : action === "reject" ? "Rejected" : "Re-upload requested");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      {doc.reviewedBy && (
        <p className="text-xs text-muted">
          Last reviewed by <span className="font-medium text-fg">{doc.reviewedBy}</span>
          {doc.reviewedAt ? ` \u00b7 ${relativeTime(doc.reviewedAt)}` : ""}
          {doc.reviewNote ? ` \u2014 "${doc.reviewNote}"` : ""}
        </p>
      )}
      <textarea
        className="field min-h-[72px] resize-y"
        placeholder="Review note (required to reject or request a re-upload)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Pill onClick={() => act("approve")} icon={CheckCircle} busy={busy === "approve"} disabled={!!busy || doc.status === "verified"}>
          Approve
        </Pill>
        <Pill onClick={() => act("request_reupload")} variant="glass" icon={CloudArrowUp} busy={busy === "request_reupload"} disabled={!!busy}>
          Request re-upload
        </Pill>
        <Pill onClick={() => act("reject")} variant="danger" icon={XCircle} busy={busy === "reject"} disabled={!!busy}>
          Reject
        </Pill>
      </div>
    </div>
  );
}

function Timeline({ id, version }: { id: string; version: string }) {
  const { data } = useFetch<{ events: DocEvent[] }>(`/api/documents/${id}/history?v=${encodeURIComponent(version)}`);
  if (!data?.events.length) return <p className="text-sm text-muted">No history yet.</p>;
  return (
    <ol className="space-y-3 border-l border-ink/10 pl-4">
      {data.events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-hair-strong" />
          <p className="text-sm">
            <span className="font-medium">{STATUS_LABEL[e.toStatus] ?? e.toStatus}</span>
            {e.action !== "system" && <span className="text-muted">{` \u00b7 ${e.action.replace(/_/g, " ")} by ${e.actor}`}</span>}
          </p>
          <p className="text-xs text-faint">
            {new Date(e.createdAt).toLocaleString("en-IN")}
            {e.note ? ` \u2014 ${e.note}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: doc, error, setData, refresh } = useFetch<Doc>(`/api/documents/${id}`, (d) => isBusy(d.status));

  const [type, setType] = useState<DocType>("unknown");
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"fields" | "checks" | "history" | "text">("fields");

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
      flash(updated.status === "verified" ? "Saved \u2014 all checks pass" : "Saved \u2014 re-validated");
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
        <div className="skeleton h-[60vh] rounded-xl" />
        <div className="skeleton h-[60vh] rounded-xl" />
      </div>
    );

  const items = itemsOf(type, fields);
  const txns = transactionsOf(type, fields);
  const busyNow = isBusy(doc.status);
  const defs = type === "unknown" ? [] : FIELD_DEFS[type];
  const fileUrl = `/api/documents/${id}/file`;

  return (
    <>
      <Reveal className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg">
          <ArrowLeft size={14} className="relative z-[2]" />
          <span>Documents</span>
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
        <TypeIcon type={type} size={44} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>{TYPE_LABEL[type]}</Eyebrow>
            <StatusBadge status={doc.status} />
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{doc.fileName}</h1>
          <p className="text-sm text-faint">
            {doc.ocrProvider ? `${PROVIDER_LABEL[doc.ocrProvider] ?? doc.ocrProvider} \u00b7 ` : ""}
            {METHOD_LABEL[doc.extractionMethod ?? "rules"] ?? "OCR rules"} · {new Date(doc.createdAt).toLocaleString("en-IN")}
            {doc.customerId ? ` \u00b7 Customer ${doc.customerId}` : ""}
            {doc.declaredType && doc.declaredType !== doc.docType ? ` \u00b7 uploaded as ${TYPE_LABEL[doc.declaredType]}` : ""}
          </p>
          <ConfidenceBar value={doc.ocrConfidence} className="max-w-xs pt-1" />
        </div>
      </Reveal>

      {doc.status === "failed" && (
        <div role="alert" className="mb-6 flex items-center gap-2.5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          <WarningCircle size={18} /> {doc.error}
        </div>
      )}
      {doc.status === "manual_review" && doc.validation && (
        <div className="mb-6 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-sm text-warn">
          <p className="flex items-center gap-2 font-medium">
            <Eye size={18} /> Needs manual review
          </p>
          <ul className="mt-1 list-disc pl-8 text-xs">
            {doc.validation.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Preview */}
        <Reveal className="lg:col-span-5">
          <Bezel coreClassName="p-3">
            <div className="relative overflow-hidden rounded-lg bg-well">
              {doc.mimeType === "application/pdf" ? (
                <iframe src={fileUrl} title="Document preview" className="h-[70vh] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt={doc.fileName} className="max-h-[70vh] w-full object-contain" />
              )}
              {busyNow && (
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
          <Bezel coreClassName="p-5">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Segmented
                id="detail-tab"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "fields", label: "Extracted data" },
                  { value: "checks", label: doc.validation ? checksLabel(doc.validation.checks.filter((c) => c.status === "fail").length) : "Checks" },
                  { value: "history", label: "History" },
                  { value: "text", label: "OCR text" },
                ]}
              />
              {(type === "id_card" || type === "bank_statement") && tab === "fields" && (
                <button onClick={() => setReveal((r) => !r)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
                  {reveal ? <EyeSlash size={14} /> : <Eye size={14} />} {reveal ? "Hide number" : "Reveal number"}
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {tab === "checks" ? (
                <motion.div key="checks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  {doc.validation ? (
                    <ValidationPanel checks={doc.validation.checks} />
                  ) : (
                    <p className="text-sm text-muted">{busyNow ? "Validation runs once extraction finishes\u2026" : "Not validated yet \u2014 re-scan to run the checks."}</p>
                  )}
                  {!busyNow && (
                    <div>
                      <p className="mb-3 text-[13px] font-medium text-fg">Reviewer decision</p>
                      <ReviewPanel
                        doc={doc}
                        onDone={(d, m) => {
                          setData(d);
                          flash(m);
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              ) : tab === "history" ? (
                <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <Timeline id={doc.id} version={version} />
                </motion.div>
              ) : tab === "text" ? (
                <motion.pre
                  key="text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-hair bg-well p-4 font-mono text-[12.5px] leading-relaxed text-fg/80"
                >
                  {doc.rawText || "No text recognised."}
                </motion.pre>
              ) : (
                <motion.div key="fields" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-fg">Document type</p>
                    <select className="field max-w-xs" value={type} onChange={(e) => setType(e.target.value as DocType)}>
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
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
                            ) : def.kind === "number" ? (
                              <input
                                className="field font-mono"
                                inputMode="decimal"
                                value={v == null ? "" : String(v)}
                                onChange={(e) => {
                                  const n = e.target.value.replace(/[^\d.]/g, "");
                                  set(n === "" ? null : Number(n));
                                }}
                              />
                            ) : def.kind === "masked" && !reveal ? (
                              <input className="field font-mono" disabled value={typeof v === "string" ? maskAccount(v) : ""} />
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

                  {txns.length > 0 && (
                    <div>
                      <p className="mb-3 text-[13px] font-medium text-fg">Transactions ({txns.length})</p>
                      <div className="max-h-80 overflow-auto rounded-lg border border-hair">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 border-b border-hair bg-surface-2 text-left text-xs text-muted">
                            <tr>
                              <th className="p-3 font-medium">Date</th>
                              <th className="p-3 font-medium">Description</th>
                              <th className="p-3 text-right font-medium">Debit</th>
                              <th className="p-3 text-right font-medium">Credit</th>
                              <th className="p-3 text-right font-medium">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {txns.map((t, i) => (
                              <tr key={i} className="border-t border-ink/10">
                                <td className="whitespace-nowrap p-3 font-mono text-xs">{t.date ?? ""}</td>
                                <td className="p-3">{t.description}</td>
                                <td className="p-3 text-right font-mono">{t.debit != null ? formatMoney(t.debit) : ""}</td>
                                <td className="p-3 text-right font-mono">{t.credit != null ? formatMoney(t.credit) : ""}</td>
                                <td className="p-3 text-right font-mono">{t.balance != null ? formatMoney(t.balance) : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-xs text-faint">Basic OCR read. Credit assessment uses Perfios Bank Statement Analyser.</p>
                    </div>
                  )}

                  {items.length > 0 && (
                    <div>
                      <p className="mb-3 text-[13px] font-medium text-fg">Line items</p>
                      <div className="overflow-hidden rounded-lg border border-hair">
                        <table className="w-full text-sm">
                          <thead className="border-b border-hair bg-surface-2 text-left text-xs text-muted">
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
              <Pill onClick={reprocess} variant="glass" icon={ArrowsClockwise} disabled={busyNow}>
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
              className="rounded-lg bg-fg px-4 py-2.5 text-sm font-medium text-bg shadow-[var(--shadow-md)]"
            >
              <span className="relative z-[2]">{toast}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

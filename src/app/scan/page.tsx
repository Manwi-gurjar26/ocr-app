"use client";

import { ArrowRight, CircleNotch, FilePdf, MagicWand, WarningCircle } from "@phosphor-icons/react";
import { ScanArt } from "@/components/art";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Doc } from "@/lib/client";
import { DECLARED_FIELDS, formatMoney, headline, STATUS_LABEL, TYPE_LABEL, UPLOAD_TYPES } from "@/lib/format";
import { isBusy, type DocType } from "@/lib/types";
import { cn, PageHeader, Reveal, spring, StatusBadge, TypeIcon } from "@/components/ui";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

interface Job {
  doc: Doc;
  preview?: string;
}

export default function ScanPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType | "auto">("auto");
  const [customerId, setCustomerId] = useState("");
  const [declared, setDeclared] = useState<Record<string, string>>({});
  const declaredFields = useMemo(() => (docType === "auto" ? [] : (DECLARED_FIELDS[docType] ?? [])), [docType]);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setErrors([]);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (docType !== "auto") form.set("docType", docType);
    if (customerId.trim()) form.set("customerId", customerId.trim());
    const details = Object.fromEntries(
      declaredFields.map((d) => [d.key, declared[d.key]?.trim()]).filter(([, v]) => v),
    );
    if (Object.keys(details).length) form.set("declared", JSON.stringify(details));
    try {
      const res = await api<{ items: Doc[]; errors: string[] }>("/api/documents", { method: "POST", body: form });
      const byName = new Map(files.map((f) => [f.name, f]));
      setJobs((j) => [
        ...res.items.map((doc) => {
          const f = byName.get(doc.fileName);
          return { doc, preview: f && f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined };
        }),
        ...j,
      ]);
      setErrors(res.errors);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setUploading(false);
    }
  }, [docType, customerId, declared, declaredFields]);

  // Poll documents that are still processing.
  const pending = jobs.filter((j) => isBusy(j.doc.status)).map((j) => j.doc.id).join(",");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      const ids = pending.split(",");
      const updated = await Promise.all(ids.map((id) => api<Doc>(`/api/documents/${id}`).catch(() => null)));
      setJobs((js) =>
        js.map((j) => {
          const u = updated.find((x) => x?.id === j.doc.id);
          return u ? { ...j, doc: u } : j;
        }),
      );
    }, 1200);
    return () => clearInterval(t);
  }, [pending]);

  // Revoke object URLs on unmount.
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(() => () => jobsRef.current.forEach((j) => j.preview && URL.revokeObjectURL(j.preview)), []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    upload([...e.dataTransfer.files]);
  };

  const finished = jobs.filter((j) => !isBusy(j.doc.status));

  return (
    <>
      <PageHeader
        eyebrow="Upload"
        title="Upload documents"
        subtitle="PDF, JPG, PNG or WEBP up to 10 MB each, 20 per batch. Each file is read, its fields extracted and checked against KiloWattX rules. Anything that fails a check goes to a reviewer, never straight to rejection."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Details */}
        <Reveal className="lg:col-span-5">
          <section className="rounded-xl border border-hair bg-surface shadow-[var(--shadow-sm)]">
            <header className="border-b border-hair px-4 py-3">
              <h2 className="text-sm font-semibold">Upload details</h2>
              <p className="mt-0.5 text-xs text-muted">Applied to every file in the next upload.</p>
            </header>
            <div className="space-y-5 p-4">
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Document type</p>
                <div role="radiogroup" aria-label="Document type" className="grid grid-cols-2 gap-2">
                  {UPLOAD_TYPES.map((t) => {
                    const on = docType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setDocType(t.value)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          on ? "border-accent bg-accent-soft font-medium text-fg ring-1 ring-accent" : "border-hair hover:border-hair-strong hover:bg-surface-2",
                          t.value === "auto" && "col-span-2",
                        )}
                      >
                        {t.value === "auto" ? (
                          <span className="grid h-6 w-6 place-items-center rounded-md bg-surface-2 text-muted">
                            <MagicWand size={14} />
                          </span>
                        ) : (
                          <TypeIcon type={t.value} size={24} />
                        )}
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted">
                  {docType === "auto"
                    ? "The type is detected from the content."
                    : "The content is checked against this type; a mismatch is sent for review."}
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-medium">
                  Customer ID <span className="font-normal text-faint">(optional)</span>
                </span>
                <input className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="CUST-1042" />
              </label>

              {declaredFields.length > 0 && (
                <fieldset className="space-y-3 rounded-lg border border-hair bg-surface-2/60 p-3">
                  <legend className="px-1 text-[13px] font-medium">Customer-entered details</legend>
                  {declaredFields.map((d) => (
                    <label key={d.key} className="block space-y-1.5">
                      <span className="text-xs text-muted">{d.label}</span>
                      <input
                        className="field"
                        value={declared[d.key] ?? ""}
                        onChange={(e) => setDeclared((x) => ({ ...x, [d.key]: e.target.value }))}
                        placeholder={d.placeholder}
                      />
                    </label>
                  ))}
                  <p className="text-xs text-muted">Cross-checked against what the document says.</p>
                </fieldset>
              )}
            </div>
          </section>
        </Reveal>

        {/* Drop zone + session */}
        <Reveal delay={0.05} className="space-y-6 lg:col-span-7">
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            data-drag={drag}
            className="drop-zone flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-surface/90 px-6 py-12 text-center shadow-[var(--shadow-sm)] backdrop-blur"
          >
            <ScanArt active={drag || uploading} className="h-24 w-24" />
            <span className="space-y-1">
              <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                {uploading && <CircleNotch size={15} className="animate-spin text-accent" />}
                {uploading ? "Uploading…" : drag ? "Release to upload" : "Drag files here"}
              </span>
              <span className="block text-sm text-muted">
                or <span className="font-medium text-accent">browse your device</span>
              </span>
            </span>
            <span className="text-xs text-faint">PDF · JPG · PNG · WEBP — up to 10 MB each</span>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                upload([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </button>

          <AnimatePresence>
            {errors.map((err) => (
              <motion.div
                key={err}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger"
              >
                <WarningCircle size={17} className="mt-px shrink-0" /> {err}
              </motion.div>
            ))}
          </AnimatePresence>

          {jobs.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-hair bg-surface shadow-[var(--shadow-sm)]">
              <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
                <h2 className="text-sm font-semibold">
                  This session <span className="ml-1 font-normal text-muted">{jobs.length}</span>
                </h2>
                {finished.length > 0 && (
                  <span className="text-xs text-muted">
                    {jobs.filter((j) => j.doc.status === "verified").length} verified ·{" "}
                    {jobs.filter((j) => j.doc.status === "manual_review").length} need review · {finished.length} of {jobs.length} finished
                  </span>
                )}
              </header>
              <ul className="divide-y divide-hair">
                <AnimatePresence initial={false}>
                  {jobs.map(({ doc, preview }) => {
                    const h = headline(doc.docType, doc.fields);
                    const busy = isBusy(doc.status);
                    return (
                      <motion.li
                        key={doc.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={spring}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-hair bg-surface-2">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="h-full w-full object-cover object-top" />
                          ) : (
                            <span className="grid h-full place-items-center text-faint">
                              <FilePdf size={20} />
                            </span>
                          )}
                          {busy && <div className="scan-line" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{busy ? doc.fileName : (h.title ?? doc.fileName)}</p>
                            {!busy && <TypeIcon type={doc.docType} size={18} />}
                          </div>
                          <p
                            className={cn(
                              "truncate text-xs",
                              doc.status === "failed" ? "text-danger" : doc.status === "manual_review" ? "text-warn" : "text-muted",
                            )}
                          >
                            {busy
                              ? `${STATUS_LABEL[doc.status]}…`
                              : doc.status === "failed"
                                ? doc.error
                                : doc.status === "manual_review"
                                  ? (doc.validation?.reasons[0] ?? "Needs review")
                                  : `${TYPE_LABEL[doc.docType]}${h.amount != null ? ` · ${formatMoney(h.amount, doc.fields.currency)}` : ""}`}
                          </p>
                        </div>
                        <StatusBadge status={doc.status} />
                        {!busy ? (
                          <Link
                            href={`/documents/${doc.id}`}
                            aria-label="Open"
                            className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                          >
                            <ArrowRight size={15} />
                          </Link>
                        ) : (
                          <span className="h-8 w-8" />
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          )}
        </Reveal>
      </div>
    </>
  );
}

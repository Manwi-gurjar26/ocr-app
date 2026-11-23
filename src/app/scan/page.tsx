"use client";

import { ArrowRight, CircleNotch, CloudArrowUp, FilePdf, Files, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Doc } from "@/lib/client";
import { DECLARED_FIELDS, formatMoney, headline, STATUS_LABEL, TYPE_LABEL, UPLOAD_TYPES } from "@/lib/format";
import { isBusy, type DocType } from "@/lib/types";
import { AppIcon, Bezel, cn, PageHeader, Reveal, Segmented, spring, StatusBadge, TypeIcon } from "@/components/ui";

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

  return (
    <>
      <PageHeader
        eyebrow="Scan"
        title="Drop it. We’ll read it."
        subtitle="Electricity bills, GST certificates, bank statements and KYC documents — PDF, JPG, PNG or WEBP up to 10 MB each. Each file is OCR’d, its fields extracted, checked against business rules and either verified or sent for review."
      />

      <Reveal className="mb-6">
        <div className="glass rounded-[1.75rem] p-5">
          <div className="relative z-[2] space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-medium">Document type</p>
              <div className="-mx-1 overflow-x-auto px-1">
                <Segmented id="upload-type" value={docType} onChange={setDocType} options={UPLOAD_TYPES} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Customer ID (optional)</span>
                <input className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="CUST-1042" />
              </label>
              {declaredFields.map((d) => (
                <label key={d.key} className="space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-faint">{d.label}</span>
                  <input
                    className="field"
                    value={declared[d.key] ?? ""}
                    onChange={(e) => setDeclared((x) => ({ ...x, [d.key]: e.target.value }))}
                    placeholder={d.placeholder}
                  />
                </label>
              ))}
            </div>
            {declaredFields.length > 0 && (
              <p className="text-xs text-muted">Details you enter are cross-checked against what the document says. Mismatches go to manual review — they are never auto-rejected.</p>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <Bezel>
          <motion.button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            animate={{ scale: drag ? 1.015 : 1 }}
            transition={spring}
            className={cn(
              "relative flex w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-[calc(2rem-6px)] px-6 py-20 text-center outline-none md:py-28",
              "focus-visible:ring-2 focus-visible:ring-sky-400/60",
            )}
          >
            <div aria-hidden data-drag={drag} className="drop-zone pointer-events-none absolute inset-4 rounded-[1.5rem] border-2 border-dashed" />
            <motion.div animate={{ y: drag ? -8 : [0, -6, 0] }} transition={drag ? spring : { duration: 3.2, repeat: Infinity, ease: [0.32, 0.72, 0, 1] }}>
              <AppIcon icon={CloudArrowUp} tone="blue" size={84} />
            </motion.div>
            <div className="space-y-2">
              <p className="text-2xl font-semibold tracking-tight">{drag ? "Release to scan" : "Drag files here"}</p>
              <p className="text-sm text-muted">or click to browse your device</p>
            </div>
            {/* format badges */}
            <div className="flex flex-wrap justify-center gap-2">
              {["PNG", "JPG", "WEBP", "PDF"].map((fmt) => (
                <span key={fmt} className="rounded-full bg-ink/[0.07] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-faint">{fmt}</span>
              ))}
            </div>
            <span className="inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-btn-from to-btn-to py-1.5 pl-5 pr-1.5 text-sm font-medium text-btn-fg shadow-[0_10px_30px_-10px_var(--btn-glow),inset_0_1px_0_var(--btn-hi)]">
              {uploading ? "Uploading\u2026" : "Choose files"}
              <span className="grid h-8 w-8 place-items-center rounded-full bg-btn-fg/10">
                {uploading ? <CircleNotch size={16} className="animate-spin" /> : <Files size={16} weight="bold" />}
              </span>
            </span>
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
          </motion.button>
        </Bezel>
      </Reveal>

      <AnimatePresence>
        {errors.map((err) => (
          <motion.div
            key={err}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-danger"
          >
            <WarningCircle size={18} /> {err}
          </motion.div>
        ))}
      </AnimatePresence>

      {jobs.length > 0 && (
        <section className="mt-14">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              This session
              <span className="ml-2 rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-sm font-medium text-faint">{jobs.length}</span>
            </h2>
            {jobs.some((j) => !isBusy(j.doc.status)) && (
              <span className="text-xs text-muted">
                {jobs.filter((j) => j.doc.status === "verified").length} verified ·{" "}
                {jobs.filter((j) => j.doc.status === "manual_review").length} need review ·{" "}
                {jobs.filter((j) => !isBusy(j.doc.status)).length} of {jobs.length} finished
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {jobs.map(({ doc, preview }) => {
              const h = headline(doc.docType, doc.fields);
              const busy = isBusy(doc.status);
              return (
                <motion.div key={doc.id} layout initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring}>
                  <Bezel coreClassName="p-3">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-well">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="" className="h-full w-full object-cover object-top opacity-90" />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <AppIcon icon={FilePdf} tone="red" size={64} />
                        </div>
                      )}
                      {busy && (
                        <>
                          <div className="absolute inset-0 bg-bg/40" />
                          <div className="scan-line" />
                        </>
                      )}
                      {/* frosted chip keeps the badge legible over any thumbnail */}
                      {/* .glass sets position:relative, so positioning lives on the wrapper */}
                      <div className="absolute left-3 top-3">
                        <div className="glass glass-strong rounded-full p-0.5">
                          <span className="relative z-[2] block">
                            <StatusBadge status={doc.status} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 pt-4">
                      {busy ? <div className="skeleton h-10 w-10 rounded-xl" /> : <TypeIcon type={doc.docType} size={40} />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{busy ? doc.fileName : (h.title ?? doc.fileName)}</p>
                        <p className="truncate text-xs text-faint">
                          {busy
                            ? `${STATUS_LABEL[doc.status]}…`
                            : doc.status === "failed"
                              ? doc.error
                              : doc.status === "manual_review"
                                ? (doc.validation?.reasons[0] ?? "Needs review")
                                : `${TYPE_LABEL[doc.docType]}${h.amount != null ? ` · ${formatMoney(h.amount, doc.fields.currency)}` : ""}`}
                        </p>
                      </div>
                      {!busy && (
                        <Link href={`/documents/${doc.id}`} aria-label="Open" className="grid h-9 w-9 place-items-center rounded-full bg-ink/10 transition-transform duration-500 ease-spring hover:scale-110">
                          <ArrowRight size={16} weight="bold" />
                        </Link>
                      )}
                    </div>
                  </Bezel>
                </motion.div>
              );
            })}
          </AnimatePresence>
          </div>
        </section>
      )}
    </>
  );
}

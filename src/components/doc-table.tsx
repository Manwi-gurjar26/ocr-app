"use client";

import { CaretRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { relativeTime, type Doc } from "@/lib/client";
import { formatMoney, headline, TYPE_LABEL } from "@/lib/format";
import { isBusy } from "@/lib/types";
import { cn, StatusBadge, TypeIcon } from "./ui";

/** Dense, keyboard-accessible document table. Rows open the review page. */
export function DocTable({
  docs,
  loading,
  empty,
  compact,
  showReason,
}: {
  docs: Doc[] | undefined;
  loading?: boolean;
  empty?: ReactNode;
  /** Hide secondary columns (for narrow cards). */
  compact?: boolean;
  /** Show the first manual-review reason under the title. */
  showReason?: boolean;
}) {
  const router = useRouter();

  if (!docs || loading)
    return (
      <div className="divide-y divide-hair">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="skeleton h-8 w-8 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3.5 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/4 rounded" />
            </div>
            <div className="skeleton h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );

  if (!docs.length) return <div className="px-4 py-12 text-center text-sm text-muted">{empty ?? "No documents."}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hair text-left text-xs font-medium text-muted">
            <th className="w-full py-2.5 pl-4 pr-3 font-medium">Document</th>
            {!compact && <th className="hidden px-3 py-2.5 font-medium md:table-cell">Type</th>}
            <th className="px-3 py-2.5 font-medium">Status</th>
            {!compact && <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">Confidence</th>}
            {!compact && <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Amount</th>}
            <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Uploaded</th>
            <th className="w-8 py-2.5 pr-3" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {docs.map((d, i) => {
            const h = headline(d.docType, d.fields);
            const href = `/documents/${d.id}`;
            const reason = showReason && d.status === "manual_review" ? d.validation?.reasons[0] : null;
            return (
              <motion.tr
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i, 10) * 0.035, ease: [0.2, 0.8, 0.2, 1] }}
                tabIndex={0}
                role="link"
                aria-label={`Open ${d.fileName}`}
                onClick={() => router.push(href)}
                onKeyDown={(e) => e.key === "Enter" && router.push(href)}
                className="group cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <td className="max-w-0 py-2.5 pl-4 pr-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <TypeIcon type={d.docType} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{isBusy(d.status) ? d.fileName : (h.title ?? d.fileName)}</p>
                      <p className={cn("truncate text-xs", reason ? "text-warn" : "text-muted")}>
                        {reason ?? (compact ? TYPE_LABEL[d.docType] : d.fileName)}
                      </p>
                    </div>
                  </div>
                </td>
                {!compact && <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted md:table-cell">{TYPE_LABEL[d.docType]}</td>}
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge status={d.status} />
                </td>
                {!compact && (
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-muted lg:table-cell">
                    {d.ocrConfidence != null ? `${Math.round(d.ocrConfidence)}%` : "—"}
                  </td>
                )}
                {!compact && (
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell">
                    {h.amount != null ? formatMoney(h.amount, d.fields.currency) : <span className="text-faint">—</span>}
                  </td>
                )}
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-muted sm:table-cell">{relativeTime(d.createdAt)}</td>
                <td className="py-2.5 pr-3 text-faint">
                  <CaretRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Card with a header row and flush content (tables, lists). */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-hair bg-surface shadow-[var(--shadow-sm)]", className)}>
      <header className="flex items-center justify-between gap-4 border-b border-hair px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

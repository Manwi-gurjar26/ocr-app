"use client";

import {
  Bank,
  Certificate,
  CheckCircle,
  CircleNotch,
  Eye,
  IdentificationCard,
  Invoice,
  Lightning,
  Question,
  Receipt,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { motion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { forwardRef, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import type { DocStatus, DocType } from "@/lib/types";
import { SolarScene } from "./art";

export const spring = { type: "spring", stiffness: 500, damping: 40, mass: 0.8 } as const;
export const softSpring = { type: "spring", stiffness: 260, damping: 30 } as const;

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------- Surfaces ---------------- */

/** Plain surface (kept under its old name so existing markup keeps working). */
export const Glass = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function Glass({ className, children, ...rest }, ref) {
    return (
      <motion.div ref={ref} className={cn("glass", className)} {...rest}>
        {children as ReactNode}
      </motion.div>
    );
  },
);

/** Card: bordered surface with a soft shadow. */
export function Bezel({ className, coreClassName, children, ...rest }: HTMLMotionProps<"div"> & { coreClassName?: string }) {
  return (
    <motion.div className={cn("bezel", className)} {...rest}>
      <div className={cn("glass bezel-core h-full", coreClassName)}>{children as ReactNode}</div>
    </motion.div>
  );
}

/** Subtle fade-up on mount. */
export function Reveal({ delay = 0, className, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(delay, 0.2), ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Icon tiles ---------------- */

export type Tone = "blue" | "indigo" | "green" | "orange" | "pink" | "teal" | "red" | "gray";

export function AppIcon({ icon: I, tone = "blue", size = 40, className }: { icon: Icon; tone?: Tone; size?: number; className?: string }) {
  return (
    <span className={cn("app-icon", `tone-${tone}`, className)} style={{ ["--size" as string]: `${size}px` }}>
      <I size={Math.round(size * 0.5)} weight="duotone" />
    </span>
  );
}

/** Compact action row: icon tile + label. */
export function AppButton({
  icon,
  tone,
  label,
  href,
  onClick,
  size = 32,
}: {
  icon: Icon;
  tone: Tone;
  label: string;
  href?: string;
  onClick?: () => void;
  size?: number;
}) {
  const cls =
    "flex items-center gap-2.5 rounded-lg border border-hair bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-hair-strong hover:bg-surface-2";
  const inner = (
    <>
      <AppIcon icon={icon} tone={tone} size={Math.min(size, 32)} />
      <span className="truncate">{label}</span>
    </>
  );
  if (href?.startsWith("/api/"))
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ---------------- Buttons ---------------- */

type PillProps = {
  children: ReactNode;
  icon?: Icon;
  variant?: "primary" | "glass" | "danger";
  href?: string;
  external?: boolean;
  busy?: boolean;
} & Omit<ComponentProps<"button">, "ref">;

/** Button. `glass` is the secondary (outlined) style. The icon leads the label. */
export function Pill({ children, icon: I, variant = "primary", href, external, busy, className, disabled, ...rest }: PillProps) {
  const cls = cn(
    "inline-flex h-9 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-accent text-accent-fg shadow-[var(--shadow-sm)] hover:bg-accent-hover",
    variant === "glass" && "border border-hair-strong bg-surface text-fg shadow-[var(--shadow-sm)] hover:bg-surface-2",
    variant === "danger" && "border border-hair-strong bg-surface text-danger hover:border-danger/40 hover:bg-danger-soft",
    className,
  );
  const content = (
    <>
      {busy ? <CircleNotch size={15} className="animate-spin" /> : I ? <I size={15} weight="bold" /> : null}
      <span>{children}</span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
        {content}
      </Link>
    );
  return (
    <button className={cls} disabled={disabled || busy} {...rest}>
      {content}
    </button>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  id: string;
}) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-hair bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-[1] whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
            value === o.value ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              transition={spring}
              className="absolute inset-0 -z-10 rounded-md bg-surface shadow-[var(--shadow-sm)] ring-1 ring-hair"
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Badges & document visuals ---------------- */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-medium text-muted">{children}</span>;
}

export const TYPE_VISUAL: Record<DocType, { icon: Icon; tone: Tone }> = {
  electricity_bill: { icon: Lightning, tone: "orange" },
  gst_certificate: { icon: Certificate, tone: "indigo" },
  bank_statement: { icon: Bank, tone: "teal" },
  id_card: { icon: IdentificationCard, tone: "green" },
  invoice: { icon: Invoice, tone: "blue" },
  receipt: { icon: Receipt, tone: "pink" },
  unknown: { icon: Question, tone: "gray" },
};

export function TypeIcon({ type, size = 36 }: { type: DocType; size?: number }) {
  const v = TYPE_VISUAL[type];
  return <AppIcon icon={v.icon} tone={v.tone} size={size} />;
}

const STATUS_VISUAL: Record<DocStatus, { I: Icon; cls: string; label: string; busy: boolean }> = {
  uploaded: { I: CircleNotch, cls: "text-info bg-info-soft", label: "Uploaded", busy: true },
  processing: { I: CircleNotch, cls: "text-info bg-info-soft", label: "Reading", busy: true },
  extracted: { I: CircleNotch, cls: "text-info bg-info-soft", label: "Extracted", busy: true },
  validation_pending: { I: CircleNotch, cls: "text-info bg-info-soft", label: "Validating", busy: true },
  verified: { I: CheckCircle, cls: "text-ok bg-ok-soft", label: "Verified", busy: false },
  manual_review: { I: Eye, cls: "text-warn bg-warn-soft", label: "Needs review", busy: false },
  failed: { I: WarningCircle, cls: "text-danger bg-danger-soft", label: "Failed", busy: false },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const map = STATUS_VISUAL[status] ?? STATUS_VISUAL.failed;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", map.cls)}>
      <map.I size={13} weight="bold" className={map.busy ? "animate-spin" : undefined} />
      {map.label}
    </span>
  );
}

/** Horizontal confidence bar (0–100). */
export function ConfidenceBar({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = pct >= 80 ? "var(--ok)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>OCR confidence</span>
        <span className="font-medium tabular text-fg">{pct}%</span>
      </div>
      <div className="conf-bar-track">
        <motion.div
          className="conf-bar-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

/** Simple tooltip wrapper. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tooltip">
      {children}
      <span className="tooltip-label">{label}</span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  art = true,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Faded solar-scene strip on the right (desktop). */
  art?: boolean;
}) {
  return (
    <Reveal className="relative mb-8 overflow-hidden rounded-xl border border-hair bg-surface shadow-[var(--shadow-sm)]">
      {art && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] md:block"
          style={{ maskImage: "linear-gradient(to right, transparent, black 45%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 45%)" }}
        >
          <SolarScene variant="strip" className="h-full w-full" />
        </div>
      )}
      <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:p-6">
        <div className="min-w-0 space-y-1.5 md:max-w-[55%]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg md:text-[28px]">{title}</h1>
          {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 md:self-center">{actions}</div>}
      </div>
    </Reveal>
  );
}

export function stop(e: MouseEvent) {
  e.stopPropagation();
}

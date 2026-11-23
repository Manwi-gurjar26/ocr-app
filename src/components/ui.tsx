"use client";

import {
  ArrowUpRight,
  Bank,
  Certificate,
  CircleNotch,
  Eye,
  IdentificationCard,
  Lightning,
  SealCheck,
  Invoice,
  Question,
  Receipt,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { motion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { forwardRef, useCallback, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import type { DocStatus, DocType } from "@/lib/types";

export const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;
export const softSpring = { type: "spring", stiffness: 160, damping: 24 } as const;

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------- Glass surfaces ---------------- */

/** Liquid-glass panel with a cursor-tracking sheen. */
export const Glass = forwardRef<HTMLDivElement, HTMLMotionProps<"div"> & { strong?: boolean; refract?: boolean }>(
  function Glass({ className, strong, refract, onPointerMove, children, ...rest }, ref) {
    const move = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        onPointerMove?.(e);
      },
      [onPointerMove],
    );
    return (
      <motion.div
        ref={ref}
        onPointerMove={move}
        className={cn("glass glass-sheen", strong && "glass-strong", refract && "glass-refract", className)}
        {...rest}
      >
        <div className="relative z-[2] h-full">{children as ReactNode}</div>
      </motion.div>
    );
  },
);

/** Double-bezel: outer tray + inner glass core with concentric radii. */
export function Bezel({ className, coreClassName, children, ...rest }: HTMLMotionProps<"div"> & { coreClassName?: string }) {
  return (
    <motion.div className={cn("bezel", className)} {...rest}>
      <Glass className={cn("bezel-core h-full", coreClassName)}>{children as ReactNode}</Glass>
    </motion.div>
  );
}

/** Fade-up + de-blur as it enters the viewport. */
export function Reveal({ delay = 0, className, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.9, delay, ease: [0.32, 0.72, 0, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- iOS app icon ---------------- */

export type Tone = "blue" | "indigo" | "green" | "orange" | "pink" | "teal" | "red" | "gray";

export function AppIcon({ icon: I, tone = "blue", size = 52, className }: { icon: Icon; tone?: Tone; size?: number; className?: string }) {
  return (
    <span className={cn("app-icon", `tone-${tone}`, className)} style={{ ["--size" as string]: `${size}px` }}>
      <I size={Math.round(size * 0.52)} weight="regular" />
    </span>
  );
}

/** An iPhone home-screen style button: squircle icon + label underneath. */
export function AppButton({
  icon,
  tone,
  label,
  href,
  onClick,
  size = 60,
}: {
  icon: Icon;
  tone: Tone;
  label: string;
  href?: string;
  onClick?: () => void;
  size?: number;
}) {
  const inner = (
    <motion.span whileHover={{ y: -4, scale: 1.06 }} whileTap={{ scale: 0.9 }} transition={spring} className="flex flex-col items-center gap-2">
      <AppIcon icon={icon} tone={tone} size={size} />
      <span className="text-[11px] font-medium tracking-wide text-fg/80">{label}</span>
    </motion.span>
  );
  if (href?.startsWith("/api/"))
    return (
      <a href={href} target="_blank" rel="noreferrer" className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
        {inner}
      </a>
    );
  return href ? (
    <Link href={href} className="outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 rounded-2xl">
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 rounded-2xl">
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

/** Pill button with the trailing "button-in-button" icon well. */
export function Pill({ children, icon: I = ArrowUpRight, variant = "primary", href, external, busy, className, disabled, ...rest }: PillProps) {
  const cls = cn(
    "group relative inline-flex select-none items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-sm font-medium",
    "transition-[transform,background,box-shadow] duration-500 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" &&
      "bg-gradient-to-b from-btn-from to-btn-to text-btn-fg shadow-[0_10px_30px_-10px_var(--btn-glow),inset_0_1px_0_var(--btn-hi)] hover:shadow-[0_14px_40px_-10px_var(--btn-glow-hover),inset_0_1px_0_var(--btn-hi)]",
    variant === "glass" && "glass glass-refract text-fg hover:bg-ink/10",
    variant === "danger" && "bg-[#e11d2e]/15 text-danger shadow-[inset_0_0_0_1px_rgba(225,29,46,0.25)] hover:bg-[#e11d2e]/25",
    className,
  );
  const well = (
    <span
      className={cn(
        "relative z-[2] grid h-8 w-8 place-items-center rounded-full transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105",
        variant === "primary" ? "bg-btn-fg/10" : "bg-ink/10",
      )}
    >
      {busy ? <CircleNotch size={16} className="animate-spin" /> : <I size={16} weight="bold" />}
    </span>
  );
  const content = (
    <>
      <span className="relative z-[2]">{children}</span>
      {well}
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

/* ---------------- iOS segmented control ---------------- */

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
    <div role="tablist" className="glass inline-flex max-w-full overflow-x-auto rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-[2] whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-500 ease-spring",
            value === o.value ? "text-btn-fg" : "text-muted hover:text-fg",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              transition={spring}
              className="absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-btn-from to-btn-to shadow-[0_4px_14px_-4px_var(--btn-glow),inset_0_1px_0_var(--btn-hi)]"
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
  return (
    <span className="glass inline-flex rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
      <span className="relative z-[2]">{children}</span>
    </span>
  );
}

export const TYPE_VISUAL: Record<DocType, { icon: Icon; tone: Tone }> = {
  electricity_bill: { icon: Lightning, tone: "orange" },
  gst_certificate: { icon: Certificate, tone: "indigo" },
  bank_statement: { icon: Bank, tone: "teal" },
  invoice: { icon: Invoice, tone: "blue" },
  receipt: { icon: Receipt, tone: "pink" },
  id_card: { icon: IdentificationCard, tone: "green" },
  unknown: { icon: Question, tone: "gray" },
};

export function TypeIcon({ type, size = 44 }: { type: DocType; size?: number }) {
  const v = TYPE_VISUAL[type];
  return <AppIcon icon={v.icon} tone={v.tone} size={size} />;
}

const STATUS_VISUAL: Record<DocStatus, { I: Icon; cls: string; label: string; busy: boolean }> = {
  uploaded: { I: CircleNotch, cls: "text-info bg-sky-400/10", label: "Uploaded", busy: true },
  processing: { I: CircleNotch, cls: "text-info bg-sky-400/10", label: "Reading", busy: true },
  extracted: { I: CircleNotch, cls: "text-info bg-sky-400/10", label: "Extracted", busy: true },
  validation_pending: { I: CircleNotch, cls: "text-info bg-sky-400/10", label: "Validating", busy: true },
  verified: { I: SealCheck, cls: "text-ok bg-emerald-400/10", label: "Verified", busy: false },
  manual_review: { I: Eye, cls: "text-warn bg-amber-400/10", label: "Needs review", busy: false },
  failed: { I: WarningCircle, cls: "text-danger bg-rose-400/10", label: "Failed", busy: false },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const map = STATUS_VISUAL[status] ?? STATUS_VISUAL.failed;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", map.cls, map.busy && "pulse-ring")}>
      <map.I size={13} weight="bold" className={map.busy ? "animate-spin" : undefined} />
      {map.label}
    </span>
  );
}

/** Horizontal confidence bar (0–100). */
export function ConfidenceBar({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color =
    pct >= 80 ? "linear-gradient(90deg,#6ee7a0,#16a34a)"
    : pct >= 50 ? "linear-gradient(90deg,#ffcf6b,#ff7a00)"
    : "linear-gradient(90deg,#ff8a80,#e11d2e)";
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span>OCR confidence</span>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="conf-bar-track">
        <motion.div
          className="conf-bar-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
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

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Reveal className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
      <div className="space-y-4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-4xl font-semibold tracking-[-0.035em] text-fg md:text-6xl">{title}</h1>
        {subtitle && <p className="max-w-xl text-[15px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </Reveal>
  );
}

export function stop(e: MouseEvent) {
  e.stopPropagation();
}

"use client";

import { Lightning } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFetch, type Stats } from "@/lib/client";
import { ThemeToggle } from "./theme";
import { cn, spring } from "./ui";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/scan", label: "Upload" },
  { href: "/documents", label: "Documents" },
  { href: "/reports", label: "Reports" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Nav() {
  const path = usePathname();
  const { data: stats } = useFetch<Stats>("/api/stats");
  const review = stats?.byStatus.manual_review ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-[var(--header-bg)] backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-fg">
            <Lightning size={16} weight="fill" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">KiloWattX</span>
            <span className="hidden text-[11px] text-muted sm:block">Document verification</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} {...l} active={isActive(path, l.href)} badge={l.href === "/documents" ? review : 0} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {review > 0 && (
            <Link
              href="/documents?status=manual_review"
              className="hidden items-center gap-1.5 rounded-md bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn transition-opacity hover:opacity-80 sm:inline-flex"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-warn" />
              {review} awaiting review
            </Link>
          )}
          <ThemeToggle id="desktop" />
        </div>
      </div>

      {/* Mobile tabs */}
      <nav aria-label="Main" className="flex h-11 items-stretch gap-1 overflow-x-auto border-t border-hair px-2 md:hidden">
        {LINKS.map((l) => (
          <NavLink key={l.href} {...l} active={isActive(path, l.href)} badge={l.href === "/documents" ? review : 0} mobile />
        ))}
      </nav>
    </header>
  );
}

function NavLink({ href, label, active, badge, mobile }: { href: string; label: string; active: boolean; badge: number; mobile?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
      {badge > 0 && <span className="rounded bg-warn-soft px-1.5 text-[11px] font-semibold tabular text-warn">{badge}</span>}
      {active && (
        <motion.span
          layoutId={mobile ? "nav-underline-m" : "nav-underline"}
          transition={spring}
          className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
        />
      )}
    </Link>
  );
}

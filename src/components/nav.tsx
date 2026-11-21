"use client";

import { ChartPieSlice, Files, Scan, SquaresFour, type Icon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme";
import { AppIcon, cn, spring, type Tone } from "./ui";

const LINKS: { href: string; label: string; icon: Icon; tone: Tone }[] = [
  { href: "/", label: "Home", icon: SquaresFour, tone: "indigo" },
  { href: "/scan", label: "Scan", icon: Scan, tone: "blue" },
  { href: "/documents", label: "Documents", icon: Files, tone: "teal" },
  { href: "/reports", label: "Reports", icon: ChartPieSlice, tone: "pink" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Floating glass island on desktop; iOS-style dock on mobile. */
export function Nav() {
  const path = usePathname();
  return (
    <>
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className="fixed inset-x-0 top-5 z-30 mx-auto hidden w-max md:block"
      >
        <div className="glass glass-refract flex items-center gap-1 rounded-full p-1.5 pl-4">
          <Link href="/" className="relative z-[2] mr-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-gradient-to-br from-[#5ac8fa] to-[#4b3ce0] text-[11px] font-bold text-white">D</span>
            DocScan
          </Link>
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative z-[2] rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-500 ease-spring",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {active && (
                  <motion.span layoutId="nav-pill" transition={spring} className="glass-pill absolute inset-0 -z-10 rounded-full" />
                )}
                {l.label}
              </Link>
            );
          })}
          <span aria-hidden className="relative z-[2] mx-1.5 h-5 w-px bg-ink/15" />
          <ThemeToggle id="desktop" />
        </div>
      </motion.nav>

      {/* Mobile: theme switch floats top-right */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.2 }}
        className="fixed right-4 top-4 z-30 md:hidden"
        style={{ marginTop: "env(safe-area-inset-top)" }}
      >
        <div className="glass glass-refract rounded-full p-1">
          <ThemeToggle id="mobile" />
        </div>
      </motion.div>

      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.15 }}
        className="fixed inset-x-4 bottom-4 z-30 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="glass glass-refract flex justify-around rounded-[28px] px-2 py-2.5">
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
            return (
              <Link key={l.href} href={l.href} className="relative z-[2] flex flex-col items-center gap-1">
                <motion.span whileTap={{ scale: 0.86 }} transition={spring} animate={{ y: active ? -2 : 0 }}>
                  <AppIcon icon={l.icon} tone={l.tone} size={42} className={active ? "" : "opacity-60 saturate-50"} />
                </motion.span>
                <span className={cn("text-[10px] font-medium", active ? "text-fg" : "text-faint")}>{l.label}</span>
              </Link>
            );
          })}
        </div>
      </motion.nav>
    </>
  );
}

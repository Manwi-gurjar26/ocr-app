"use client";

import { Desktop, Moon, Sun, type Icon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY as KEY } from "@/lib/theme-script";
import { cn, spring } from "./ui";

export type ThemePref = "light" | "dark" | "system";

const EVENT = "docscan-theme";

function readPref(): ThemePref {
  try {
    const p = localStorage.getItem(KEY);
    return p === "light" || p === "dark" ? p : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(pref: ThemePref) {
  const d = document.documentElement;
  d.setAttribute("data-theme", resolve(pref));
  d.setAttribute("data-theme-pref", pref);
  const color = resolve(pref) === "light" ? "#eef1f7" : "#05060a";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
  const run = () => apply(pref);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reduced) doc.startViewTransition(run);
  else run();
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => "system");
}

const OPTIONS: { value: ThemePref; label: string; icon: Icon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Desktop },
];

/** Three-way glass switch: Light · Dark · System. */
export function ThemeToggle({ className, id = "theme" }: { className?: string; id?: string }) {
  const pref = useThemePref();

  // Follow the OS while on "system"; re-sync if another tab changed it.
  useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return (
    <div role="radiogroup" aria-label="Color theme" className={cn("relative z-[2] flex items-center gap-0.5 rounded-full", className)}>
      {OPTIONS.map(({ value, label, icon: I }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setThemePref(value)}
            className={cn(
              "relative grid h-8 w-8 place-items-center rounded-full outline-none transition-colors duration-500 ease-spring focus-visible:ring-2 focus-visible:ring-sky-400/60",
              active ? "text-fg" : "text-faint hover:text-fg",
            )}
          >
            {active && <motion.span layoutId={`theme-pill-${id}`} transition={spring} className="glass-pill absolute inset-0 -z-10 rounded-full" />}
            <motion.span whileTap={{ scale: 0.82, rotate: value === "light" ? 45 : value === "dark" ? -20 : 0 }} transition={spring}>
              <I size={16} weight={active ? "fill" : "regular"} />
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}

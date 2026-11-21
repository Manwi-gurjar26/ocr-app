"use client";

import { useEffect } from "react";

/** Fixed mesh-gradient orbs + film grain behind everything. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div className="orb orb-a left-[-10vw] top-[-15vh] h-[60vh] w-[60vh] bg-[#0a5cff]/40" />
      <div className="orb orb-b right-[-12vw] top-[10vh] h-[55vh] w-[55vh] bg-[#7c3aed]/35" />
      <div className="orb orb-c bottom-[-20vh] left-[25vw] h-[60vh] w-[70vh] bg-[#0e9fa0]/25" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(5,6,10,0.6)_70%)]" />
      <div className="grain" />
    </div>
  );
}

/**
 * SVG displacement map used by `.glass-refract` to bend the backdrop like a lens.
 * Only Chromium supports SVG filters in backdrop-filter, so we opt in there.
 */
export function LiquidGlassFilter() {
  useEffect(() => {
    const isChromium = typeof window !== "undefined" && "chrome" in window && !/Firefox/.test(navigator.userAgent);
    if (isChromium) document.documentElement.dataset.refract = "";
  }, []);
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="liquid-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

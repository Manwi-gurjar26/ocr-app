"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

/* Local helper: importing cn from ./ui would create an import cycle (ui.tsx renders SolarScene),
   which breaks Fast Refresh and makes the dev server reload the page in a loop. */
function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Solar scene */

interface Panel {
  pts: string;
  leg: [number, number, number, number];
}

/** Rows of tilted solar panels, back (small) to front (large). */
function buildPanels(): Panel[] {
  const out: Panel[] = [];
  const rows = [
    { s: 0.5, y: 236, x0: 420 },
    { s: 0.68, y: 262, x0: 360 },
    { s: 0.88, y: 294, x0: 290 },
    { s: 1.12, y: 336, x0: 210 },
  ];
  for (const r of rows) {
    const w = 52 * r.s;
    const h = 22 * r.s;
    const skew = 12 * r.s;
    const gap = 7 * r.s;
    for (let x = r.x0; x < 1260; x += w + gap) {
      out.push({
        pts: `${x},${r.y} ${x + w},${r.y} ${x + w + skew},${r.y - h} ${x + skew},${r.y - h}`,
        leg: [x + w / 2, r.y, x + w / 2, r.y + 7 * r.s],
      });
    }
  }
  return out;
}
const PANELS = buildPanels();

function Tower({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  // Lattice transmission tower silhouette.
  const h = 120 * s;
  const w = 30 * s;
  const top = y - h;
  return (
    <g className="scene-tower" strokeWidth={1.4} fill="none">
      <path d={`M${x - w / 2},${y} L${x - 4 * s},${top} L${x + 4 * s},${top} L${x + w / 2},${y}`} />
      <path d={`M${x - w / 2 + 3 * s},${y - h * 0.25} L${x + w / 2 - 3 * s},${y - h * 0.25} M${x - w / 2 + 7 * s},${y - h * 0.55} L${x + w / 2 - 7 * s},${y - h * 0.55}`} />
      <path d={`M${x - w / 2},${y} L${x + w / 2 - 3 * s},${y - h * 0.25} M${x + w / 2},${y} L${x - w / 2 + 3 * s},${y - h * 0.25}`} />
      <path d={`M${x - 26 * s},${top + 14 * s} L${x + 26 * s},${top + 14 * s} M${x - 18 * s},${top + 30 * s} L${x + 18 * s},${top + 30 * s}`} />
    </g>
  );
}

/**
 * Illustrated solar farm at dawn (pure SVG, themed via CSS variables).
 * `hero` = full detail with animation; `strip` = calmer variant for page headers.
 */
export function SolarScene({ variant = "hero", className }: { variant?: "hero" | "strip"; className?: string }) {
  const reduce = useReducedMotion();
  const animate = !reduce;
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const line = "M640,128 C760,162 860,166 960,140 C1040,120 1110,124 1200,140";

  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 360"
      preserveAspectRatio="xMaxYMid slice"
      className={cn("scene", className)}
    >
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset="1" stopColor="var(--sky-bot)" />
        </linearGradient>
        <radialGradient id={id("glow")}>
          <stop offset="0" stopColor="var(--sun)" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="var(--sun)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("panel")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--panel-a)" />
          <stop offset="1" stopColor="var(--panel-b)" />
        </linearGradient>
        <pattern id={id("cells")} width="7" height="6" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
          <path d="M7,0 L0,0 0,6" fill="none" stroke="var(--panel-cell)" strokeWidth="0.7" />
        </pattern>
        <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("hill-far")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hill-far)" />
          <stop offset="1" stopColor="var(--ground)" />
        </linearGradient>
        <clipPath id={id("panels")}>
          {PANELS.map((p, i) => (
            <polygon key={i} points={p.pts} />
          ))}
        </clipPath>
      </defs>

      <rect width="1200" height="360" fill={`url(#${id("sky")})`} />

      {/* Sun */}
      <g transform="translate(980 118)">
        <circle r="170" fill={`url(#${id("glow")})`} className={animate ? "scene-glow" : undefined} />
        <circle r="30" fill="var(--sun)" opacity="0.95" />
      </g>

      {/* Clouds */}
      <g fill="var(--cloud)">
        <g>
          {animate && <animateTransform attributeName="transform" type="translate" values="0 0; 40 0; 0 0" dur="38s" repeatCount="indefinite" />}
          <ellipse cx="720" cy="70" rx="70" ry="12" />
          <ellipse cx="760" cy="62" rx="40" ry="12" />
        </g>
        <g>
          {animate && <animateTransform attributeName="transform" type="translate" values="0 0; -30 0; 0 0" dur="46s" repeatCount="indefinite" />}
          <ellipse cx="1080" cy="46" rx="56" ry="9" />
          <ellipse cx="1110" cy="40" rx="30" ry="9" />
        </g>
      </g>

      {/* Hills */}
      <path d="M0,214 C160,176 300,196 460,182 C620,168 760,150 900,170 C1020,186 1110,160 1200,168 L1200,360 L0,360 Z" fill={`url(#${id("hill-far")})`} />
      <path d="M0,246 C200,222 380,236 560,226 C760,214 940,206 1200,220 L1200,360 L0,360 Z" fill="var(--hill-near)" />

      {/* Transmission line with energy pulses */}
      {variant === "hero" && (
        <g>
          <Tower x={640} y={250} s={0.95} />
          <Tower x={960} y={232} s={0.8} />
          <path d={line} fill="none" stroke="var(--wire)" strokeWidth="1.2" />
          <path d={line} fill="none" stroke="var(--sun)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 22" opacity="0.9">
            {animate && <animate attributeName="stroke-dashoffset" from="0" to="-240" dur="3.2s" repeatCount="indefinite" />}
          </path>
        </g>
      )}

      {/* Panels */}
      <g>
        {PANELS.map((p, i) => (
          <line key={i} x1={p.leg[0]} y1={p.leg[1]} x2={p.leg[2]} y2={p.leg[3]} stroke="var(--panel-leg)" strokeWidth="1.2" />
        ))}
        {PANELS.map((p, i) => (
          <polygon key={i} points={p.pts} fill={`url(#${id("panel")})`} stroke="var(--panel-frame)" strokeWidth="0.9" />
        ))}
        {PANELS.map((p, i) => (
          <polygon key={i} points={p.pts} fill={`url(#${id("cells")})`} />
        ))}
      </g>

      {/* Light sweeping across the panels */}
      {animate && (
        <g clipPath={`url(#${id("panels")})`}>
          <g transform="skewX(-22)">
            <rect x="0" y="0" width="150" height="360" fill={`url(#${id("sheen")})`}>
              <animate attributeName="x" values="-200;1500" dur={variant === "hero" ? "6.5s" : "9s"} repeatCount="indefinite" />
            </rect>
          </g>
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ Solar System animation */

/**
 * Point on a circle, rounded to 2 decimals. Node and the browser can differ in the last digit of
 * Math.sin/cos, and an unrounded value makes the SSR attribute mismatch the client (hydration error).
 */
const polar = (angle: number, radius: number) => {
  const a = (angle * Math.PI) / 180;
  return [Math.round(Math.cos(a) * radius * 100) / 100, Math.round(Math.sin(a) * radius * 100) / 100] as const;
};

/** Asteroid belt dots. */
const ASTEROID_BELT = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((angle) => {
  const [cx, cy] = polar(angle, 122);
  return { angle, cx, cy };
});

/** Sun corona ray endpoints. */
const CORONA_RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
  const [x1, y1] = polar(angle, 25);
  const [x2, y2] = polar(angle, 34);
  return { angle, x1, y1, x2, y2 };
});
export function SolarSystem({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `ss-${n}-${uid}`;

  const planets = [
    { r: 68, size: 7, color: "#84a4f0", dur: "9s", offset: "0deg", label: "Mercury" },
    { r: 102, size: 10, color: "#47cd89", dur: "15s", offset: "120deg", label: "Venus" },
    { r: 142, size: 9, color: "#f0a94a", dur: "24s", offset: "240deg", label: "Earth" },
    { r: 185, size: 7, color: "#f17fae", dur: "38s", offset: "60deg", label: "Mars" },
  ];

  return (
    <svg
      aria-hidden
      viewBox="-220 -220 440 440"
      className={cn("overflow-visible", className)}
    >
      <defs>
        {/* Sun glow */}
        <radialGradient id={id("sun-glow")}>
          <stop offset="0%" stopColor="#f5b951" stopOpacity="1" />
          <stop offset="40%" stopColor="#f5b951" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f5b951" stopOpacity="0" />
        </radialGradient>
        {/* Sun surface */}
        <radialGradient id={id("sun")} cx="35%" cy="35%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="60%" stopColor="#f5b951" />
          <stop offset="100%" stopColor="#e08020" />
        </radialGradient>
        {/* Orbit ring gradient */}
        <linearGradient id={id("ring")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="30%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        {/* Glow filter for planets */}
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id("sun-filter")} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Orbit rings */}
      {planets.map((p) => (
        <circle
          key={`orbit-${p.r}`}
          r={p.r}
          cx="0" cy="0"
          fill="none"
          stroke={p.color}
          strokeWidth="0.6"
          strokeOpacity="0.18"
          strokeDasharray="4 6"
        />
      ))}

      {/* Sun glow halo */}
      <circle r="52" cx="0" cy="0" fill={`url(#${id("sun-glow")})`} className={reduce ? undefined : "scene-glow"} />
      {/* Sun body */}
      <circle r="22" cx="0" cy="0" fill={`url(#${id("sun")})`} filter={`url(#${id("sun-filter")})`} />
      {/* Sun corona rays */}
      {CORONA_RAYS.map(({ angle, x1, y1, x2, y2 }) => (
        <line
          key={angle}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#f5b951"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.65"
          className={reduce ? undefined : "scene-glow"}
        />
      ))}

      {/* Planets */}
      {planets.map((p) => (
        <g key={p.r} filter={`url(#${id("glow")})`}>
          {/* Pre-rotate so each planet starts at a different point on its orbit */}
          <g transform={`rotate(${p.offset.replace("deg", "")})`}>
            {/* Orbit container — rotates the planet around center */}
            <g style={{ transformOrigin: "0 0 0" }}>
              {!reduce && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0`}
                  to={`360`}
                  dur={p.dur}
                  repeatCount="indefinite"
                />
              )}
              {/* Planet dot at (r, 0) relative to center */}
              <circle
                cx={p.r}
                cy="0"
                r={p.size / 2}
                fill={p.color}
                opacity="0.9"
              />
              {/* Small halo */}
              <circle
                cx={p.r}
                cy="0"
                r={p.size / 2 + 1.5}
                fill={p.color}
                opacity="0.15"
              />
            </g>
          </g>
        </g>
      ))}

      {/* Asteroid belt between orbit 2 and 3 */}
      {!reduce && ASTEROID_BELT.map(({ angle, cx, cy }) => (
        <circle
          key={angle}
          cx={cx}
          cy={cy}
          r="1.2"
          fill="#9aa1ab"
          opacity="0.35"
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ Particle field */

/** Twinkling star field — 60 random stars that fade in and out. */
export function StarField({ className, count = 60 }: { className?: string; count?: number }) {
  const reduce = useReducedMotion();
  // Deterministic random using index as seed (avoids hydration mismatch)
  const stars = Array.from({ length: count }, (_, i) => {
    const seed = (i * 2654435761) >>> 0;
    const x = ((seed * 1664525 + 1013904223) >>> 0) % 1000;
    const y = ((seed * 22695477 + 1) >>> 0) % 500;
    const r = 0.5 + (seed % 10) / 10;
    const dur = 2.5 + (seed % 30) / 10;
    const delay = (seed % 40) / 10;
    return { x, y, r, dur, delay };
  });

  return (
    <svg aria-hidden viewBox="0 0 1000 500" className={cn("overflow-visible", className)}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="currentColor">
          {!reduce && (
            <animate
              attributeName="opacity"
              values="0.1;0.8;0.1"
              dur={`${s.dur}s`}
              begin={`${s.delay}s`}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ Rooftop solar → verified bill */

const SUN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const [x1, y1] = polar(i * 30, 34);
  const [x2, y2] = polar(i * 30, 46);
  return { i, x1, y1, x2, y2 };
});

/** Flat factory roof seen slightly from above: front edge y=190, depth vector (34,-30). */
const ROOF = { x: 140, y: 190, w: 380, dx: 34, dy: -30 };
const roofPt = (u: number, v: number) => `${ROOF.x + ROOF.w * u + ROOF.dx * v},${ROOF.y + ROOF.dy * v}`;
/** 3 rows x 9 columns of panels laid out on the roof plane. */
const ROOF_PANELS = [0, 1, 2].flatMap((r) =>
  Array.from({ length: 9 }, (_, c) => {
    const u0 = 0.03 + c * 0.107;
    const u1 = u0 + 0.094;
    const v0 = 0.1 + r * 0.29;
    const v1 = v0 + 0.24;
    return { key: `${r}-${c}`, pts: [roofPt(u0, v0), roofPt(u1, v0), roofPt(u1, v1), roofPt(u0, v1)].join(" ") };
  }),
);

/**
 * A factory with rooftop solar feeding a meter, and the electricity bill being verified.
 * Fills its container (preserveAspectRatio slice).
 */
export function RooftopScene({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const animate = !reduce;
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `rt-${n}-${uid}`;
  const cable = "M548,168 C590,168 596,206 616,214 L640,214";
  const toBill = "M690,232 C716,236 724,212 744,206";

  return (
    <svg
      aria-hidden
      viewBox="0 0 860 340"
      preserveAspectRatio="xMidYMax meet"
      overflow="visible"
      className={cn("scene", className)}
    >
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset="1" stopColor="var(--sky-bot)" />
        </linearGradient>
        <radialGradient id={id("glow")}>
          <stop offset="0" stopColor="var(--sun)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("panel")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--panel-a)" />
          <stop offset="1" stopColor="var(--panel-b)" />
        </linearGradient>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--surface-2)" />
        </linearGradient>
        <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id("panels")}>
          {ROOF_PANELS.map((p) => (
            <polygon key={p.key} points={p.pts} />
          ))}
        </clipPath>
      </defs>

      <rect x="-600" y="-700" width="2060" height="1040" fill={`url(#${id("sky")})`} />

      {/* Sun with slowly turning rays */}
      <g transform="translate(690 82)">
        <circle r="110" fill={`url(#${id("glow")})`} />
        <g className={animate ? "spin-slow" : undefined}>
          {SUN_RAYS.map((r) => (
            <line key={r.i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="var(--sun)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          ))}
        </g>
        <circle r="26" fill="var(--sun)" />
      </g>

      {/* Clouds */}
      <g fill="var(--cloud)">
        {animate && <animateTransform attributeName="transform" type="translate" values="0 0; 36 0; 0 0" dur="30s" repeatCount="indefinite" />}
        <ellipse cx="200" cy="60" rx="60" ry="11" />
        <ellipse cx="236" cy="52" rx="34" ry="11" />
      </g>

      {/* Ground */}
      <path d="M-600,262 L0,262 C220,248 520,250 860,258 L1460,258 L1460,700 L-600,700 Z" fill="var(--hill-near)" />
      <rect x="-600" y="292" width="2060" height="400" fill="var(--ground)" />

      {/* Factory */}
      <g>
        <rect x="140" y="190" width="380" height="96" fill={`url(#${id("wall")})`} stroke="var(--hair-strong)" />
        {/* flat roof (top face) + right side face */}
        <polygon points={`${roofPt(0, 0)} ${roofPt(1, 0)} ${roofPt(1, 1)} ${roofPt(0, 1)}`} fill="var(--surface-2)" stroke="var(--hair-strong)" strokeLinejoin="round" />
        <polygon points={`${roofPt(1, 0)} ${roofPt(1, 1)} 554,256 520,286`} fill="var(--hair)" stroke="var(--hair-strong)" strokeLinejoin="round" />
        {/* windows */}
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <rect key={c} x={162 + c * 50} y="208" width="30" height="20" rx="2" fill="var(--panel-b)" opacity="0.22" />
        ))}
        <rect x="300" y="244" width="44" height="42" rx="2" fill="var(--hair-strong)" />
        <rect x="566" y="238" width="36" height="48" rx="3" fill={`url(#${id("wall")})`} stroke="var(--hair-strong)" />
      </g>

      {/* Rooftop panels + light sweep */}
      <g>
        {ROOF_PANELS.map((p) => (
          <polygon key={p.key} points={p.pts} fill={`url(#${id("panel")})`} stroke="var(--panel-frame)" strokeWidth="0.8" />
        ))}
      </g>
      {animate && (
        <g clipPath={`url(#${id("panels")})`}>
          <rect x="0" y="150" width="70" height="50" fill={`url(#${id("sheen")})`} transform="skewX(-25)">
            <animate attributeName="x" values="160;700" dur="4.8s" repeatCount="indefinite" />
          </rect>
        </g>
      )}

      {/* Cable from roof to meter, with energy pulses */}
      <path d={cable} fill="none" stroke="var(--wire)" strokeWidth="2" />
      <path d={cable} fill="none" stroke="var(--sun)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 14">
        {animate && <animate attributeName="stroke-dashoffset" from="0" to="-160" dur="2.4s" repeatCount="indefinite" />}
      </path>

      {/* Meter with live bars */}
      <g transform="translate(640 192)">
        <rect width="50" height="62" rx="6" fill="var(--surface)" stroke="var(--hair-strong)" strokeWidth="1.5" />
        <rect x="8" y="8" width="34" height="14" rx="2" fill="var(--panel-a)" />
        {[0, 1, 2, 3].map((b) => (
          <rect key={b} x={10 + b * 8} y="30" width="5" height="22" rx="1.5" fill="var(--accent)" opacity="0.8">
            {animate && (
              <animate
                attributeName="height"
                values={["8;22;12;18;8", "18;10;22;8;18", "12;20;8;22;12", "22;12;18;10;22"][b]}
                dur="1.6s"
                repeatCount="indefinite"
              />
            )}
            {animate && (
              <animate
                attributeName="y"
                values={["44;30;40;34;44", "34;42;30;44;34", "40;32;44;30;40", "30;40;34;42;30"][b]}
                dur="1.6s"
                repeatCount="indefinite"
              />
            )}
          </rect>
        ))}
      </g>

      {/* Data line from meter to the bill */}
      <path d={toBill} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.7">
        {animate && <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="1.2s" repeatCount="indefinite" />}
      </path>

      {/* Electricity bill being verified */}
      <g transform="translate(744 168)">
        <g>
          {animate && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="4s" repeatCount="indefinite" />}
          <rect width="76" height="96" rx="6" fill="var(--surface)" stroke="var(--hair-strong)" strokeWidth="1.5" />
          <rect x="10" y="10" width="24" height="8" rx="2" fill="var(--sun)" />
          <g stroke="var(--hair-strong)" strokeWidth="3" strokeLinecap="round">
            <line x1="10" y1="32" x2="62" y2="32" />
            <line x1="10" y1="44" x2="54" y2="44" />
            <line x1="10" y1="56" x2="64" y2="56" />
            <line x1="10" y1="68" x2="40" y2="68" />
          </g>
          <g transform="translate(62 82)">
            <circle r="15" fill="var(--ok)" className={animate ? "pulse-soft" : undefined} />
            <path d="M-6,0 L-2,4 L6,-5" fill="none" stroke="var(--surface)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** A document with a scan beam passing over it — used in the upload drop zone. */
export function ScanArt({ active, className }: { active?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg aria-hidden viewBox="0 0 120 120" className={cn("scan-art", active && "is-active", className)}>
      <rect x="28" y="14" width="64" height="86" rx="6" fill="var(--surface)" stroke="var(--hair-strong)" strokeWidth="1.5" />
      <path d="M78,14 L92,28 L78,28 Z" fill="var(--surface-2)" stroke="var(--hair-strong)" strokeWidth="1.2" strokeLinejoin="round" />
      <g stroke="var(--hair-strong)" strokeWidth="3" strokeLinecap="round">
        <line x1="38" y1="40" x2="72" y2="40" />
        <line x1="38" y1="50" x2="82" y2="50" />
        <line x1="38" y1="60" x2="64" y2="60" />
        <line x1="38" y1="70" x2="80" y2="70" />
        <line x1="38" y1="80" x2="58" y2="80" />
      </g>
      <rect x="38" y="24" width="18" height="8" rx="2" fill="var(--accent)" opacity="0.85" />
      {/* corner brackets */}
      <g stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M18,22 V12 H28" />
        <path d="M92,12 H102 V22" />
        <path d="M18,92 V102 H28" />
        <path d="M92,102 H102 V92" />
      </g>
      <g>
        {!reduce && <animateTransform attributeName="transform" type="translate" values="0 0; 0 74; 0 0" dur="2.8s" repeatCount="indefinite" />}
        <rect x="20" y="18" width="80" height="10" fill="var(--accent)" opacity="0.12" />
        <line x1="20" y1="28" x2="100" y2="28" stroke="var(--accent)" strokeWidth="2" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ Count-up number */

/** Animates from the previous value to `value` with an ease-out curve. */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);
  return <span className={className}>{(reduce ? value : shown).toLocaleString("en-IN")}</span>;
}

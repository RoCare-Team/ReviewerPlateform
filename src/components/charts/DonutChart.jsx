"use client";

import { useState } from "react";

/**
 * Shared donut chart: pure SVG, no charting library in this repo. Stroke-dasharray
 * segments on one circle, with a small surface-colored gap between slices so they
 * read as distinct wedges rather than one ring.
 *
 * Ring on top, legend as a CENTERED, WRAPPING row of chips below — not a
 * side-by-side ring+list. A side-by-side layout looks fine in a wide card but
 * turns lopsided (big ring, cramped left-aligned list, dead space on the
 * right) the moment the card gets narrow, e.g. three of these in a
 * `lg:grid-cols-3` row. A centered wrap has no "too narrow" failure mode —
 * chips just reflow — so one layout works at every card width without
 * container queries or breakpoint juggling.
 */
export default function DonutChart({ segments, centerLabel, size = 160, thickness = 18 }) {
  const [hovered, setHovered] = useState(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 ? 3 : 0;
  const cx = size / 2;
  const cy = size / 2;

  const visible = segments.filter((s) => s.value > 0);
  const arcs = visible.reduce((acc, s) => {
    const priorOffset = acc.offset;
    const length = total > 0 ? (s.value / total) * circumference : 0;
    acc.list.push({
      ...s,
      dasharray: `${Math.max(length - gap, 0)} ${circumference - Math.max(length - gap, 0)}`,
      dashoffset: -priorOffset,
    });
    acc.offset += length;
    return acc;
  }, { list: [], offset: 0 }).list;

  const centerValue = hovered ? hovered.value : total;
  const centerText = hovered
    ? `${hovered.label} · ${total > 0 ? Math.round((hovered.value / total) * 100) : 0}%`
    : centerLabel;

  return (
    <div className="flex flex-col items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${centerLabel}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
          className="max-w-full"
        >
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={hovered?.label === a.label ? thickness + 4 : thickness}
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={hovered && hovered.label !== a.label ? 0.45 : 1}
              className="cursor-pointer outline-none"
              style={{ transition: "stroke-dasharray 300ms ease, stroke-width 150ms ease, opacity 150ms ease" }}
              tabIndex={0}
              onMouseEnter={() => setHovered(a)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(a)}
              onBlur={() => setHovered(null)}
            >
              <title>{`${a.label}: ${a.value} (${total > 0 ? Math.round((a.value / total) * 100) : 0}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <span className="nums text-2xl font-bold tracking-tight text-primary">{centerValue}</span>
          <span className="truncate text-xs text-muted">{centerText}</span>
        </div>
      </div>

      {/* Legend chips — the accessible "table view", every value printed, never color-only */}
      <ul className="mt-5 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {segments.map((s) => (
          <li
            key={s.label}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            className={`flex items-center gap-1.5 rounded-btn px-1.5 py-0.5 text-sm transition-colors duration-150 ${
              hovered?.label === s.label ? "bg-surface-sunken" : ""
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            <span className="text-secondary">{s.label}</span>
            <span className="nums font-semibold text-primary">
              {s.value}
              <span className="ml-1 font-normal text-muted">
                ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

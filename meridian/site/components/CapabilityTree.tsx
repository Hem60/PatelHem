"use client";

/**
 * The Capability Tree — plate 06.
 *
 * Columnar, matched to the reference build: stages left to right, boxed
 * capabilities with a coloured marker, a coverage number and a segmented bar,
 * joined by orthogonal connectors.
 *
 * The difference is underneath. His columns are an authored taxonomy and his
 * numbers are typed. These columns are depth in a graph computed from the
 * catalogue — an edge from A to B means every repository evidencing B also
 * evidences A — and the number on each box is the share of the account that
 * demonstrates it. Hovering lights the whole chain, back to what it rests on
 * and forward to what it supports.
 */
import { useMemo, useState } from "react";
import { TREE_BOX, ancestors, descendants, tree } from "@/lib/evidence";
import type { Catalogue } from "@/lib/catalogue";
import { OWNER } from "@/lib/owner";
import { Observed } from "./Calibration";
import { Plate, SectionHead } from "./Plate";

export function CapabilityTree({ cat }: { cat: Catalogue }) {
  const layout = useMemo(() => tree(cat), [cat]);
  const [active, setActive] = useState<string | null>(null);

  const lit = useMemo(() => {
    if (!active) return null;
    const set = new Set<string>([active]);
    for (const id of ancestors(layout.edges, active)) set.add(id);
    for (const id of descendants(layout.edges, active)) set.add(id);
    return set;
  }, [active, layout.edges]);

  const isLit = (id: string) => !lit || lit.has(id);
  const selected = layout.nodes.find((n) => n.id === active) ?? null;

  return (
    <Observed id="constellation" className="shell">
      <SectionHead plate="06" title="Capability tree" note="Computed from evidence" />

      <div className="spread mb-6">
        <p className="t-body lg:col-span-8 lg:pr-10">
          Every box is a capability some repository actually evidences, and every connector is a
          containment relation computed from that evidence: an edge from A to B means B has never
          appeared in this account without A. Nothing here is an authored dependency taxonomy — if
          the evidence stops supporting a link, the next observing run stops drawing it.
        </p>
        <div className="lg:col-span-4">
          <Plate className="p-4" raised>
            <div className="header-rule mb-2">
              <span className="t-pixel" style={{ color: "var(--oxide)" }}>
                {selected ? selected.label : "Node"}
              </span>
              {selected ? (
                <span className="label">
                  {selected.repos.length}/{cat.entries.length}
                </span>
              ) : null}
            </div>
            {selected ? (
              <>
                <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-soft)" }}>
                  {selected.gloss}
                </p>
                <ul className="mt-2">
                  {selected.evidence.map((e) => (
                    <li key={`${e.repo}-${e.text}`} className="margin-note">
                      <a href={e.href} rel="noreferrer noopener" target="_blank" style={{ color: "var(--oxide)" }}>
                        {e.repo} ↗
                      </a>{" "}
                      {e.text}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-faint)" }}>
                Hover or tab to a box. Its evidence — which repositories demonstrate it, and the
                sentence the survey wrote — appears here, linked to the code.
              </p>
            )}
          </Plate>
        </div>
      </div>

      {/*
        * The chart gets a framed grid box, and it is the only grid left on the
        * page besides the hero's. The page-wide graticule was removed because
        * grid paper under prose is noise — but this is a chart with positions
        * that mean something, and a chart is exactly what grid paper is for.
        */}
      <div className="tree-box">
        <div className="tree-box__bar">
          <span>
            {layout.nodes.length} capabilities · {layout.columns.length} stages · computed
          </span>
          <span className="tree-box__hint">Drag sideways to follow the branches →</span>
        </div>

        <div className="tree-box__field">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ width: "100%", minWidth: `${layout.width}px` }}
          role="img"
          aria-label={`Capability tree: ${layout.nodes.length} capabilities across ${layout.columns.length} stages, computed from ${cat.entries.length} repositories.`}
          onMouseLeave={() => setActive(null)}
        >
          {/* column headings: number in the accent, label in ink, ruled under */}
          {layout.columns.map((c) => (
            <g key={c.index}>
              <text
                x={c.x}
                y={14}
                fontFamily="var(--f-micro)"
                fontSize="10"
                letterSpacing="2.5"
                fill="var(--oxide)"
              >
                {String(c.index + 1).padStart(2, "0")}
              </text>
              <text
                x={c.x + 26}
                y={14}
                fontFamily="var(--f-micro)"
                fontSize="10"
                letterSpacing="2.5"
                fill="var(--ink-soft)"
              >
                {c.label.toUpperCase()}
              </text>
              <line
                x1={c.x}
                y1={26}
                x2={c.x + (layout.nodes[0]?.w ?? 200)}
                y2={26}
                stroke="var(--rule)"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* connectors */}
          {layout.edges.map((e) => {
            const on = isLit(e.from) && isLit(e.to);
            return (
              <path
                key={`${e.from}->${e.to}`}
                d={e.path}
                fill="none"
                stroke={on && lit ? "var(--oxide)" : "var(--rule-strong)"}
                strokeWidth={on && lit ? 1.5 : 1}
                opacity={on ? (lit ? 1 : 0.45) : 0.1}
                style={{ transition: "opacity var(--dur) linear, stroke var(--dur) linear" }}
              />
            );
          })}

          {/* the boxes */}
          {layout.nodes.map((n) => {
            const on = isLit(n.id);
            const hue = `var(${n.hue})`;
            return (
              <g
                key={n.id}
                tabIndex={0}
                role="button"
                aria-label={`${n.label}: evidenced by ${n.repos.length} of ${cat.entries.length} repositories — ${n.repos.join(", ")}`}
                onMouseEnter={() => setActive(n.id)}
                onFocus={() => setActive(n.id)}
                onBlur={() => setActive(null)}
                style={{
                  cursor: "pointer",
                  opacity: on ? 1 : 0.25,
                  transition: "opacity var(--dur) linear",
                }}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  fill="var(--paper-raised)"
                  stroke={active === n.id ? hue : "var(--rule-strong)"}
                  strokeWidth={active === n.id ? 2 : 1}
                />

                {/* marker square, name, and the reading hard right */}
                <rect
                  x={n.x + TREE_BOX.pad}
                  y={n.y + TREE_BOX.labelY - TREE_BOX.markerSize}
                  width={TREE_BOX.markerSize}
                  height={TREE_BOX.markerSize}
                  fill={hue}
                />
                <text
                  x={n.x + TREE_BOX.pad + TREE_BOX.markerSize + 10}
                  y={n.y + TREE_BOX.labelY}
                  fontFamily="var(--f-display)"
                  fontSize="14"
                  letterSpacing="0.5"
                  fill="var(--ink)"
                >
                  {n.label.toUpperCase()}
                </text>
                <text
                  x={n.x + n.w - TREE_BOX.pad}
                  y={n.y + TREE_BOX.labelY}
                  textAnchor="end"
                  fontFamily="var(--f-mono)"
                  fontSize="12"
                  fill="var(--ink-soft)"
                >
                  {n.coverage}
                </text>

                {/* coverage across the full inner width, in discrete cells */}
                {Array.from({ length: n.segments }, (_, i) => (
                  <rect
                    key={i}
                    x={n.x + TREE_BOX.pad + i * (TREE_BOX.segW + TREE_BOX.segGap)}
                    y={n.y + TREE_BOX.barY}
                    width={TREE_BOX.segW}
                    height={TREE_BOX.barH}
                    fill={i < n.filled ? hue : "var(--rule)"}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        </div>
      </div>

      <p className="margin-note mt-3">
        Stage = depth in the implication graph. The number on a box is the percentage of{" "}
        {OWNER.handle}&rsquo;s {cat.entries.length} catalogued repositories that evidence it, drawn
        as a segmented bar. Colour bands that same reading — hottest where the whole account
        evidences a capability, coolest where a single repository carries it alone.
      </p>
    </Observed>
  );
}

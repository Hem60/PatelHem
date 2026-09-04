"use client";

/**
 * The two written positions, behind a segmented toggle.
 *
 * One caveat, kept deliberately. This page's rule has been that nothing is
 * hidden behind a control, because a view a visitor has to click for is a view
 * most visitors never see. A toggle breaks that rule, so it is scoped as
 * tightly as possible: it swaps only the two AUTHORED framings of the same
 * facts — the recruiter's and the engineer's — and every computed thing on the
 * plate stays on the plate regardless of which is showing.
 *
 * So nothing checkable is ever behind the switch. Only the wording is.
 */
import { useState } from "react";
import type { Position } from "@/lib/content";

export function Positions({ positions }: { positions: Position[] }) {
  const [active, setActive] = useState(positions[0]?.id ?? "");
  const shown = positions.find((p) => p.id === active) ?? positions[0];

  if (!shown) return null;

  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Two readings of the same facts">
        {positions.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pos-${p.id}`}
            aria-selected={p.id === active}
            aria-controls={`panel-${p.id}`}
            className="segmented__btn"
            onClick={() => setActive(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div id={`panel-${shown.id}`} role="tabpanel" aria-labelledby={`pos-${shown.id}`}>
        {/* the first paragraph is the lead, set in the serif at reading size */}
        <p className="t-lead mt-5" style={{ fontSize: "var(--t-xl)", lineHeight: 1.25 }}>
          {shown.paragraphs[0]}
        </p>

        {shown.paragraphs.slice(1).map((text, i) => (
          <p key={i} className="t-body mt-4" style={{ fontSize: "var(--t-base)" }}>
            {text}
          </p>
        ))}

        <p className="margin-note mt-4">
          {shown.gloss} · Written by hand in content/parallax.json. Switching the tab changes the
          wording, never a figure — everything measured on this plate is shown either way.
        </p>
      </div>
    </div>
  );
}

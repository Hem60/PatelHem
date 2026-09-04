/**
 * First Light — the hero.
 *
 * Matched to the reference build's hero: status eyebrow, a pixel headline with
 * one word in the accent, a serif lead, a ruled mono credit line carrying the
 * real figures, and three hard-shadow buttons.
 *
 * The figures are read out of pipeline/data/catalogue.json at build time and
 * every one of them can be checked by cloning the repository and running the
 * survey — which is the part of this hero that is not borrowed.
 */
import { BANDS } from "@/lib/bands";
import type { Catalogue, Revision } from "@/lib/catalogue";
import { daysBetween, stamp } from "@/lib/format";
import { readout } from "@/lib/machine";
import { OWNER } from "@/lib/owner";
import { Observed } from "./Calibration";
import { Graticule } from "./Ground";
import { Lattice } from "./Lattice";

/** A class change inside 30 days is news. Older than that, it is history. */
function recentRevision(revisions: Revision[], now: string): Revision | null {
  const first = revisions[0];
  if (!first) return null;
  return daysBetween(first.date, now) <= 30 ? first : null;
}

export function FirstLight({ cat, revisions }: { cat: Catalogue; revisions: Revision[] }) {
  const r = readout(cat, revisions.length);
  const tick = recentRevision(revisions, cat.generated);
  const counts = BANDS.map((b) => ({
    band: b,
    count: cat.entries.filter((e) => e.classification === b.name).length,
  }));
  const occupied = counts.filter((c) => c.count > 0).length;

  return (
    <Observed id="first-light" className="hero">
      {/* the grid paper, and the only place on the page that still has it */}
      <Graticule />

      {/*
        * The section is full width and the copy carries the shell, rather than
        * the section carrying it and the background layers escaping with
        * `100vw`. `vw` includes the scrollbar and the layout box does not, so
        * every escaping layer came out 15px too wide and sat 8px off centre.
        * Full-width parent, `width: 100%` children: no `vw`, no drift.
        */}
      <div className="shell hero__copy">
      {/* eyebrow: status square, availability, boxed location */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          style={{ width: "0.5rem", height: "0.5rem", background: "var(--verdigris)" }}
        />
        <span className="label" style={{ color: "var(--ink-soft)" }}>
          Open to engineering work — the record on this page keeps itself
        </span>
        <span
          className="label"
          style={{ border: "1px solid var(--rule-strong)", padding: "0.4em 0.6em 0.3em", color: "var(--ink)" }}
        >
          {OWNER.handle}
        </span>
      </div>

      <h1 className="t-display sets" style={{ ["--set-index" as string]: "0", fontSize: "var(--t-4xl)" }}>
        The record
        <br />
        <span style={{ color: "var(--oxide)" }}>keeps</span> itself
      </h1>

      <p className="t-lead sets mt-6" style={{ ["--set-index" as string]: "1", maxWidth: "34ch" }}>
        Nothing here is self-reported — the instruments read the repositories and
        publish what they find.
      </p>

      <div
        className="mt-6 border-t pt-4 sets"
        style={{ borderColor: "var(--rule)", ["--set-index" as string]: "2" }}
      >
        <p className="t-data" style={{ fontSize: "var(--t-xs)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          {OWNER.name} — machine learning, AI and data science engineer
          <span style={{ color: "var(--oxide)" }}>{"  "}{r.catalogued}</span> objects catalogued
          <span style={{ color: "var(--oxide)" }}>{"  "}{r.meanComposite}</span> mean composite
          <span style={{ color: "var(--oxide)" }}>{"  "}{occupied}</span> of six classes occupied
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 sets" style={{ ["--set-index" as string]: "3" }}>
        <a className="btn btn--primary no-underline" href="#observing-run">
          Run a survey
        </a>
        <a className="btn no-underline" href="#catalogue">
          Open the vault
        </a>
        <a className="btn no-underline" href={OWNER.github} rel="noreferrer noopener" target="_blank">
          GitHub ↗
        </a>
      </div>

      {/* the promotion tick, and the honest alternative when there is none */}
      <div className="mt-8 flex items-center gap-3">
        <span className="live-rule w-10 shrink-0" data-live={tick ? "true" : "false"} aria-hidden="true" />
        {tick ? (
          <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--oxide)" }}>
            {tick.repo.toUpperCase()} · {tick.from} → {tick.to} · {tick.cause.axis}{" "}
            {Math.round(tick.cause.from)} → {Math.round(tick.cause.to)} · {stamp(tick.date, 3)}
          </p>
        ) : (
          <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-faint)" }}>
            No class change in the last 30 days. The revisions log is empty because nothing has
            moved yet — not because nothing is watching.
          </p>
        )}
      </div>

      {/*
        * The field. This is the band the removed raster left empty — it runs
        * full-bleed under the hero copy rather than sitting beside it, so the
        * headline reads over moving ground instead of next to a picture.
        */}
      </div>

      <div className="hero__field" aria-hidden="true">
        <Lattice className="hero__lattice" scale={1} />
      </div>
    </Observed>
  );
}

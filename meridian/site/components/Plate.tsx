/**
 * Plate primitives — layers 05, 06, 07 and the marginalia that go with them.
 *
 * Every content block on this page sits on a chart-paper plate: a second
 * ground, a hairline rule, paper grain, and corner registration marks. The
 * marks are not decoration — they are what tells a reader that the thing they
 * are looking at is a plate rather than a panel, which is the whole visual
 * argument of the site.
 */
import type { ReactNode } from "react";
import { classVar } from "@/lib/bands";
import type { Classification } from "@/lib/catalogue";

export function Plate({
  children,
  className = "",
  raised = false,
  corners = 2,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  corners?: 2 | 4;
}) {
  return (
    <div className={`plate grain regmarks ${raised ? "plate--raised" : ""} ${className}`}>
      {corners === 4 && (
        <>
          <span className="regmark" data-corner="tr" aria-hidden="true" />
          <span className="regmark" data-corner="bl" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
}

/** A plate carrying a class field — layer 10, the rarity treatment. */
export function ClassPlate({
  classification,
  children,
  className = "",
}: {
  classification: Classification;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`plate grain regmarks ${className}`}
      data-class={classification}
      style={{ ["--class" as string]: classVar(classification) }}
    >
      <span className="class-field" aria-hidden="true" />
      <span className="regmark" data-corner="tr" aria-hidden="true" />
      <span className="regmark" data-corner="bl" aria-hidden="true" />
      {children}
    </div>
  );
}

/**
 * A plate head, matched to the reference build.
 *
 *   PLATE 05 · · · · · · · · · · · · · · · ·
 *   THE VAULT
 *
 * The number is the section's identity and it leads, rather than sitting in
 * the gutter. See meridian/FOUNDRY-MATCH.md.
 */
export function SectionHead({
  plate,
  title,
  note,
}: {
  /** Two digits. The plate numbers run in page order. */
  plate: string;
  title: string;
  note?: string;
}) {
  return (
    <header className="mb-6">
      <div className="plate-head">
        <span className="plate-head__number">Plate {plate}</span>
        <span className="plate-head__rule" aria-hidden="true" />
        {note ? <span className="label hidden sm:inline">{note}</span> : null}
      </div>
      <h2 className="t-display" style={{ fontSize: "var(--t-3xl)" }}>
        {title}
      </h2>
    </header>
  );
}

/** A key/value cell, the page's unit of measurement. */
export function Cell({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="t-data" style={{ fontSize: "var(--t-base)", color: "var(--ink)" }}>
        {children}
      </div>
      {hint ? <div className="margin-note mt-1">{hint}</div> : null}
    </div>
  );
}

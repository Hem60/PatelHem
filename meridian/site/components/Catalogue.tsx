"use client";

/**
 * The Vault.
 *
 * One card per surveyed repository, rendered from catalogue.json and nothing
 * else. The band score is computed, and flipping a card shows the arithmetic
 * that produced it.
 *
 * The filters narrow what is shown; they never unlock anything. Every card is
 * present on first paint, and "all" is the default on every control.
 */
import { useMemo, useState } from "react";
import { AXES, BANDS, classVar } from "@/lib/bands";
import type { Catalogue as CatalogueData } from "@/lib/catalogue";
import { Observed } from "./Calibration";
import { Marker, Note, Notes } from "./Marginalia";
import type { Contributions as ContribData } from "@/lib/contributions";
import { SectionHead } from "./Plate";
import { VaultCard } from "./VaultCard";
import { ContributionStrip } from "./Contributions";

type SortKey = "composite" | (typeof AXES)[number]["key"];

const ALL = "ALL";

/**
 * How many objects the vault shows.
 *
 * The survey scores every non-fork repository on the account and publishes all
 * of them; this cap governs the display only. `dossier.json` still carries the
 * full catalogue, and the line under the controls says how many were surveyed,
 * so the cut is stated rather than hidden.
 *
 * The cut is by composite, which means it is the same arithmetic that produces
 * the class on the band. A repository improves and it climbs into the ten on
 * the next survey; one that stagnates while others improve drops out of it.
 * Nobody chooses the ten.
 */
const SHELF = 10;

export function Catalogue({ cat, contrib }: { cat: CatalogueData; contrib: ContribData }) {
  const [klass, setKlass] = useState<string>(ALL);
  const [language, setLanguage] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("composite");

  /*
   * The shelf: the top SHELF entries by composite. Everything below — filters,
   * counts, languages — reads off this, not off the full catalogue, so the
   * numbers on the controls describe what is actually on the page.
   */
  const shelf = useMemo(
    () => [...cat.entries].sort((a, b) => b.composite - a.composite).slice(0, SHELF),
    [cat.entries],
  );

  const languages = useMemo(
    () => [...new Set(shelf.flatMap((e) => e.stack))].sort((a, b) => a.localeCompare(b)),
    [shelf],
  );

  const shown = useMemo(() => {
    const filtered = shelf.filter(
      (e) =>
        (klass === ALL || e.classification === klass) &&
        (language === ALL || e.stack.includes(language)),
    );
    return [...filtered].sort((a, b) =>
      sort === "composite"
        ? b.composite - a.composite
        : (b.axes[sort] ?? 0) - (a.axes[sort] ?? 0) || b.composite - a.composite,
    );
  }, [shelf, klass, language, sort]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of shelf) map.set(e.classification, (map.get(e.classification) ?? 0) + 1);
    return map;
  }, [shelf]);

  /** Surveyed but below the cut. Named, not quietly dropped. */
  const belowCut = cat.entries.length - shelf.length;

  return (
    <Observed id="catalogue" className="shell">
      <SectionHead
        plate="05"
        title="The vault"
        note={
          belowCut > 0
            ? `top ${shelf.length} of ${cat.entries.length} · ranked by composite`
            : `${shelf.length} objects · ranked by composite`
        }
      />

      <div className="spread mb-6">
        <p className="t-body lg:col-span-8 lg:pr-10">
          Every repository the survey found, minus forks and the profile README. An entry is
          drafted the first time a repository is seen — nobody asks for a card
          <Marker n={1} /> — and it publishes with or without a hand-written thesis line. The
          shelf holds the ten highest composites<Marker n={3} />; the rest are surveyed, scored
          and served, just not displayed here.
        </p>
        <Notes className="lg:col-span-4">
          <Note n={1}>
            A repository the survey has not seen before gets an entry on the next run, drafted by
            Herald and checked by Plumb. Nothing on this page waits for a person to request a
            card.
          </Note>
          <Note n={2}>
            The band on each card carries the class and the composite the engine computed. Flip a
            card to see the five readings, their weights, and the sum that produced it.
          </Note>
          <Note n={3}>
            The cut is by composite, so it is the same arithmetic as the class. Improve a
            repository and it climbs on the next survey; leave one while others improve and it
            falls out. The full catalogue is at <a href="/dossier.json">/dossier.json</a>.
          </Note>
        </Notes>
      </div>

      {/* controls. Default is everything; nothing here reveals hidden content. */}
      <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-3" style={{ borderColor: "var(--rule)" }}>
        <fieldset>
          <legend className="label mb-1.5">Class</legend>
          <div className="flex flex-wrap gap-1.5">
            <FilterButton active={klass === ALL} onClick={() => setKlass(ALL)}>
              All {shelf.length}
            </FilterButton>
            {BANDS.filter((b) => (counts.get(b.name) ?? 0) > 0).map((b) => (
              <FilterButton
                key={b.name}
                active={klass === b.name}
                onClick={() => setKlass(b.name)}
                tint={classVar(b.name)}
              >
                {b.name} {counts.get(b.name)}
              </FilterButton>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label mb-1.5">Language</legend>
          <div className="flex flex-wrap gap-1.5">
            <FilterButton active={language === ALL} onClick={() => setLanguage(ALL)}>
              All
            </FilterButton>
            {languages.map((l) => (
              <FilterButton key={l} active={language === l} onClick={() => setLanguage(l)}>
                {l}
              </FilterButton>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label mb-1.5">Rank by</legend>
          <div className="flex flex-wrap gap-1.5">
            <FilterButton active={sort === "composite"} onClick={() => setSort("composite")}>
              Composite
            </FilterButton>
            {AXES.map((a) => (
              <FilterButton key={a.key} active={sort === a.key} onClick={() => setSort(a.key)}>
                {a.key}
              </FilterButton>
            ))}
          </div>
        </fieldset>

        <p className="margin-note ml-auto">
          Showing {shown.length} of {shelf.length} on the shelf
          {belowCut > 0 ? `, ${belowCut} more surveyed below the cut` : ""}. Filters narrow the
          view; every card on the shelf is on the page before you touch one.
        </p>
      </div>

      {/* a uniform grid: equal columns, real gaps, every card the height of
          its row. Rank is carried by the band, not by card width. */}
      <ol className="vault-grid">
        {shown.map((entry) => (
          <VaultCard key={entry.name} entry={entry} />
        ))}
      </ol>

      {shown.length === 0 && (
        <p className="t-data" style={{ color: "var(--ink-faint)" }}>
          Nothing in the catalogue matches that combination.
        </p>
      )}

      {/*
        * Shared work sits with the projects rather than in a plate of its own:
        * a reader looking at the work should see all of it, with the ownership
        * stated on each card.
        */}
      <ContributionStrip data={contrib} />
    </Observed>
  );
}

function FilterButton({
  active,
  onClick,
  tint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="t-data border px-2 py-1 text-[0.6875rem] uppercase tracking-[0.12em]"
      style={{
        borderColor: active ? (tint ?? "var(--signal)") : "var(--rule)",
        color: active ? (tint ?? "var(--signal)") : "var(--ink-dim)",
        backgroundColor: active ? "color-mix(in srgb, currentColor 8%, transparent)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

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

export function Catalogue({ cat, contrib }: { cat: CatalogueData; contrib: ContribData }) {
  const [klass, setKlass] = useState<string>(ALL);
  const [language, setLanguage] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("composite");

  const languages = useMemo(
    () => [...new Set(cat.entries.flatMap((e) => e.stack))].sort((a, b) => a.localeCompare(b)),
    [cat.entries],
  );

  const shown = useMemo(() => {
    const filtered = cat.entries.filter(
      (e) =>
        (klass === ALL || e.classification === klass) &&
        (language === ALL || e.stack.includes(language)),
    );
    return [...filtered].sort((a, b) =>
      sort === "composite"
        ? b.composite - a.composite
        : (b.axes[sort] ?? 0) - (a.axes[sort] ?? 0) || b.composite - a.composite,
    );
  }, [cat.entries, klass, language, sort]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of cat.entries) map.set(e.classification, (map.get(e.classification) ?? 0) + 1);
    return map;
  }, [cat.entries]);

  return (
    <Observed id="catalogue" className="shell">
      <SectionHead plate="05" title="The vault" note={`${cat.entries.length} objects · ranked by composite`} />

      <div className="spread mb-6">
        <p className="t-body lg:col-span-8 lg:pr-10">
          Every repository the survey found, minus forks and the profile README. An entry is
          drafted the first time a repository is seen — nobody asks for a card
          <Marker n={1} /> — and it publishes with or without a hand-written thesis line.
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
        </Notes>
      </div>

      {/* controls. Default is everything; nothing here reveals hidden content. */}
      <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-y py-3" style={{ borderColor: "var(--rule)" }}>
        <fieldset>
          <legend className="label mb-1.5">Class</legend>
          <div className="flex flex-wrap gap-1.5">
            <FilterButton active={klass === ALL} onClick={() => setKlass(ALL)}>
              All {cat.entries.length}
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
          Showing {shown.length} of {cat.entries.length}. Filters narrow the view; every entry is
          on the page before you touch one.
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

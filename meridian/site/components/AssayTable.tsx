"use client";

/**
 * The assay table — one row per catalogued repository, expandable.
 *
 * Matched to the reference build's rubric table: a score in the display face,
 * the name, a line of description, the class and commit count on the right,
 * and a `+` that opens the breakdown.
 *
 * What opens is the answer to the question the class raises. "EPIC" means
 * nothing on its own; the panel shows the five axis readings, each multiplied
 * by its fixed weight, summing to the composite, and the composite landing in
 * a band with a stated floor. Every step is arithmetic a reader can redo.
 *
 * The evidence under each axis is the survey's own sentences, filtered to that
 * axis — not a restatement. If Herald's wording ever drifts and a sentence
 * stops matching, it appears in an "unattributed" line rather than vanishing.
 */
import { useState } from "react";
import { classVar } from "@/lib/bands";
import type { Catalogue, Catalogue as Cat, Entry } from "@/lib/catalogue";
import { assay } from "@/lib/assay";
import { Figure } from "./Figure";

/**
 * The engine's component keys, in English.
 *
 * The keys are the engine's own — `ciGreen`, `pinned` — and are the right
 * names in the source. On the page they need to say what they measure, so this
 * is a display map only: a key with no entry here prints as-is rather than
 * being hidden, so a new component in the engine shows up immediately.
 */
const PART_LABEL: Record<string, string> = {
  tests: "Test suite",
  ci: "Continuous integration",
  ciGreen: "Last run green",
  coverage: "Coverage reporting",
  lint: "Lint configured",
  typing: "Type checking",
  license: "Licence",
  pinned: "Dependencies pinned",
  commits: "Commit history",
  code: "Codebase size",
  modules: "Module count",
  lifespan: "Lifespan",
  languages: "Language spread",
  base: "Neutral baseline",
  rareDomain: "Unusual domain",
  commonDomain: "Common domain",
  evaluates: "Evaluation harness",
  onChain: "On-chain code",
  uncommonLanguages: "Uncommon languages",
  repeatedStack: "Stack repeated in account",
  deployed: "Live deployment",
  readme: "README depth",
  images: "README images",
  description: "Description set",
  topics: "Topics set",
  releases: "Tagged release",
  docs: "Documents folder",
  social: "Stars and forks",
  recency: "Recent activity",
  activeDays: "Active days",
  activeMonths: "Active months",
  issueActivity: "Open issues",
  sustained: "Sustained over months",
};

/** Segmented bar: one cell per 5 points, so the bar IS the reading. */
function Meter({ value }: { value: number }) {
  const cells = 20;
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells);
  return (
    <span className="meter" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} data-on={i < lit} />
      ))}
    </span>
  );
}

function Breakdown({ entry, partMax }: { entry: Entry; partMax: Cat["partMax"] }) {
  const a = assay(entry, partMax ?? {});

  return (
    <div className="assay__open">
      <div className="assay__axes">
        {a.axes.map((axis) => (
          <section key={axis.key} className="assay__axis">
            <header className="assay__axisHead">
              <span className="label">{axis.key}</span>
              <span className="t-data assay__axisScore">
                <Figure value={axis.contribution} />/<Figure value={axis.ceiling} />
              </span>
            </header>

            <Meter value={axis.value} />

            <p className="margin-note assay__gloss">{axis.gloss}</p>

            <p className="t-data assay__math">
              <Figure value={axis.value} /> reading × {axis.weight} weight ={" "}
              <strong>
                <Figure value={axis.contribution} />
              </strong>{" "}
              of the composite
            </p>

            {/*
              * The components, itemised. A filled diamond earned points, a
              * hollow one did not — and the ones that did not are the useful
              * half of the list, because they are what is left to do.
              */}
            {axis.parts.length > 0 ? (
              <ul className="crit">
                {axis.parts.map((part) => (
                  <li key={part.key} className="crit__row" data-earned={part.earned}>
                    <span className="crit__mark" aria-hidden="true">
                      {part.earned ? "◆" : "◇"}
                    </span>
                    <span className="crit__name">{PART_LABEL[part.key] ?? part.key}</span>
                    {/*
                      * `commonDomain` and `repeatedStack` only ever subtract,
                      * so "0/-20" is nonsense as a fraction. A penalty not
                      * incurred prints as avoided; one that was, prints the
                      * points it cost.
                      */}
                    <span className="crit__pts t-data">
                      {part.max < 0 ? (
                        part.points < 0 ? (
                          <>
                            <Figure value={part.points} /> penalty
                          </>
                        ) : (
                          "avoided"
                        )
                      ) : (
                        <>
                          <Figure value={part.points} />/<Figure value={part.max} />
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="assay__none">
                This catalogue was published before the engine emitted component
                readings. Re-run the survey to itemise them.
              </p>
            )}

            {axis.evidence.length > 0 && (
              <ul className="assay__evidence">
                {axis.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* the arithmetic closing: five contributions, a sum, a band, a class */}
      <div className="assay__sum">
        <p className="t-data">
          Five contributions sum to <strong><Figure value={a.total} /></strong>. The published
          composite is <Figure value={a.published} />, which clears the {a.classification} floor of{" "}
          {a.floor} — so the class is {a.classification}. Nothing else decides it.
        </p>

        <p className="t-data mt-2" style={{ color: "var(--ink-soft)" }}>
          {a.next ? (
            <>
              <Figure value={a.next.points} /> points from {a.next.target}
              {a.weakest ? (
                <>
                  {" "}— the cheapest of them is <strong>{a.weakest.key}</strong>, holding{" "}
                  <Figure value={a.weakest.ceiling - a.weakest.contribution} /> unclaimed points.
                </>
              ) : null}{" "}
              A promotion also needs the higher band held for two consecutive runs.
            </>
          ) : (
            "Top of the ladder — nothing above MYTHIC to promote into."
          )}
        </p>

        {a.unattributed.length > 0 && (
          <p className="margin-note mt-2">
            Not attributed to an axis: {a.unattributed.join(" · ")}. A sentence lands here when
            Herald&rsquo;s wording changes and the assay&rsquo;s patterns have not caught up — it is
            shown rather than dropped.
          </p>
        )}
      </div>
    </div>
  );
}

export function AssayTable({ cat }: { cat: Catalogue }) {
  const [open, setOpen] = useState<string | null>(null);
  const ranked = [...cat.entries].sort((x, y) => y.composite - x.composite);

  return (
    <div className="assay">
      <ul>
        {ranked.map((entry) => {
          const isOpen = open === entry.name;
          const commits = entry.facts.find((f) => f.label.toLowerCase() === "commits")?.value;

          return (
            <li key={entry.name} className="assay__row" data-open={isOpen}>
              <button
                type="button"
                className="assay__head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : entry.name)}
              >
                <span className="assay__score t-display">{Math.round(entry.composite)}</span>

                <span className="assay__id">
                  <span className="assay__name">{entry.name}</span>
                  <span className="assay__desc">
                    {entry.thesis ?? entry.summary[0] ?? "No description recorded."}
                  </span>
                </span>

                <span className="assay__class">
                  <span className="label" style={{ color: classVar(entry.classification) }}>
                    {entry.classification}
                  </span>
                  <span className="assay__commits">{commits ?? "—"} commits</span>
                </span>

                <span className="assay__toggle" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && <Breakdown entry={entry} partMax={cat.partMax} />}
            </li>
          );
        })}
      </ul>

      <p className="margin-note assay__foot">
        Evidence collected {cat.generated.slice(0, 10)} · five axes, fixed weights · re-derived from
        catalogue.json on every build. Open a row to see where its points came from.
      </p>
    </div>
  );
}

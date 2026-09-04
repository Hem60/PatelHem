/**
 * Parallax — plate 02, "Who you are reading".
 *
 * Two columns, matched to the reference build. On the left a segmented toggle
 * between two written readings of the same facts, then the areas the work has
 * actually gone into. On the right the dossier: identity, measured languages,
 * and the skill set.
 *
 * A parallax is what you get when you observe the same object from two places,
 * and the difference tells you the distance. That is the whole structure here:
 * the left column is written and the right is read off the catalogue, and a
 * visitor can hold them against each other.
 *
 * The toggle is the one control on this page that hides anything, and it is
 * scoped so that what it hides is only ever WORDING — see Positions.tsx.
 */
import type { Catalogue } from "@/lib/catalogue";
import type { RecordEntry, Skill } from "@/lib/content";
import { positions } from "@/lib/content";
import { capabilities } from "@/lib/evidence";
import { machineView } from "@/lib/machine";
import { Observed } from "./Calibration";
import { SectionHead } from "./Plate";
import { Dossier } from "./Dossier";
import { Positions } from "./Positions";

/**
 * Where the work has gone — computed, not authored.
 *
 * The reference build lists six areas it typed by hand. These come out of the
 * evidence graph: each is a capability some repository actually demonstrates,
 * carrying the repositories that demonstrate it. Six of the strongest, so the
 * grid stays a grid.
 */
function areas(cat: Catalogue) {
  return capabilities(cat)
    .slice()
    .sort((a, b) => b.repos.length - a.repos.length || a.label.localeCompare(b.label))
    .slice(0, 6);
}

export function Parallax({
  cat,
  record,
  skills,
}: {
  cat: Catalogue;
  record: RecordEntry[];
  skills: Skill[];
}) {
  const authored = positions();
  const machine = machineView(cat);
  const work = areas(cat);

  return (
    <Observed id="parallax" className="shell">
      <SectionHead plate="02" title="Who you are reading" note="Written · computed" />

      <div className="parallax">
        {/* ── written ─────────────────────────────────────────────────── */}
        <div className="parallax__written">
          <Positions positions={authored} />

          <p className="dossier__head mt-8">Where the work has gone</p>
          <ul className="areas">
            {work.map((a) => (
              <li key={a.id} className="areas__card">
                <h3 className="t-display" style={{ fontSize: "var(--t-md)", color: "var(--ink)" }}>
                  {a.label}
                </h3>
                <p className="t-data areas__gloss">{a.gloss}</p>
                <div className="dossier__tags mt-3">
                  {a.repos.map((r) => (
                    <span key={r} className="tag">
                      {r}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {/*
            * The third reading, and the only one nobody wrote. It stays out in
            * the open under both tabs — it is the one paragraph on the plate
            * that recomputes itself when the account changes.
            */}
          <div className="areas__machine">
            <p className="dossier__head">Read by the instruments</p>
            {/* each sentence prints the measurements it rests on, not a footnote */}
            {machine.map((line) => (
              <div key={line.template} className="areas__line">
                <p className="t-body" style={{ fontSize: "var(--t-base)" }}>
                  {line.text}
                </p>
                <p className="margin-note mt-1">{line.evidence.join(" · ")}</p>
              </div>
            ))}
            <p className="margin-note mt-3">
              Rebuilt from catalogue.json on every build by lib/machine.ts. It has never read the
              two written positions above.
            </p>
          </div>
        </div>

        {/* ── computed ────────────────────────────────────────────────── */}
        <div className="parallax__dossier">
          <Dossier cat={cat} record={record} skills={skills} />
        </div>
      </div>
    </Observed>
  );
}

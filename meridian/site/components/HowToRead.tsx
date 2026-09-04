/**
 * How to Read This Chart.
 *
 * States the classification system plainly — the five axes, their weights, the
 * six bands, and the hysteresis that stops a rank flickering — so a visitor
 * knows the numbers on this page are arithmetic rather than self-flattery.
 *
 * The axis weights and band thresholds are the same constants the engine
 * scores with; test/bands.test.ts checks that every published entry falls in
 * the band this page says it should.
 */
import { AXES, BANDS } from "@/lib/bands";
import type { Catalogue } from "@/lib/catalogue";
import { Observed } from "./Calibration";
import { Figure } from "./Figure";
import { SectionHead } from "./Plate";
import { Note } from "./Marginalia";
import { ClassCell } from "./ClassCell";
import { AssayTable } from "./AssayTable";

export function HowToRead({ cat }: { cat: Catalogue }) {
  /* mean per axis across the account, so the table shows the rubric and the
     account's actual standing against it side by side */
  const means = AXES.map((a) => {
    const vals = cat.entries
      .map((e) => e.axes[a.key])
      .filter((v): v is number => typeof v === "number");
    return { ...a, mean: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null };
  });

  return (
    <Observed id="how-to-read" className="shell">
      <SectionHead plate="08" title="The assay" note="How every score is computed" />

      <div className="spread">
        <div className="lg:col-span-7 lg:pr-10">
          <p className="t-body">
            A composite score is a weighted sum of five axis readings, each on a 0–100 scale. The
            weights are fixed and public; they do not change per repository, and no repository is
            exempt from any of them. The class is then whichever band the composite falls into.
          </p>
          <p className="t-body mt-4">
            The scoring function is pure — no network, no filesystem, and no clock, with the
            current time injected from outside. That is not a stylistic preference. It is what
            makes a published rank reproducible: the same repository state gives the same number
            on any machine, in any timezone, in any year.
          </p>
          <p className="t-body mt-4">
            <strong>A class does not move the instant a score does.</strong> A promotion needs the
            higher band held for two consecutive runs and at least two points of headroom; a
            demotion needs three runs and three points; and no class moves twice inside thirty
            days. Ranks that flicker are ranks nobody trusts.
          </p>

          <table className="mt-6 w-full border-collapse">
            <caption className="label mb-2 text-left">Axes · weight · account mean</caption>
            <thead>
              <tr>
                {["Axis", "Weight", "Mean", "What it reads"].map((h) => (
                  <th
                    key={h}
                    className="label border-b py-2 pr-3 text-left align-bottom"
                    style={{ borderColor: "var(--rule-hard)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {means.map((a) => (
                <tr key={a.key}>
                  <td
                    className="t-data border-b py-2.5 pr-3 align-top"
                    style={{ borderColor: "var(--rule)", fontSize: "var(--t-sm)" }}
                  >
                    {a.key}
                  </td>
                  <td
                    className="t-data border-b py-2.5 pr-3 align-top"
                    style={{ borderColor: "var(--rule)", fontSize: "var(--t-sm)", color: "var(--signal)" }}
                  >
                    ·{String(a.weight).slice(2).padEnd(2, "0")}
                  </td>
                  <td
                    className="t-data border-b py-2.5 pr-3 align-top"
                    style={{ borderColor: "var(--rule)", fontSize: "var(--t-sm)" }}
                  >
                    {a.mean === null ? "—" : <Figure value={a.mean} />}
                  </td>
                  <td
                    className="border-b py-2.5 align-top"
                    style={{
                      borderColor: "var(--rule)",
                      fontFamily: "var(--f-body)",
                      fontSize: "var(--t-sm)",
                      color: "var(--ink-dim)",
                    }}
                  >
                    {a.gloss}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* the ladder, drawn as a ladder, butted against the rubric */}
        <div className="lg:col-span-5 lg:border-l lg:pl-6" style={{ borderColor: "var(--rule)" }}>
          <div className="header-rule mb-3">
            <span className="label">The ladder</span>
          </div>
          <ol>
            {[...BANDS].reverse().map((b) => {
              const count = cat.entries.filter((e) => e.classification === b.name).length;
              return (
                <ClassCell
                  key={b.name}
                  as="li"
                  classification={b.name}
                  className="flex items-center gap-3 border-b px-3 py-3"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <span className="chip" style={{ ["--class" as string]: `var(${b.token})` }}>
                    {b.name}
                  </span>
                  <span className="t-data ml-auto" style={{ fontSize: "var(--t-sm)", color: "var(--ink-dim)" }}>
                    {b.range}
                  </span>
                  <span
                    className="t-data w-8 text-right"
                    style={{ fontSize: "var(--t-sm)", color: count ? "var(--ink)" : "var(--ink-faint)" }}
                  >
                    {count}
                  </span>
                </ClassCell>
              );
            })}
          </ol>
          <div className="mt-4">
            <Note n={1}>
              Counts are the live distribution across {cat.entries.length} catalogued
              repositories. Empty bands are shown empty.
            </Note>
            <Note n={2}>
              Forks and the profile repository are excluded from the survey, because a fork
              measures somebody else&rsquo;s work and a profile README measures nothing.
            </Note>
          </div>
        </div>
      </div>

      {/*
        * The rubric above is the rule; this is the rule applied. Every entry,
        * ranked, each opening onto the arithmetic that produced its class.
        */}
      <div className="mt-10">
        <div className="header-rule mb-4">
          <span className="t-pixel" style={{ color: "var(--oxide)" }}>
            Every entry, graded
          </span>
          <span className="label">{cat.entries.length} catalogued · open a row</span>
        </div>
        <AssayTable cat={cat} />
      </div>

    </Observed>
  );
}

"use client";

/**
 * A vault card, matched to the reference build's proportions.
 *
 * Portrait, fixed height, two faces on one footprint. The front is the
 * summary: rarity band with the computed score, instrument sigil, category,
 * name, thesis, a two-column spec grid and the stack. The back is the assay —
 * the arithmetic that produced the number in the band.
 *
 * **The whole front is one flip surface.** A transparent button covers the
 * face, so a click anywhere — including on the project name — turns the card
 * over rather than navigating away. The repository link lives on the back,
 * where it cannot be hit by accident, and it is the only thing on either face
 * that sits above the flip surface.
 *
 * That ordering is the whole interaction: turn the card to read the evidence,
 * then decide whether to open the code.
 */
import { useCallback, useRef, useState } from "react";
import { AXES, bandOf, classVar, nextClass } from "@/lib/bands";
import type { Entry } from "@/lib/catalogue";
import { categoryOf, instrumentFor } from "@/lib/sigil";
import { XP_AWARDS, useProgress } from "./Calibration";
import { Figure } from "./Figure";
import { Sigil } from "./Sigil";

function gapTo(entry: Entry): { target: string; points: number } | null {
  const above = nextClass(entry.classification);
  if (!above) return null;
  return { target: above, points: Math.round((bandOf(above).floor - entry.composite) * 10) / 10 };
}

export function VaultCard({ entry }: { entry: Entry }) {
  const [flipped, setFlipped] = useState(false);
  const ref = useRef<HTMLLIElement | null>(null);
  const { award } = useProgress();
  const instrument = instrumentFor(entry);
  const gap = gapTo(entry);
  const share = entry.authorship.share;
  /* whether the thesis line came out of the drafter rather than off a keyboard */
  const drafted = entry.thesisSource === "groq";

  const onMove = useCallback((event: React.PointerEvent<HTMLLIElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  const flip = useCallback(() => {
    setFlipped((prev) => !prev);
    award(`inspect:${entry.name}`, XP_AWARDS.inspect);
  }, [award, entry.name]);

  return (
    <li
      ref={ref}
      className="vault"
      data-flipped={flipped}
      onPointerMove={onMove}
      style={{
        ["--class" as string]: classVar(entry.classification),
        color: `var(${instrument.token})`,
      }}
    >
      <div className="vault__inner">
        {/* ── front ────────────────────────────────────────────────────── */}
        <div className="vault__face" aria-hidden={flipped}>
          {/* the whole face is the control. The name is text, not a link. */}
          <button
            type="button"
            className="vault__flip"
            onClick={flip}
            tabIndex={flipped ? -1 : 0}
            aria-label={`${entry.name} — turn the card over for the assay`}
          />
          <span className="vault__foil" aria-hidden="true" />

          <div className="band">
            <span>{entry.classification}</span>
            <span title="Composite score, computed by the engine on every build">
              {Math.round(entry.composite)}/100
            </span>
          </div>

          <div className="vault__body">
            <div className="vault__head">
              <span
                className="flex items-center justify-center border"
                style={{ borderColor: "currentColor", padding: "5px", lineHeight: 0 }}
              >
                <Sigil id={instrument.id} size={3} />
              </span>
              <span
                className="label"
                style={{ color: `var(${instrument.token})`, letterSpacing: "0.16em" }}
              >
                {instrument.name}
              </span>
            </div>

            <p className="label mt-2" style={{ color: "var(--ink-faint)" }}>
              {categoryOf(entry)}
            </p>

            <h3 className="t-display mt-2" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
              {entry.name}
            </h3>

            {entry.thesis ? (
              <p className="t-thesis vault__thesis mt-2">
                {entry.thesis}
                {/*
                  * A drafted line is marked on the face of the card, not in a
                  * footnote somebody has to flip to. The whole argument of
                  * this page is that a reader can tell where a sentence came
                  * from, and an unmarked machine line would be the one place
                  * that stopped being true.
                  */}
                {drafted ? <span className="drafted-mark" title="Drafted from measured facts, not written by hand">·D</span> : null}
              </p>
            ) : (
              <p className="t-thesis vault__thesis mt-2" style={{ color: "var(--ink-faint)" }}>
                No thesis line yet — this entry publishes on measurement alone.
              </p>
            )}

            <p className="t-data vault__claims mt-2">{entry.summary.slice(0, 3).join(" ")}</p>

            <dl className="spec mt-3">
              {entry.facts.slice(0, 4).map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="vault__tags mt-3">
              {entry.stack.slice(0, 3).map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="vault__foot">
            <span>▸ Tap to inspect</span>
            <span style={{ color: `var(${instrument.token})` }}>{instrument.name.toUpperCase()}</span>
          </div>
        </div>

        {/* ── back: the assay, and the only link on the card ───────────── */}
        {/*
          * The back cannot use a covering button — the assay scrolls, and a
          * surface over it would eat the scroll. So the face itself takes the
          * click and turns the card back; the band and the close control are
          * buttons purely so there is a keyboard path, and their clicks bubble
          * here rather than handling the flip twice.
          */}
        {/*
          * The back is the dossier: what the entry is, then the readings that
          * ranked it. Structured to be read top to bottom — statement, the
          * caveat that qualifies it, the stack, then the five axes as labelled
          * meters rather than a table, because a bar is legible at a glance
          * and a table of decimals is not.
          */}
        <div className="vault__face vault__face--back" aria-hidden={!flipped} onClick={flip}>
          <button
            type="button"
            className="dossier-band vault__close"
            tabIndex={flipped ? 0 : -1}
            aria-label={`Close the dossier for ${entry.name}`}
          >
            <span>Dossier</span>
            <span>{instrument.name}</span>
          </button>

          <div className="vault__body vault__scroll">
            <h3 className="t-display" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
              {entry.name}
            </h3>

            <p className="t-data back__lede">
              {entry.thesis ??
                `Ranked ${entry.classification} on a composite of ${Math.round(entry.composite)}, from five axis readings the survey took directly off the repository.`}
            </p>

            {/* the strongest thing the survey found, quoted rather than summarised */}
            {entry.summary[0] ? (
              <p className="t-data back__quote">{entry.summary.slice(0, 3).join(" ")}</p>
            ) : null}

            {/*
              * The caveat box. Every card carries one, because every card has
              * something a reader should know before trusting the rank — an
              * unwritten thesis, or work that is not wholly this author's.
              */}
            <div className="back__caveat">
              <p className="t-data">
                {share !== null && share < 100 ? (
                  <>
                    <strong>Authorship is {share}%.</strong> {entry.authorship.mine} of{" "}
                    {entry.authorship.total} commits are mine, counted from the commit graph — the
                    rank grades the repository, not my share of it.
                  </>
                ) : !entry.thesis ? (
                  <>
                    <strong>No thesis line yet.</strong> This entry publishes on measurement alone;
                    the sentences above are the survey&rsquo;s, not mine.
                  </>
                ) : drafted ? (
                  <>
                    <strong>The thesis line here was drafted, not written.</strong> A model was
                    given the measured sentences above and nothing else, and asked to describe
                    the repository from them — so a repository I have not written about yet
                    still arrives with words. Every figure on this card is still computed. The
                    line is marked ·D until I replace it with my own.
                  </>
                ) : (
                  <>
                    <strong>Rank is computed.</strong> Nothing on this card was typed — re-run the
                    survey and it rewrites itself.
                  </>
                )}
              </p>
            </div>

            <div className="vault__tags back__tags">
              {entry.stack.slice(0, 4).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>

            {/* the five readings, as meters */}
            <ul className="back__axes">
              {AXES.map((a) => {
                const value = entry.axes[a.key] ?? 0;
                return (
                  <li key={a.key} className="back__axis">
                    <span className="label back__axisName">{a.key}</span>
                    <span className="meter meter--gold" aria-hidden="true">
                      {Array.from({ length: 16 }, (_, i) => (
                        <span key={i} data-on={i < Math.round((value / 100) * 16)} />
                      ))}
                    </span>
                    <span className="t-data back__axisVal">
                      <Figure value={value} />
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="back__sum t-data">
              Composite <Figure value={entry.composite} /> → {entry.classification}
              {gap ? ` · ${gap.points} from ${gap.target}` : " · top of the ladder"}
            </p>
          </div>

          <div className="vault__foot">
            <button type="button" className="vault__closeText" tabIndex={flipped ? 0 : -1}>
              ▸ Tap to close
            </button>
            {/* the one thing on the card that must not turn it over */}
            <a
              className="vault__code"
              href={entry.links.code}
              rel="noreferrer noopener"
              target="_blank"
              tabIndex={flipped ? 0 : -1}
              onClick={(event) => event.stopPropagation()}
            >
              Code ↗
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}

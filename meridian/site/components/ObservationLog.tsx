"use client";

/**
 * The observation log — what this reader has done, and what it was worth.
 *
 * The reference build closes on an operator record: a grid of achievements,
 * several of them hidden behind "???" to bait further exploration. This does
 * the same job — progress, and a way to clear it — on the opposite principle,
 * because `Calibration.tsx` already commits to one:
 *
 *     "a level never hides anything"
 *
 * Every plate, card and figure is on the page at level one. A level buys
 * precision — 67 becomes 67.4 becomes 67.40 — never access. A locked row
 * saying "??? · keep exploring" would contradict that in the most visible
 * place on the page, so there are none. What is listed instead is what the
 * page actually recorded, next to the rate it was paid at.
 *
 * So this is a receipt, not a trophy cabinet: four counters, the arithmetic
 * that turned them into XP, and a reset.
 */
import { useEffect, useState } from "react";
import { SIGILS } from "@/lib/sigil";
import { Observed, XP_AWARDS, useProgress } from "./Calibration";
import { Sigil } from "./Sigil";

/** One counted action: what it is, how many, out of how many, and the rate. */
interface Row {
  key: string;
  label: string;
  gloss: string;
  done: number;
  outOf: number | null;
  rate: number;
}

export function ObservationLog() {
  const { xp, level, intoLevel, perLevel, tally, recruited, isRecruited, reset } = useProgress();

  /*
   * How many plates there are to read, counted off the page rather than
   * hard-coded. A section added tomorrow raises the denominator without
   * anybody remembering to update a number here.
   */
  const [plates, setPlates] = useState(0);
  useEffect(() => {
    setPlates(document.querySelectorAll("main section[id], main footer[id]").length);
  }, []);

  const rows: Row[] = [
    {
      key: "plates",
      label: "Plates read",
      gloss: "A section counts once it is genuinely on screen, not once it is scrolled past.",
      done: tally.plates,
      outOf: plates || null,
      rate: XP_AWARDS.plate,
    },
    {
      key: "recruits",
      label: "Instruments recruited",
      gloss: "The instruments that take the readings. Recruit them from the roster.",
      done: tally.recruits,
      outOf: SIGILS.length,
      rate: XP_AWARDS.recruit,
    },
    {
      key: "inspects",
      label: "Cards turned",
      gloss: "Each vault card, opened to its dossier.",
      done: tally.inspects,
      outOf: null,
      rate: XP_AWARDS.inspect,
    },
    {
      key: "surveys",
      label: "Surveys dispatched",
      gloss: "Real requests to the GitHub API, made because you pressed a button.",
      done: tally.surveys,
      outOf: null,
      rate: XP_AWARDS.survey,
    },
  ];

  const earned = rows.reduce((sum, r) => sum + r.done * r.rate, 0);

  return (
    <Observed id="observation-log" className="shell">
      <div className="oplog">
        <div className="oplog__bar">
          <span>Observation log</span>
          <span className="oplog__level">
            Level {level} · {xp} XP · {intoLevel}/{perLevel} to next
          </span>
          <button
            type="button"
            className="oplog__reset"
            onClick={reset}
            aria-label="Clear this session's progress and start again"
          >
            Clear
          </button>
        </div>

        <div className="oplog__body">
          <ul className="oplog__rows">
            {rows.map((r) => (
              <li key={r.key} className="oplog__row" data-any={r.done > 0}>
                <span className="oplog__mark" aria-hidden="true">
                  {r.done > 0 ? "◆" : "◇"}
                </span>
                <span className="oplog__label">{r.label}</span>
                <span className="t-data oplog__count">
                  {r.done}
                  {r.outOf !== null ? ` of ${r.outOf}` : ""}
                </span>
                <span className="t-data oplog__rate">
                  {r.done} × {r.rate} = {r.done * r.rate}
                </span>
                <span className="margin-note oplog__gloss">{r.gloss}</span>
              </li>
            ))}
          </ul>

          {/* the instruments, lit by recruitment — the one visual on the panel */}
          <div className="oplog__sigils">
            <span className="label">Instruments</span>
            <ul>
              {SIGILS.map((s) => (
                <li key={s.id}>
                  <span
                    className="oplog__sigil"
                    style={{ borderColor: isRecruited(s.id) ? `var(${s.token})` : "var(--rule)" }}
                  >
                    <Sigil id={s.id} size={3} on={isRecruited(s.id)} title={s.name} />
                  </span>
                </li>
              ))}
            </ul>
            <span className="margin-note">
              {recruited.length} of {SIGILS.length} recruited
            </span>
          </div>

          <p className="t-data oplog__sum">
            {earned} XP from the actions above.{" "}
            {earned !== xp
              ? `The counter reads ${xp}, so ${Math.abs(xp - earned)} came from a key no longer listed here.`
              : "It reconciles with the counter in the bar, because it is the same arithmetic."}
          </p>

          <p className="margin-note oplog__note">
            Nothing on this page is behind a level. Every plate, card and figure is readable at
            level one — what a level buys is precision, so 67 becomes 67.4 becomes 67.40. There are
            no hidden rows here to go looking for. The progress is kept in your browser alone — it
            is never sent anywhere — and Clear empties it back to zero.
          </p>
        </div>
      </div>
    </Observed>
  );
}

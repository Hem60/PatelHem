"use client";

/**
 * The Career Log — plate 07.
 *
 * Two strands, in the reference build's order. First the record: education and
 * appointments on a ruled timeline, oldest last, with awards listed separately
 * underneath rather than mixed in. Then the revisions strand, which no other
 * portfolio has — every class change the pipeline made, dated, with the axis
 * that moved and the evidence that moved it.
 *
 * The record is author-supplied and says so. The revisions are generated, and
 * when nothing has moved the section prints that rather than padding itself.
 */
import type { Catalogue, Revision } from "@/lib/catalogue";
import type { RecordEntry } from "@/lib/content";
import { span, stamp } from "@/lib/format";
import { classVar } from "@/lib/bands";
import { Observed } from "./Calibration";
import { Figure } from "./Figure";
import { Plate, SectionHead } from "./Plate";
import { ClassCell } from "./ClassCell";

/** One hue per kind, so the timeline reads before it is read. */
const KIND_TOKEN: Record<RecordEntry["kind"], string> = {
  education: "--indigo",
  appointment: "--verdigris",
  award: "--ochre",
  release: "--plum",
};

export function LogRevisions({
  cat,
  revisions,
  record,
}: {
  cat: Catalogue;
  revisions: Revision[];
  record: RecordEntry[];
}) {
  const states = Object.entries(cat.state);

  /*
   * The reference build's split, and it is the right one: the timeline carries
   * the things with a duration — degrees, and the work itself — while awards
   * and appointments are points in time with a citation behind them, and read
   * better as cards than as a ruled sequence with no length to show.
   */
  /* oldest first on the timeline: a path reads forwards, not backwards */
  const path = record
    .filter((e) => e.kind === "education" || e.kind === "release")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const wins = record.filter((e) => e.kind === "award" || e.kind === "appointment");

  return (
    <Observed id="log" className="shell">
      <SectionHead plate="07" title="The career log" note="Record · revisions" />

      <p className="t-body mb-8">
        Education and the work itself, oldest first. Awards, competitions and appointments are
        listed separately underneath rather than mixed in here. This strand is written by hand —
        it is the one part of the page a repository cannot prove.
      </p>

      {record.length === 0 ? (
        <p className="t-body mb-8">
          Empty. Nothing is invented to fill it.
        </p>
      ) : (
        <>
          <ol className="log">
            {path.map((e) => (
              <LogEntry key={`${e.date}-${e.title}-${e.detail}`} entry={e} generated={cat.generated} />
            ))}
          </ol>

          {wins.length > 0 && (
            <div className="creds-block">
              <h3 className="t-display" style={{ fontSize: "var(--t-lg)" }}>
                Awards &amp; appointments
              </h3>
              <p className="t-body mt-1 mb-5">
                Competitive results and selections — {wins.length} recorded. Unlike every rank on
                this page, none of these is computed: each one is here because the author typed it,
                and each carries the body that awarded it so a reader can check.
              </p>

              <ul className="creds">
                {wins.map((e) => (
                  <CredCard key={`${e.date}-${e.title}-${e.detail}`} entry={e} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* the strand that is generated rather than written */}
      <div className="spread mt-12">
        <Plate className="p-5 lg:col-span-7" raised corners={4}>
          <div className="header-rule mb-4">
            <span className="t-pixel" style={{ color: "var(--oxide)" }}>
              Revisions
            </span>
            <span className="label">{revisions.length} logged</span>
          </div>

          {revisions.length === 0 ? (
            <>
              <p className="t-body" style={{ fontSize: "var(--t-base)" }}>
                No class has moved yet. The log has been empty since the pipeline started keeping
                score, and it will stay empty until a repository actually crosses a band — at
                which point the next observing run writes the line below without being asked.
              </p>
              <div
                className="mt-4 border p-3"
                style={{ borderColor: "var(--rule-strong)", borderStyle: "dashed" }}
              >
                <p className="label mb-2">Format · not a reading</p>
                <p className="t-data" style={{ fontSize: "var(--t-sm)", color: "var(--ink-faint)" }}>
                  &lt;repo&gt; · &lt;from&gt; → &lt;to&gt; · &lt;axis&gt; &lt;before&gt; → &lt;after&gt; · &lt;date&gt;
                </p>
                <p className="margin-note mt-2">
                  A promotion is always explained against the snapshot taken when the current class
                  was granted, never against the previous run: hysteresis usually lands the
                  improvement one run before the class moves, so a run-to-run comparison would
                  report no movement at all.
                </p>
              </div>
            </>
          ) : (
            <ol>
              {revisions.map((rev) => (
                <li key={`${rev.repo}-${rev.date}`} className="border-b py-3" style={{ borderColor: "var(--rule)" }}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="t-data" style={{ fontSize: "var(--t-sm)", color: "var(--oxide)" }}>
                      {stamp(rev.date, 3)}
                    </span>
                    <span className="t-display" style={{ fontSize: "var(--t-md)" }}>
                      {rev.repo}
                    </span>
                    <span className="chip" style={{ ["--class" as string]: classVar(rev.from) }}>
                      {rev.from}
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--ink-faint)" }}>
                      →
                    </span>
                    <span className="chip" style={{ ["--class" as string]: classVar(rev.to) }}>
                      {rev.to}
                    </span>
                  </div>
                  <p className="t-data mt-1.5" style={{ fontSize: "var(--t-sm)", color: "var(--ink-soft)" }}>
                    {rev.cause.axis} <Figure value={rev.cause.from} /> → <Figure value={rev.cause.to} /> · composite{" "}
                    <Figure value={rev.compositeFrom} /> → <Figure value={rev.compositeTo} />
                  </p>
                  <ul className="mt-1">
                    {rev.cause.evidence.map((ev) => (
                      <li key={ev} className="margin-note">
                        ├ {ev}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Plate>

        {/* what each entry is holding now, and since when */}
        <div className="lg:col-span-5 butt lg:border-l lg:pl-5" style={{ borderColor: "var(--rule)" }}>
          <div className="header-rule mb-3">
            <span className="label">Class state · held since</span>
          </div>
          <div className="grid gap-2">
            {states.map(([name, s]) => (
              <ClassCell key={name} classification={s.current} className="border p-3">
                <div className="flex items-baseline gap-2">
                  <span className="t-display" style={{ fontSize: "var(--t-md)" }}>
                    {name}
                  </span>
                  <span className="chip ml-auto" style={{ ["--class" as string]: classVar(s.current) }}>
                    {s.current}
                  </span>
                </div>
                <p className="t-data mt-1.5" style={{ fontSize: "var(--t-xs)", color: "var(--ink-soft)" }}>
                  since {stamp(s.since, 3)} · at grant <Figure value={s.compositeAtGrant} />
                </p>
              </ClassCell>
            ))}
          </div>
        </div>
      </div>
    </Observed>
  );
}

function LogEntry({ entry, generated }: { entry: RecordEntry; generated: string }) {
  const token = KIND_TOKEN[entry.kind];

  /*
   * "In progress" is a comparison against the last observing run, not against
   * a live clock — the same discipline the ranks follow. If the run is older
   * than the end date, the entry was still running when the page was built.
   */
  const running = entry.until !== undefined && entry.until > generated.slice(0, 7);

  return (
    <li className="log__row">
      <span
        className={`log__marker${entry.kind === "education" ? "" : " log__marker--hollow"}`}
        style={{ color: `var(${token})` }}
        aria-hidden="true"
      />

      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="label" style={{ color: `var(${token})`, letterSpacing: "0.2em" }}>
            {entry.kind}
          </span>
          <span className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-faint)" }}>
            {span(entry.date, entry.until)}
          </span>
        </div>

        <h3 className="t-display mt-1.5" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
          {entry.title}
        </h3>
        <p className="t-thesis" style={{ fontSize: "var(--t-base)" }}>
          {entry.detail}
        </p>

        {entry.summary ? <p className="t-data log__summary mt-3">{entry.summary}</p> : null}

        {(entry.tags.length > 0 || running) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
            {running && (
              <span className="tag" style={{ color: `var(${token})`, borderColor: `var(${token})` }}>
                in progress
              </span>
            )}
          </div>
        )}

        {entry.source ? (
          <a className="margin-note mt-2 inline-block" href={entry.source} rel="noreferrer noopener" target="_blank">
            {entry.source} ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}

/**
 * One award or appointment.
 *
 * `detail` is authored as "<body> — <what happened>", which is how it reads in
 * a sentence but not how it reads in a card. Splitting on the dash puts the
 * awarding body on its own line above the result, the way a citation is
 * normally set. An entry written without a dash keeps its whole detail as the
 * body line rather than being mangled to fit the template.
 */
function CredCard({ entry }: { entry: RecordEntry }) {
  const token = KIND_TOKEN[entry.kind];
  const [body, ...rest] = entry.detail.split(/\s+—\s+/);
  const result = rest.join(" — ");

  return (
    <li className="creds__card">
      <p className="label" style={{ color: `var(${token})`, letterSpacing: "0.2em" }}>
        &#9670; {entry.kind === "appointment" ? "role" : entry.kind}
      </p>

      <h4 className="t-display mt-2" style={{ fontSize: "var(--t-md)", color: "var(--ink)" }}>
        {entry.title}
      </h4>

      <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-soft)" }}>
        {body}
      </p>
      <p className="t-data" style={{ fontSize: "var(--t-2xs)", color: "var(--ink-faint)" }}>
        {span(entry.date, entry.until)}
      </p>

      {result ? (
        <p className="t-data mt-3" style={{ fontSize: "var(--t-xs)", color: "var(--ink-soft)" }}>
          {result}
        </p>
      ) : null}

      {entry.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}

      {entry.source ? (
        <a className="margin-note mt-2 inline-block" href={entry.source} rel="noreferrer noopener" target="_blank">
          {entry.source} ↗
        </a>
      ) : null}
    </li>
  );
}

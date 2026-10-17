"use client";

/**
 * Shared work — the cards for repositories that are not mine to rank.
 *
 * ── Same card, different claim ──────────────────────────────────────────────
 * These are built on the vault card's anatomy and class names, not a parallel
 * set: one footprint, two faces, a band across the top, a spec grid, tags, and
 * a flip to the dossier. An earlier cut gave shared work its own flat card and
 * its own grid, and the result read as a lesser section bolted to the side of
 * the real one. The work is not lesser; the claim being made about it is
 * different, and that difference belongs in what the card SAYS.
 *
 * So the geometry is identical and three things are deliberately not:
 *
 *   the band    carries "contribution" and a share, never a class and a
 *               composite. `--class` is set to the oxide so it cannot be read
 *               as a rarity colour — there is no rank here to colour.
 *   the back    shows the authorship arithmetic where a vault card shows the
 *               five axes. The engine is never run against these.
 *   the foot    says so, on both faces.
 *
 * ── One component, two sources ──────────────────────────────────────────────
 * A fork on the owner's own account and a repository on somebody else's are
 * the same kind of claim — a share of something — so they render through one
 * component and differ only in what the data carries. Two near-identical card
 * components would drift apart within a month.
 *
 * Private work publishes less: no link, and no commit subjects. Every public
 * card quotes the subjects verbatim because that is the point of them; in a
 * repository nobody else can open they are the most revealing thing in it, so
 * the arithmetic goes out and the wording does not. The card says that rather
 * than leaving a reader to notice the absence.
 */
import { useCallback, useRef, useState } from "react";
import type { Contributions as Data, Contribution } from "@/lib/contributions";
import type { External, ExternalFile } from "@/lib/external";
import { XP_AWARDS, useProgress } from "./Calibration";

/** Bytes → a short label. The repository's stack, never the contribution's. */
function kb(bytes: number): string {
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

/**
 * What a shared card needs, whichever file it came from.
 *
 * Normalising here is what lets one component serve both and keeps the two
 * from drifting into different designs.
 */
interface Shared {
  readonly key: string;
  readonly name: string;
  /** The account that owns it. The owner's own login for a fork. */
  readonly owner: string;
  /** The owner's own sentence, when the source carries one. */
  readonly description: string | null;
  readonly private: boolean;
  /** Null when there is nothing a reader could open. */
  readonly url: string | null;
  readonly share: number;
  readonly commits: { mine: number; total: number; substantive: number };
  readonly excluded: { merges: number; boilerplate: number };
  readonly span: { from: string; to: string } | null;
  readonly stack: readonly { name: string; bytes: number }[];
  readonly authors: readonly { login: string; count: number }[];
  /** Commit subjects. Empty for private work, and the card explains why. */
  readonly work: readonly { date: string; subject: string }[];
}

const fromContribution = (c: Contribution, owner: string): Shared => ({
  key: c.name,
  name: c.name,
  /* a fork sits on the owner's account; what it came from is the upstream */
  owner: c.upstream?.split("/")[0] ?? owner,
  description: null,
  private: false,
  url: c.url,
  share: c.share,
  commits: c.commits,
  excluded: c.excluded,
  span: c.span,
  stack: c.stack,
  authors: c.authors,
  work: c.work,
});

const fromExternal = (e: External): Shared => ({
  key: `${e.owner}/${e.name}`,
  name: e.name,
  owner: e.owner,
  description: e.description,
  private: e.private,
  url: e.url,
  share: e.share,
  commits: e.commits,
  excluded: e.excluded,
  span: e.span,
  stack: e.stack,
  authors: e.authors,
  work: [],
});

/**
 * How long the work ran, short enough for one line of a spec cell.
 *
 * A date range is the obvious thing to print and it does not fit. "2026-07-28
 * → 2026-08-17" wrapped, and a wrapped cell made the spec grid 152px against
 * the vault card's 130px, which pushed the stack tags out through the bottom
 * of a face the vault card fits comfortably. A duration is always short, is
 * arguably the more useful figure on a card front, and the exact dates are on
 * the back where there is room.
 */
function worked(span: { from: string; to: string } | null): string {
  if (span === null) return "—";
  const days = Math.round(
    (Date.parse(span.to) - Date.parse(span.from)) / 86_400_000,
  );
  if (days <= 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

/** A 0–100 reading for a meter, guarding the empty case. */
const pct = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/** One meter row, matched to the vault card's axis rows. */
function Meter({ label, value, read }: { label: string; value: number; read: string }) {
  return (
    <li className="back__axis">
      <span className="label back__axisName">{label}</span>
      <span className="meter meter--gold" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} data-on={i < Math.round((value / 100) * 16)} />
        ))}
      </span>
      <span className="t-data back__axisVal">{read}</span>
    </li>
  );
}

function SharedCard({ s, me }: { s: Shared; me: string }) {
  const [flipped, setFlipped] = useState(false);
  const ref = useRef<HTMLLIElement | null>(null);
  const { award } = useProgress();

  const others = s.authors.filter((a) => a.login.toLowerCase() !== me.toLowerCase());
  /*
   * One word, because the vault band is one word. "Private · contribution"
   * wrapped the band to two lines, which took 17px off the body and was a
   * third of the reason these cards overflowed.
   */
  const kind = s.private ? "Private" : "Contribution";

  /*
   * The front needs a sentence where a vault card carries its thesis. A fork
   * has no description, so one is computed from the arithmetic rather than
   * written — the same rule as everywhere else on this page.
   */
  const lede =
    s.description ??
    `${s.commits.substantive} substantive commit${s.commits.substantive === 1 ? "" : "s"} in a repository owned by ${s.owner}.`;

  const onMove = useCallback((event: React.PointerEvent<HTMLLIElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  const flip = useCallback(() => {
    setFlipped((prev) => !prev);
    award(`inspect:${s.key}`, XP_AWARDS.inspect);
  }, [award, s.key]);

  return (
    <li
      ref={ref}
      className="vault"
      data-flipped={flipped}
      onPointerMove={onMove}
      style={{
        /*
         * The oxide, not a band token. A rarity colour across the top of a
         * card carrying no rank would be the one misreading this whole
         * section exists to prevent.
         */
        ["--class" as string]: "var(--oxide)",
        color: "var(--oxide)",
      }}
    >
      <div className="vault__inner">
        {/* ── front ────────────────────────────────────────────────────── */}
        <div className="vault__face" aria-hidden={flipped}>
          <button
            type="button"
            className="vault__flip"
            onClick={flip}
            tabIndex={flipped ? -1 : 0}
            aria-label={`${s.name} — turn the card over for the authorship`}
          />
          <span className="vault__foil" aria-hidden="true" />

          <div className="band">
            <span>{kind}</span>
            <span title="Share of the commit graph with my name on it">{s.share}% mine</span>
          </div>

          <div className="vault__body">
            <div className="vault__head">
              <span
                className="flex items-center justify-center border"
                style={{ borderColor: "currentColor", padding: "5px", lineHeight: 0 }}
              >
                {/* where a vault card carries its instrument sigil. No
                    instrument ran here, so the mark is a plain one. */}
                <span aria-hidden="true" style={{ fontSize: "11px", lineHeight: 1 }}>
                  {s.private ? "◈" : "◇"}
                </span>
              </span>
              <span className="label" style={{ color: "var(--oxide)", letterSpacing: "0.16em" }}>
                {s.private ? "Private repository" : "Shared repository"}
              </span>
            </div>

            <p className="label mt-2" style={{ color: "var(--ink-faint)" }}>
              {s.owner}/{s.name}
            </p>

            <h3 className="t-display mt-2" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
              {s.name}
            </h3>

            <p className="t-thesis vault__thesis mt-2">{lede}</p>

            {/*
              * Where a vault card prints the survey's strongest sentences. The
              * commit graph used to sit here and it does not fit: 167 cells in
              * a 248px card is six rows of them, which pushed the stack tags
              * out through the bottom of a fixed-height face. It belongs on the
              * back, which scrolls — and the front of a vault card carries no
              * chart either, which is the whole point of matching it.
              */}
            <p className="t-data vault__claims mt-2">
              {s.excluded.merges} merges and {s.excluded.boilerplate} boilerplate commit
              {s.excluded.boilerplate === 1 ? "" : "s"} do not count as authored change.
            </p>

            <dl className="spec mt-3">
              {/* every value one line: a wrapped cell is what overflowed the
                  face, and the exact dates are on the back */}
              <div>
                <dt>Mine</dt>
                <dd>
                  {s.commits.mine}/{s.commits.total}
                </dd>
              </div>
              <div>
                <dt>Substantive</dt>
                <dd>{s.commits.substantive}</dd>
              </div>
              <div>
                <dt>Worked</dt>
                <dd>{worked(s.span)}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{s.owner}</dd>
              </div>
            </dl>

            <div className="vault__tags mt-3">
              {s.stack.slice(0, 3).map((t) => (
                <span key={t.name} className="tag">
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          <div className="vault__foot">
            <span>▸ Tap to inspect</span>
            {/*
              * One short word, where a vault card names its instrument.
              * "NOT RANKED" wrapped the foot to two lines — 48px against the
              * vault's 31 — which was the last of the overflow. Nothing is
              * lost by shortening it: the back says it in full, and so does
              * the heading above the grid.
              */}
            <span style={{ color: "var(--oxide)" }}>{s.private ? "PRIVATE" : "SHARED"}</span>
          </div>
        </div>

        {/* ── back: the authorship, where a vault card has its assay ────── */}
        <div className="vault__face vault__face--back" aria-hidden={!flipped} onClick={flip}>
          <button
            type="button"
            className="dossier-band vault__close"
            tabIndex={flipped ? 0 : -1}
            aria-label={`Close the dossier for ${s.name}`}
          >
            <span>Dossier</span>
            <span>{s.private ? "Private" : "Shared"}</span>
          </button>

          <div className="vault__body vault__scroll">
            <h3 className="t-display" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
              {s.name}
            </h3>

            <p className="t-data back__lede">{lede}</p>

            {/*
              * One cell per commit in the repository, lit for the ones with my
              * name on them. The bar IS the count — there is no separate
              * figure being illustrated. Capped only so a very long graph
              * cannot run away down the panel.
              */}
            <div className="contrib-card__graph" aria-hidden="true">
              {Array.from({ length: Math.min(s.commits.total, 180) }, (_, i) => (
                <span key={i} data-mine={i < s.commits.mine} />
              ))}
            </div>

            {/* the commit graph's own words, where there are any to quote */}
            {s.work.length > 0 && (
              <p className="t-data back__quote">
                {s.work.slice(0, 4).map((w) => w.subject).join(" · ")}
              </p>
            )}

            <div className="back__caveat">
              <p className="t-data">
                <strong>Not ranked, and not mine.</strong> {s.owner} owns this; {s.share}% of the
                commit graph carries my name. The engine is never run against shared work — a
                composite on a repository somebody else mostly wrote would be a number about them.
              </p>

              {s.private && (
                <p className="t-data mt-2">
                  <strong>The commit subjects are counted, not quoted.</strong> Every public card
                  here prints them verbatim. In a repository that is not mine and not public they
                  are the most revealing thing in it, so the arithmetic is published and the
                  wording is not — and there is no link, because one that fails for every visitor
                  is worse than none.
                </p>
              )}
            </div>

            <div className="vault__tags back__tags">
              {s.stack.slice(0, 4).map((t) => (
                <span key={t.name} className="tag">
                  {t.name}
                </span>
              ))}
            </div>

            {/*
              * Where the vault card shows five axes, this shows the two
              * ratios that mean something here.
              *
              * There were three. The third was "alongside", filled to the
              * proportion of authors who are not me — which rendered as a
              * 67% bar next to the words "2 others" and invited exactly the
              * misreading this page exists to avoid. Who else was in it is a
              * list, not a ratio, and it is in the note below.
              */}
            <ul className="back__axes">
              <Meter
                label="mine"
                value={s.share}
                read={`${s.commits.mine}/${s.commits.total}`}
              />
              <Meter
                label="substantive"
                value={pct(s.commits.substantive, s.commits.mine)}
                read={`${s.commits.substantive}/${s.commits.mine}`}
              />
            </ul>

            <p className="margin-note mt-3">
              Worked {s.span ? `${s.span.from} → ${s.span.to}` : "on no dated commit"}.{" "}
              {s.excluded.merges} merges and {s.excluded.boilerplate} boilerplate commit
              {s.excluded.boilerplate === 1 ? "" : "s"} do not count as authored change. Worked
              with {others.map((a) => `${a.login} (${a.count})`).join(", ") || "nobody else"}.
            </p>

            <p className="margin-note mt-2">
              Repository stack (all authors):{" "}
              {s.stack.slice(0, 3).map((t) => `${t.name} ${kb(t.bytes)}`).join(" · ")}. Not a claim
              about which of them I wrote.
            </p>

            <p className="back__sum t-data">
              {s.commits.mine} of {s.commits.total} commits mine → {s.share}% · not ranked
            </p>
          </div>

          <div className="vault__foot">
            <button type="button" className="vault__closeText" tabIndex={flipped ? 0 : -1}>
              ▸ Tap to close
            </button>
            {s.url ? (
              <a
                className="vault__code"
                href={s.url}
                rel="noreferrer noopener"
                target="_blank"
                tabIndex={flipped ? 0 : -1}
                onClick={(event) => event.stopPropagation()}
              >
                Code ↗
              </a>
            ) : (
              <span className="vault__code" style={{ color: "var(--ink-faint)" }}>
                Private — no link
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function ContributionStrip({ data, ext }: { data: Data; ext: ExternalFile | null }) {
  const published = data.contributions.filter((c) => c.published);
  const rejected = data.contributions.filter((c) => !c.published);
  const { minSubstantiveCommits, minSharePercent } = data.thresholds;
  const externals = ext?.external ?? [];

  if (data.contributions.length === 0 && externals.length === 0) return null;

  /*
   * One grid, both sources. They were two sections with two grids, which made
   * the fork and the repository-on-another-account look like different kinds
   * of thing. They are the same kind of thing: a share of work that is mostly
   * somebody else's. What separates them is where the figures came from, and
   * that is said in the paragraph rather than drawn in the layout.
   */
  const cards: Shared[] = [
    ...published.map((c) => fromContribution(c, data.owner)),
    ...externals.map(fromExternal),
  ].sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));

  const unverifiable = externals.length;

  return (
    <div className="contrib-strip">
      <div className="header-rule mb-3">
        <span className="t-pixel" style={{ color: "var(--oxide)" }}>
          Contributed to
        </span>
        <span className="label">Not ranked · {cards.length} repositories</span>
      </div>

      <p className="t-body mb-5" style={{ maxWidth: "68ch" }}>
        Work that is not mine to rank. The engine is never run against these — a composite on a
        repository somebody else mostly wrote would be a number about them. What is computed
        instead is how much of the commit graph is mine. A commit counts when it has one parent and
        is not boilerplate: a merge is no authored change, and neither is
        &ldquo;Initial commit&rdquo;. Forks on my own account publish at {minSubstantiveCommits}{" "}
        such commits and {minSharePercent}% of the graph.
      </p>

      {unverifiable > 0 && ext !== null && (
        /*
         * The caveat that cannot be folded into the cards.
         *
         * Everything else on this page is recomputed from files a stranger can
         * fetch, and that is the site's entire argument. These were read from
         * repositories a visitor cannot open. Letting them sit unremarked
         * among the rest would quietly weaken the claim the whole page makes,
         * so the difference is stated once, above the grid, in full.
         */
        <p className="t-body mb-5" style={{ maxWidth: "68ch", color: "var(--ink-muted)" }}>
          <strong>
            {unverifiable} of these are the only figures on this page you cannot check yourself.
          </strong>{" "}
          They live on a collaborator&rsquo;s account, and the survey cannot find them — there is
          no endpoint that lists every repository a person has contributed to, and for a private
          one there could not be. So they are named by hand in{" "}
          <code>pipeline/content/external.json</code> and were read from the commit graph on{" "}
          {ext.generated.slice(0, 10)} by someone who can open them. The share is counted exactly
          as every other share here is; you are taking the reading on trust, which is the one
          thing the rest of this site is built to avoid asking.
        </p>
      )}

      {cards.length > 0 ? (
        <ol className="vault-grid">
          {cards.map((s) => (
            <SharedCard key={s.key} s={s} me={data.owner} />
          ))}
        </ol>
      ) : (
        <p className="t-data" style={{ color: "var(--ink-faint)" }}>
          No shared repository clears the bar. Nothing is promoted to fill the space.
        </p>
      )}

      {rejected.length > 0 && (
        <p className="margin-note mt-4">
          Below the bar, and listed rather than hidden:{" "}
          {rejected.map((c) => `${c.name} (${c.commits.substantive} substantive, ${c.share}%)`).join(", ")}.
          A filter you cannot see is a filter you cannot check.
        </p>
      )}
    </div>
  );
}

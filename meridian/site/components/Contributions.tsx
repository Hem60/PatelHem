/**
 * Contributions — a strip inside the vault, not a plate of its own.
 *
 * Shared repositories the catalogue excludes, because scoring somebody else's
 * repository as if it were yours is the one thing this site exists not to do.
 * They belong beside the projects rather than in a section of their own: a
 * reader looking at the work should see all of it, with the ownership stated.
 *
 * These cards deliberately carry NO rarity band and NO composite. A rank here
 * would be a rank on work that is mostly other people's — the engine is never
 * run against them. What they carry instead is the arithmetic of authorship.
 *
 * Nothing here is authored. The detail under each card is the commit subjects,
 * verbatim from the graph.
 */
import type { Contributions as Data, Contribution } from "@/lib/contributions";

/** Bytes → a short label. The repository's stack, never the contribution's. */
function kb(bytes: number): string {
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

function ContributionCard({ c, owner }: { c: Contribution; owner: string }) {
  const others = c.authors.filter((a) => a.login.toLowerCase() !== owner.toLowerCase());

  return (
    <li className="contrib-card">
      {/* where a vault card carries its rarity band, this carries its share */}
      <div className="contrib-card__band">
        <span>Contribution</span>
        <span>{c.share}% mine</span>
      </div>

      <div className="contrib-card__body">
        <p className="label" style={{ color: "var(--ink-faint)" }}>
          Shared repository
        </p>

        <h3 className="t-display mt-2" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
          {c.name}
        </h3>

        {/*
          * One cell per commit in the repository, lit for the ones with my
          * name on them. The bar IS the count — there is no separate figure
          * being illustrated.
          */}
        <div className="contrib-card__graph mt-3" aria-hidden="true">
          {Array.from({ length: c.commits.total }, (_, i) => (
            <span key={i} data-mine={i < c.commits.mine} />
          ))}
        </div>

        <p className="t-data contrib-card__count">
          <strong>{c.commits.substantive}</strong> substantive of {c.commits.mine} mine of{" "}
          {c.commits.total}
        </p>
        <p className="margin-note">
          {c.excluded.merges} merges and {c.excluded.boilerplate} boilerplate commit
          {c.excluded.boilerplate === 1 ? "" : "s"} do not count as authored change.
        </p>

        <dl className="spec mt-3">
          <div>
            <dt>Worked</dt>
            <dd>{c.span ? `${c.span.from} → ${c.span.to}` : "—"}</dd>
          </div>
          <div>
            <dt>Alongside</dt>
            <dd>{others.map((a) => `${a.login} (${a.count})`).join(", ") || "—"}</dd>
          </div>
        </dl>

        <p className="label mt-3" style={{ color: "var(--oxide)" }}>
          What the commits say
        </p>
        <ul className="contrib-card__work">
          {c.work.map((w, i) => (
            <li key={`${w.date}-${i}`}>{w.subject}</li>
          ))}
        </ul>

        {/*
          * The caveat that keeps this honest: a shared repository's language
          * map is every author's work, and most of this one is not mine.
          */}
        <p className="margin-note mt-3">
          Repository stack (all authors): {c.stack.slice(0, 3).map((s) => `${s.name} ${kb(s.bytes)}`).join(" · ")}.
          Not a claim about which of them I wrote.
        </p>
      </div>

      <div className="contrib-card__foot">
        <span>Not ranked — the engine is never run against shared work</span>
        <a href={c.url} rel="noreferrer noopener" target="_blank" className="contrib-card__link">
          View code ↗
        </a>
      </div>
    </li>
  );
}

export function ContributionStrip({ data }: { data: Data }) {
  const published = data.contributions.filter((c) => c.published);
  const rejected = data.contributions.filter((c) => !c.published);
  const { minSubstantiveCommits, minSharePercent } = data.thresholds;

  if (data.contributions.length === 0) return null;

  return (
    <div className="contrib-strip">
      <div className="header-rule mb-3">
        <span className="t-pixel" style={{ color: "var(--oxide)" }}>
          Contributed to
        </span>
        <span className="label">Not ranked · {published.length} of {data.contributions.length}</span>
      </div>

      <p className="t-body mb-5" style={{ maxWidth: "68ch" }}>
        Work that is not mine to rank. The engine is never run against these — a composite on a
        repository somebody else mostly wrote would be a number about them. What is computed
        instead is how much of the commit graph is mine. A commit counts when it has one parent and
        is not boilerplate: a merge is no authored change, and neither is
        &ldquo;Initial commit&rdquo;. These publish at {minSubstantiveCommits} such commits and{" "}
        {minSharePercent}% of the graph.
      </p>

      {published.length > 0 ? (
        <ol className="contrib-grid">
          {published.map((c) => (
            <ContributionCard key={c.name} c={c} owner={data.owner} />
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

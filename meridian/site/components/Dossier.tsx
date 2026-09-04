/**
 * The dossier — the identity table and the skill set, plate 02's right column.
 *
 * Matched to the reference build's panel: a ruled key/value table over a set of
 * grouped tag rows. The structure is his; the content is computed.
 *
 * That distinction is the point. His table is typed, and so is his "what he
 * works with" list — twelve groups of tags nobody can check. Here:
 *
 *   STUDYING     read out of the record strand's education entries
 *   FOCUS        the catalogue's own dominant language and domains
 *   CATALOGUED   entry count and mean composite, from the engine
 *   MEASURED     languages GitHub reports, with the repositories behind each
 *
 * Only NAME, HANDLE and STATUS are constants, and STATUS is the one line on
 * the panel a reader has to take on trust. The authored skill rows are labelled
 * authored and carry their evidence, which is what content/skills.json requires
 * of them.
 */
import type { Catalogue } from "@/lib/catalogue";
import type { RecordEntry, Skill } from "@/lib/content";
import { OWNER, STATUS } from "@/lib/owner";
import { span } from "@/lib/format";

/**
 * The panel's rows, in print order.
 *
 * Twelve groups, the same shape as the reference build's. A group with nothing
 * in it prints nothing rather than a placeholder — the density of this panel
 * should track what the account can actually show, so an empty row is
 * information and a padded one is not.
 */
const GROUPS: { kind: Skill["kind"]; label: string }[] = [
  { kind: "language", label: "Languages" },
  { kind: "agentic", label: "Agentic coding" },
  { kind: "ai", label: "AI & retrieval" },
  { kind: "ml", label: "Machine learning" },
  { kind: "evaluation", label: "Evaluation" },
  { kind: "backend", label: "Backend" },
  { kind: "frontend", label: "Front end" },
  { kind: "data", label: "Data" },
  { kind: "quality", label: "Quality" },
  { kind: "ops", label: "Ops" },
  { kind: "domain", label: "Domains" },
  { kind: "practice", label: "Practices" },
  { kind: "tool", label: "Tooling" },
];

/** Languages GitHub reports, commonest first, with what evidences each. */
function measured(cat: Catalogue): { name: string; repos: string[] }[] {
  const map = new Map<string, string[]>();
  for (const entry of cat.entries) {
    for (const lang of entry.stack) {
      map.set(lang, [...(map.get(lang) ?? []), entry.name]);
    }
  }
  return [...map]
    .map(([name, repos]) => ({ name, repos }))
    .sort((a, b) => b.repos.length - a.repos.length || a.name.localeCompare(b.name));
}

export function Dossier({
  cat,
  record,
  skills,
}: {
  cat: Catalogue;
  record: RecordEntry[];
  skills: Skill[];
}) {
  const langs = measured(cat);
  const mean =
    cat.entries.reduce((sum, e) => sum + e.composite, 0) / Math.max(1, cat.entries.length);

  /*
   * In-progress education, from the record strand. "In progress" is measured
   * against the last observing run rather than a live clock — the same rule
   * the career log's chip follows, so the two cannot disagree.
   */
  const studying = record.filter(
    (e) => e.kind === "education" && e.until !== undefined && e.until > cat.generated.slice(0, 7),
  );

  const topDomains = skills
    .filter((s) => s.kind === "domain")
    .slice(0, 2)
    .map((s) => s.name.toLowerCase());

  /* `noUncheckedIndexedAccess` is on, so the head of the list is checked once
     here rather than at each use */
  const top = langs[0];

  const rows: { key: string; value: React.ReactNode; computed: boolean }[] = [
    { key: "name", value: OWNER.name, computed: false },
    { key: "handle", value: `github.com/${OWNER.handle}`, computed: false },
    {
      key: "focus",
      value: top ? `${top.name} — ${topDomains.join(", ") || "engineering"}` : "engineering",
      computed: true,
    },
    {
      key: "studying",
      value:
        studying.length > 0
          ? studying.map((e) => `${e.title} · ${span(e.date, e.until)}`).join(" · ")
          : "Nothing in progress in the record strand",
      computed: true,
    },
    {
      key: "catalogued",
      value: `${cat.entries.length} repositories · ${mean.toFixed(1)} mean composite`,
      computed: true,
    },
    { key: "status", value: STATUS, computed: false },
  ];

  return (
    <div className="dossier">
      <dl className="dossier__table">
        {rows.map((r) => (
          <div key={r.key} className="dossier__row">
            <dt className="label">{r.key}</dt>
            <dd className="t-data">
              {r.value}
              {r.computed ? (
                <span className="dossier__mark" title="Computed at build time from the catalogue">
                  {" "}
                  ·{" "}computed
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {/* the one group on the panel that is a reading, not a claim */}
      <p className="dossier__head">Languages, as GitHub reports them</p>
      <div className="dossier__group">
        <span className="label dossier__key">measured</span>
        <div className="dossier__tags">
          {langs.map((l) => (
            <span
              key={l.name}
              className="tag"
              title={`${l.repos.length} of ${cat.entries.length}: ${l.repos.join(", ")}`}
            >
              {l.name}
              <span className="dossier__count">{l.repos.length}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="dossier__head">What the work is made of</p>
      {GROUPS.map((g) => {
        const inGroup = skills.filter((s) => s.kind === g.kind);
        if (inGroup.length === 0) return null;
        return (
          <div key={g.kind} className="dossier__group">
            <span className="label dossier__key">{g.label}</span>
            <div className="dossier__tags">
              {inGroup.map((s) => (
                <span
                  key={s.name}
                  className="tag"
                  data-source={s.source}
                  title={s.evidence}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {/*
        * The legend is not decoration. Half these tags are corroborated by a
        * repository and half are the author's word, and a panel that renders
        * both identically is quietly asserting they are the same kind of
        * claim. The dashed border is the whole difference.
        */}
      <p className="margin-note dossier__foot">
        <span className="tag" data-source="catalogue">solid</span> — evidenced by a repository the
        survey reads, and the evidence names it.{" "}
        <span className="tag" data-source="resume">dashed</span> — stated on the resume, which the
        catalogue cannot corroborate. Hover any tag for the line behind it. Both rules are enforced
        by the test suite, not by good intentions.
      </p>
    </div>
  );
}

/**
 * Signal — plate 10, the close.
 *
 * Two columns, matched to the reference build's contact plate: a serif lead,
 * a paragraph, the areas worth writing about, and a primary button. The
 * contact rows sit opposite as a ruled table.
 *
 * The reference opens this plate on its own large headline. This one does not:
 * the section already carries a title from its SectionHead, and a second
 * heading under it repeated the same idea and put two `h2`s in one section.
 *
 * The dossier panel that used to sit here is gone from this section — a link
 * to a JSON file is not a way to reach a person, and putting it beside the
 * email diluted both. It survives in the colophon, next to the rest of the
 * provenance, which is where a reader looking for it would go.
 *
 * The areas are read off the skill set rather than typed, so this section
 * cannot drift from the panel three plates above it.
 */
import { OWNER, STATUS } from "@/lib/owner";
import type { Catalogue } from "@/lib/catalogue";
import type { Skill } from "@/lib/content";
import { Observed } from "./Calibration";
import { SectionHead } from "./Plate";

/** How each contact row is labelled and rendered. */
const ROWS = [
  { key: "email", label: "Email", href: (o: typeof OWNER) => `mailto:${o.email}`, text: (o: typeof OWNER) => o.email },
  { key: "github", label: "GitHub", href: (o: typeof OWNER) => o.github, text: (o: typeof OWNER) => `github.com/${o.handle}` },
  { key: "linkedin", label: "LinkedIn", href: (o: typeof OWNER) => o.linkedin, text: () => "in/hem-patel" },
] as const;

export function Hailing({ cat, skills }: { cat: Catalogue; skills: Skill[] }) {
  /*
   * What is worth writing about, taken from the skill set's domain and
   * practice strands. Typing a second list here would be a second thing to
   * keep true; this one changes when content/skills.json does.
   */
  const areas = skills
    .filter((s) => s.kind === "domain" || s.kind === "ml" || s.kind === "ai" || s.kind === "evaluation")
    .map((s) => s.name)
    .slice(0, 6);

  return (
    <Observed id="hailing" className="shell">
      <SectionHead plate="10" title="Signal" note="Contact" />

      <div className="signal">
        <div className="signal__say">
          {/*
            * No second headline here. The plate is already titled "Signal" by
            * its SectionHead, and a "Let's talk" beneath it was both a repeat
            * and a second `h2` inside one section — so the status line leads
            * instead, which is the thing a reader actually needs first.
            */}
          <p className="t-lead signal__lead">{STATUS}</p>

          <p className="t-body signal__body">
            Machine learning, retrieval, evaluation, backend — I am not fixed on one of them. If
            the work is near any of it, or just interesting, it is worth a conversation. I am also
            happy to be argued with about any number on this page: clone the repository, run the
            survey against the same account, and the engine will produce these figures again or
            produce different ones for a reason.
          </p>

          {areas.length > 0 && (
            <div className="signal__areas">
              {areas.map((a) => (
                <span key={a} className="tag">
                  {a}
                </span>
              ))}
            </div>
          )}

          <a className="btn btn--primary signal__cta no-underline" href={`mailto:${OWNER.email}`}>
            Write to {OWNER.name.split(" ")[0]}
          </a>
        </div>

        <dl className="signal__rows">
          {ROWS.map((r) => (
            <div key={r.key} className="signal__row">
              <dt className="label">{r.label}</dt>
              <dd className="t-data">
                <a href={r.href(OWNER)} rel="noreferrer noopener" target="_blank">
                  {r.text(OWNER)}
                </a>
              </dd>
            </div>
          ))}

          {/*
            * The one row that is not a person. Kept because it is the whole
            * posture of the site — a reader who disbelieves a figure can fetch
            * the file it came from — but set below the rule as a footnote
            * rather than as a fourth way to get in touch.
            */}
          <p className="margin-note signal__note">
            Every figure on this page is also served as JSON at{" "}
            <a href="/dossier.json">/dossier.json</a> — {cat.entries.length} entries, generated{" "}
            {cat.generated.slice(0, 10)}. It is the file the page renders from, not an export of it.
          </p>
        </dl>
      </div>
    </Observed>
  );
}

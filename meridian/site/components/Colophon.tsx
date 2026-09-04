/**
 * Colophon.
 *
 * States how the page is built and — the part most colophons skip — exactly
 * which parts of it are live and which are cached, and which sections of the
 * build are not finished yet. A page arguing that the record keeps itself has
 * to be the first thing on the site to tell the truth about its own state.
 */
import type { Catalogue } from "@/lib/catalogue";
import { OWNER } from "@/lib/owner";
import { stamp } from "@/lib/format";
import { Observed } from "./Calibration";
import { Lattice } from "./Lattice";

const PROVENANCE = [
  {
    what: "Ranks, axis readings, class states",
    how: "Computed",
    detail: "Pure scoring function, 54 unit tests, no clock and no network. Re-derivable from a clone.",
  },
  {
    what: "Entry sentences and facts",
    how: "Templated",
    detail: "Hard-coded templates bound to measured signals, each clause verified against a path that resolves.",
  },
  {
    what: "Figures on this page",
    how: "Cached",
    detail: "Read from pipeline/data/catalogue.json at build time — the last observing run, not a request made just now.",
  },
  {
    what: "The observing run",
    how: "Live",
    detail:
      "Real requests to api.github.com, made when you press dispatch. Latencies are measured around each request, cached reads are labelled cached, and the footer reconciles the estimate against what was spent.",
  },
  {
    what: "The constellation's edges",
    how: "Computed",
    detail:
      "An edge means the narrower capability never appears in this account without the broader one. Derived from the catalogue, reduced to immediate links, redrawn every build.",
  },
  {
    what: "Thesis lines and the record strand",
    how: "Written",
    detail: "By hand, in prose.json and content/. The only sentences on the site a person authored.",
  },
];

export function Colophon({ cat }: { cat: Catalogue }) {
  return (
    <Observed as="footer" id="colophon" className="colophon">
      <div className="shell colophon__copy">
      <div className="spread">
        <div className="lg:col-span-5 lg:pr-10">
          <p className="eyebrow">Colophon</p>
          <p className="t-body mt-3">
            <strong>No model was called to render this page, and no rank on it was typed by hand.</strong>{" "}
            There is no AI SDK in the dependency tree, no API key, and no billing account behind
            any number here. The instruments are deterministic programs that make real GitHub API
            calls — press dispatch in the observing run and watch them in your own network tab —
            and the prose comes from templates that fire only when their evidence is present.
          </p>
          <p className="t-body mt-4" style={{ fontSize: "var(--t-base)" }}>
            Set in Pixelify Sans, Silkscreen, IBM Plex Mono and Instrument Serif. There is not a
            single image in the system — the ground is a flat field and every mark over it is CSS,
            which is also nothing to download. Contrast is checked in CI at every class colour on
            both exposures, and the build fails if a pair drops below its floor.
          </p>
          <p className="margin-note mt-4">
            Phases 00–05 built and passing · the catalogue and the constellation are rendered from
            the last observing run, and the run panel makes live calls on demand · the command
            line is not built yet, and is not linked from anywhere pretending otherwise.
          </p>
        </div>

        <div className="lg:col-span-7 lg:border-l lg:pl-6" style={{ borderColor: "var(--rule)" }}>
          <div className="header-rule mb-3">
            <span className="label">Provenance · what is live, what is cached</span>
          </div>
          <dl>
            {PROVENANCE.map((p) => (
              <div key={p.what} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b py-2.5" style={{ borderColor: "var(--rule)" }}>
                <dt className="t-data" style={{ fontSize: "var(--t-sm)" }}>
                  {p.what}
                </dt>
                <dd className="t-pixel" style={{ color: "var(--signal)" }}>
                  {p.how}
                </dd>
                <p className="margin-note col-span-2 mt-1">{p.detail}</p>
              </div>
            ))}
          </dl>

          <p className="margin-note mt-4">
            {OWNER.name} · github.com/{OWNER.handle} · catalogue generated {stamp(cat.generated)} ·
            survey runs on a button press, never on a schedule.
          </p>
        </div>
      </div>
    
      </div>

      {/* the same field as the hero, at the same pitch and the same density —
          it closes the page the way the hero opens it */}
      <div className="colophon__field" aria-hidden="true">
        <Lattice className="colophon__lattice" scale={1} />
      </div>
    </Observed>
  );
}

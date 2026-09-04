/**
 * The machine-readable dossier.
 *
 * Same data, same build, no second source of truth: the catalogue and the
 * revisions log exactly as the pipeline wrote them, plus the rubric the page
 * scores against so a reader can recompute a composite by hand and check it.
 */
import { catalogue, revisions } from "@/lib/catalogue";
import { AXES, BANDS } from "@/lib/bands";
import { OWNER } from "@/lib/owner";

export const dynamic = "force-static";

export function GET(): Response {
  const cat = catalogue();

  const body = {
    owner: { name: OWNER.name, handle: OWNER.handle, github: OWNER.github },
    generated: cat.generated,
    provenance: {
      ranks: "computed · pure scoring function, no clock, no network",
      prose: "templated · fires only when its evidence is present",
      figures: "cached · read from the last observing run at build time",
      model: "none · no AI SDK in the dependency tree",
    },
    rubric: {
      axes: AXES.map((a) => ({ axis: a.key, weight: a.weight, reads: a.gloss })),
      bands: BANDS.map((b) => ({ class: b.name, range: b.range })),
      hysteresis: {
        promote: "+2 points, held 2 consecutive runs",
        demote: "-3 points, held 3 consecutive runs",
        floor: "no class moves twice inside 30 days",
      },
    },
    entries: cat.entries,
    state: cat.state,
    revisions: revisions(),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

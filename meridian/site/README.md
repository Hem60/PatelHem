# @meridian/site — phases 03 · 04 · 05

The design system and the static plates. Next.js App Router, TypeScript strict,
Tailwind for layout only, Zod on every file the page reads.

Nothing here decides a rank. The site consumes what the pipeline wrote:
`../pipeline/data/catalogue.json`, `revisions.json` and `prose.json`, read at
build time and validated before a single component sees them.

```bash
npm run dev        # localhost:3000
npm run contrast   # the gate: 80 pairs, both exposures
npm test           # 84 tests
npm run typecheck
npm run build
npm run plates     # regenerate the two survey rasters (deterministic)
```

## What is built

| Section | id | Source |
|---|---|---|
| First Light | `first-light` | catalogue.json — readout, distribution, promotion tick |
| Parallax | `parallax` | two hand-written positions + one computed by `lib/machine.ts` |
| How to Read This Chart | `how-to-read` | the rubric, the ladder, the account's real means |
| The Observing Run | `observing-run` | live GitHub API calls, streamed over SSE |
| The Catalogue | `catalogue` | every entry, filterable, each with its score breakdown |
| The Constellation | `constellation` | `lib/evidence.ts` — radial capability graph |
| The Log | `log` | `content/log.json` (record) + revisions.json (revisions) |
| Hailing | `hailing` | contact + `/dossier.json` |
| Colophon | `colophon` | provenance: what is computed, templated, cached, written |
| The Reticle | — | persistent HUD: nav, glyphs, resolution meter, plate toggle, run stamp |

## The console

`lib/console.ts` is the whole command surface: pure functions over the
catalogue and the author-supplied record, returning lines.

```
whoami          who this is and what he does
projects        list the indexed builds
open <name>     open a project's repository
skills          top capabilities by level
education       degrees, in progress
awards          competitive results and appointments
find <query>    search everything on this page
contact         how to reach him
clear           clear the screen
```

Because the commands read the same data the sections render, the console
cannot report something the page does not — and `test/console.test.ts` pins
that: `projects` matches the published classes, `skills` cites a real
repository for every level, `open` hands back the entry's own URL, `contact`
prints the three real addresses, and `education` and `awards` print "Nothing
recorded" rather than inventing a line.

## The observing run

`GET /api/run?repo=<name>` streams server-sent events while five instruments
survey one repository. Almanac and Prism make real requests; Sextant, Herald
and Plumb are pure and the panel says so instead of dressing them up as
activity. Sextant runs the engine and Herald and Plumb are imported from
`@meridian/pipeline` — the console computes with the same code that publishes
the catalogue, not a parallel implementation.

- **Latencies are measured** around each `fetch`. Nothing is staged or delayed.
- **Cached reads are labelled cached** and show their disk time. The cache key
  is scoped by the repository's head SHA, so a repository that has moved gets a
  fresh read.
- **The header states the estimate** (10 calls) before dispatch; the footer
  states actual calls, network calls, cache hits, elapsed, and what the API
  says is left on the rate limit.
- **Targets are restricted** to catalogued repositories. An open box here would
  be an open proxy to the GitHub API on somebody else's rate limit.
- **Authentication is optional.** `GITHUB_TOKEN` raises the limit from 60/hour
  to 5,000/hour; without it the run still works and the panel reads
  `anonymous · 60/hr`. See `.env.example`.

The panel finishes by reconciling what it just computed against the published
entry, naming the only three things a drift can be: the repository changed, the
clock moved (cadence decays daily), or the anomaly axis read against an
approximated account context — a live run takes the account's language
distribution from the published catalogue rather than recollecting every
repository, and `lib/run/context.ts` declares that approximation rather than
hiding it.

## The constellation, and why its edges are safe to believe

`lib/evidence.ts` builds the graph from the catalogue alone:

- **Nodes** are capabilities. Practices are detected from the sentences Herald
  published, keyed to Herald's own template ids; languages come from the
  measured language map, never from prose. Node radius is evidence weight —
  how many repositories demonstrate it.
- **Edges** are computed containment. `A → B` means *every repository
  evidencing B also evidences A* — B has never appeared here without it. The
  relation is then transitively reduced, so only immediate links are drawn.
- **Rings** are depth in that graph, so broad capabilities sit near the centre
  and single-repository ones sit at the rim.

A hand-authored taxonomy would happily assert "CI requires tests" while
`IRIS-PREDICTOR` runs CI with no test suite. This one cannot: the edge only
exists while the evidence does. `test/evidence.test.ts` re-derives every edge
from the raw supports and fails if one is unsupported, mediated, or cyclic —
and `unmatchedClaims()` fails the build if the pipeline publishes a sentence no
detector recognises, so a wording change in Herald surfaces as a red build
rather than a quietly thinning graph.

## Matched to the reference build

Direction changed 2026-08-28: the brief is now to match PAVAN//FOUNDRY in look
and structure, with Hem's own data and identity. The specification is
`../FOUNDRY-MATCH.md`, measured off the live site. His identity is never
copied — not the wordmark, the name, the education, or the personal claims.

Done so far: his token system, his four typefaces (Pixelify Sans, Silkscreen,
IBM Plex Mono for body *and* data, Instrument Serif for leads), the plate head
device, his section order and vocabulary, the single-bar HUD with instrument
sigils and an XP meter, and vault cards with rarity bands, pointer foil and a
flip to the score arithmetic.

## Superseded: separation from the reference build

Four devices were pulled back deliberately after a side-by-side review, because
they had drifted into the reference build's furniture:

- **No "plate" in visible copy.** `PLATE 01`, `PLATE 07` are his section
  markers. `--plate` survives as an internal token name; nothing a visitor
  reads uses the word. The exposure toggle says Night / Day.
- **No numbered section heads.** `NN · TITLE ————` is his device. The section
  designation is a sky coordinate rotated into the gutter (`.section-mark`),
  and the title stands alone.
- **The chrome is split in two.** Identity and index on the top edge; the
  readings — field, last run, object count, resolution — on a bottom
  instrument strip. One top bar carrying logo, nav, glyph row, meter and
  toggle is his HUD's exact composition.
- **No instrument glyph row.** Five icons reading "idle" were decoration
  impersonating telemetry, and they echoed his six operative glyphs. They come
  back in phase 05 only if they carry real call counts.

Kept deliberately: the segmented meter and the dithered value bars. The plan
takes those two ideas from the reference on purpose and revalues them — ours
are driven by measured readings rather than by an XP total.

## The spread

Sections are laid on a twelve-column grid with no column gap (`.spread` in
`app/globals.css`), so plates butt against each other and share a hairline
(`.butt` pulls the right-hand plate back a pixel) instead of floating as
separate cards. Widths are deliberately unequal — 7/5 at First Light, 9/3 at
the distribution, 8/4 at the constellation, 5/7 at the log — because a page
where every block is the same width has stacking, not composition.

Marginalia live in a real gutter column (`.gutter`, `components/Marginalia.tsx`):
a numbered marker in the prose, the same number in the notes column level with
the claim it qualifies. In the catalogue, card width follows rank — the
strongest reading takes eight columns, the next four butted against it, the
rest run in butted pairs — so re-ranking by an axis recomposes the page.

Below 64rem the whole grid collapses to one column and the notes stack under
the block they annotate. Asymmetry on a phone is just a narrow column with
wasted margins.

## The design system

`styles/tokens.css` is the single source of truth for colour. Two exposures —
night plate and day plate — designed separately rather than inverted, each with
its own sky, plate stock and six class values. `scripts/contrast.mjs` parses
that file directly, composites the translucent rules over their ground, and
fails the build if any pair drops below its floor (4.5 for text, 3.0 for
rules). What CI checks is what ships.

`styles/type.css` holds the four faces and the scale. Two notes that cost an
afternoon each:

- **Handjet needs `ELSH` ≥ 2.** `ELSH 0` is a degenerate element that carries
  an advance width and no ink, so labels lay out perfectly and render blank.
- **The pixel face has a size floor of 15px.** Below that the element grid
  falls under one device pixel and the label disappears.

`styles/layers.css` is layers 00–12 from the plan, in order, with the fixed
values the plan specifies. Two rasters in the whole system, both generated by
`scripts/plate.mjs` from a fixed seed; every other layer is CSS.

## Honesty rules, as implemented

- The instrument glyphs in the Reticle read `idle`, not a call count. The
  runtime that would make those calls is phase 05.
- The hero says the revisions log is empty, because it is.
- Every figure is labelled cached in the Colophon, because it is read from the
  last observing run at build time rather than fetched on request.
- Calibration (1×–8×) buys decimal places on figures already on screen. It
  never reveals a section, unlocks a card, or awards a point.
- `lib/machine.ts` emits a sentence only when the measurement behind it exists,
  and prints that measurement underneath it.

## What needs a person

- `content/log.json` — the record strand is empty. Education, awards and
  appointments cannot be computed from a repository.
- `content/parallax.json` — the recruiter and engineer positions are drafts and
  should be replaced with the author's own words.
- `../pipeline/data/prose.json` — one thesis line per project. Four of five
  entries do not have one, and publish without one.

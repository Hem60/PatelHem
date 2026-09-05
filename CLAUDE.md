# Meridian

A self-classifying engineering portfolio for Hem Patel (github.com/Hem60).

Instruments read the owner's repositories, measure them on five fixed axes,
publish a catalogue, and revise it when the readings change.
**Thesis: the record keeps itself.** Nothing is self-reported — every rank is
computed, and every claim is checked against a file that exists.

Full plan: `meridianplan.html` (open in a browser; §15 is the master prompt).

## State

| Phase | Location | Status |
|---|---|---|
| 00 Calibrate | `meridian/phase00/` | ✅ gate PASSED — 3 of 6 bands, spread 49.9 |
| 01 Engine | `meridian/engine/` | ✅ 54 tests · CLI `score` `why` `ladder` |
| 02 Pipeline | `meridian/pipeline/` | ✅ 35 tests · six stages · manual workflow |
| 03 System | `meridian/site/` | ✅ contrast gate · tokens, both plates, layers 00–12 · First Light, Parallax, How to Read, Log, Hailing, Colophon, Reticle |
| 04 Catalogue | `meridian/site/` | ✅ catalogue with filters + score breakdowns · constellation |
| 05 Runtime | `meridian/site/` | ✅ 41 tests · SSE observing run · real GitHub calls, measured latencies, SHA-keyed cache |
| 06 Harden | — | a11y, performance (the console shipped early, with the match) |

**Phases 00–05 are built and passing. Do not rebuild them.**

Current catalogue (5 entries; forks and the profile repo are excluded):

```
vakil              EPIC      67.4   annotated
RAG-CHAT-BOT       UNCOMMON  39.9
IRIS-PREDICTOR     COMMON    33.0
MOVIE_RECOMMENDER  COMMON    22.3
webathon           COMMON    16.3
```

## Commands

```bash
cd meridian/engine   && npm test && node dist/cli.js score
cd meridian/engine   && node dist/cli.js why vakil
cd meridian/pipeline && npm test && node dist/cli.js run --dry-run
cd meridian/phase00  && node calibrate.mjs
cd meridian/site     && npm run contrast && npm test && npm run build   # 84 tests
cd meridian/site     && npm run dev          # localhost:3000
curl -sN "http://localhost:3000/api/run?repo=vakil"   # the observing run, streamed
```

The site reads `pipeline/data/*.json` at build time and decides nothing. The
contrast gate (`site/scripts/contrast.mjs`) parses `site/styles/tokens.css`
directly — 80 pairs across both exposures, including the rarity bands — and runs in `.github/workflows/site.yml`
before typecheck, tests and build.

The survey workflow is `.github/workflows/survey.yml` — `workflow_dispatch`
only, no cron. It runs when a button is pressed, never on a schedule. It
collects every public non-fork repository, scores it, publishes the catalogue,
drafts prose for anything unwritten, runs all three test suites, and commits
only when a reading moved. A new repository becomes a ranked card on the first
run that sees it; no code change is needed, and nothing gates an entry but
`!s.fork && s.name !== user`.

The vault displays the **top ten by composite**. The cut is display only —
`catalogue.json` and `/dossier.json` carry every entry, and the plate says how
many are below the line.

## Rules

**No language model in the measurement.** Every instrument is a deterministic
program making real GitHub API calls. Scores, axes, classes and ranks are
computed and reproducible: clone the repository, run the engine, get the same
numbers. Herald's sentences come from hard-coded templates bound to measured
signals, and a template fires only when its evidence is present. None of that
is negotiable, and no model touches any of it.

**One model, in one place, writing only words.** Changed 2026-09-05 at the
owner's instruction. `pipeline/scripts/draft.mjs` calls Groq to write a thesis
line and a short description for a repository nobody has written about yet.
The constraints that make it safe:

- It runs **after** the catalogue is published, reads `catalogue.json`, and
  writes only `prose.json`. It cannot alter an axis, a composite, a class or a
  rank. Delete the script and every number on the site is identical.
- It is prompted with **collected, checkable material only** — the owner's
  own GitHub description, the topics they tagged, the file paths in the
  default branch, Herald's verified sentences, and the recorded values. It is
  never given the contents of a file. (The first cut withheld the first three
  and the model refused every entry, correctly: `5 commits, written in HTML`
  cannot answer "what problem does this address" without inventing one.)
- It **never overwrites a hand-written line.** `source: "author"` is
  untouchable.
- Every drafted line is **labelled** `source: "groq"`, which reaches the
  catalogue, the card (marked ·D), and `dossier.json`. `annotated` still means
  hand-written and only hand-written, so the counts that say "hand-written"
  stay true.
- It is **change-gated** on a digest of the sentences behind it, so a survey
  where nothing moved makes zero requests.
- A draft containing an unverifiable claim — "production-ready", "widely
  used", a superlative — is **rejected, not edited** (`test/draft.test.ts`).
- The key lives in the `GROQ_API_KEY` Actions secret and is used **only inside
  the survey workflow**. The site ships no key and calls no model at runtime
  or at build time.
- The **model is discovered, not hard-coded** — Groq retires ids, and a stale
  name meant every draft returned `404 model_not_found` while the survey still
  reported success. `GROQ_MODEL` pins one; otherwise the script reads
  `/v1/models` and prints which it chose and why.

Thesis lines are still hand-written by the author in `prose.json`, and a
drafted line is a placeholder until one is.

**Scoring is pure.** No I/O, no clock — `now` is injected through
`ScoreContext`. This is what makes a published rank reproducible by anyone who
clones the repo. Collection is I/O and lives behind the `Signals` contract.

**Nothing claimed that is not checked.** Plumb verifies every factual clause
against a real path before an entry ships. Cached results are labelled cached.

**Match PAVAN//FOUNDRY** (`myselfpavan.vercel.app`) in look and structure.
Direction changed 2026-08-28 at the owner's instruction; the full specification
is `meridian/FOUNDRY-MATCH.md`, measured off the live build. Adopt his tokens,
his four typefaces (Pixelify Sans, Silkscreen, IBM Plex Mono, Instrument
Serif), his plate numbering, his section order, his card and HUD anatomy, and
the XP/level/recruit mechanics.

**Never copy his identity.** Not the PAVAN//FOUNDRY wordmark, not his name,
education, location or employer claims, not the Google defect filings, not his
operative names, quotes or project copy. Every fact on this page is Hem's and
computed. A cloned layout carrying someone else's credentials is a forgery, not
a portfolio.

## Three fixes that must not be undone

1. **Stability reads config from inside manifests** — `[tool.mypy]`,
   `[tool.ruff]`, `[tool.pytest]` in `pyproject.toml`, not only standalone
   dotfiles. Worth 28 points on `vakil`; without it the project reads RARE
   instead of EPIC.
2. **Primary language comes from the `languages` map**, not the nullable
   `language` field, which is null for very small repositories.
3. **Promotions are explained against `axesAtGrant`** — the snapshot taken
   when the class was granted — never against the previous run. Hysteresis
   lands the improvement one run *before* the class moves, so comparing to
   the last run reports no movement at all.

## Three rules that survive the match

Even while matching his look, these hold — they are the only reasons this page
is better than the one it copies:

1. **Ranks stay computed.** His band scores are authored numbers; ours come out
   of the engine, and the assay plate shows the arithmetic.
2. **The console stays real.** Never fake a latency or synthesise a transcript
   to match his pacing.
3. **Authorship stays computed** per repository, and shown.

## The constellation is computed, not authored

`site/lib/evidence.ts` derives the skill graph from the catalogue. An edge
`A → B` means every repository evidencing B also evidences A — computed
containment, transitively reduced. Do not replace it with a hand-written
dependency taxonomy: `IRIS-PREDICTOR` runs CI with no test suite, so
"CI requires tests" would be a claim the account's own data refutes.

Practice detection is keyed to Herald's template ids. If Herald's wording ever
changes, `unmatchedClaims()` fails the build rather than letting the graph
silently lose a node.

## The observing run is real or it is nothing

`site/lib/run/` makes actual requests to api.github.com. Every latency shown is
measured around a `fetch`; cached reads are labelled cached and show disk time.
Never stage a delay, never synthesise a transcript, never report a call that
was not made — the reference build was caught doing exactly that, and this
section exists to be the opposite. Sextant, Herald and Plumb are imported from
the engine and the pipeline rather than reimplemented, so the console computes
what the catalogue would publish.

A live run's anomaly axis reads an approximated account context (language
counts from the published catalogue, not a full recollection). That
approximation is declared in `lib/run/context.ts` and named on the page. Do not
quietly drop the caveat to make the drift look smaller.

## Phase 03 traps, already paid for

1. **Handjet `ELSH` must be ≥ 2.** At `ELSH 0` the pixel face lays out with
   correct advance widths and renders no ink — every chip and eyebrow goes
   blank while the DOM insists the text is visible.
2. **The pixel face has a 15px floor.** Below it the element grid drops under a
   device pixel and disappears.
3. **Client components must not import `lib/content.ts`** — it reads the
   filesystem. Identity and instrument constants live in `lib/owner.ts` for
   exactly that reason.
4. The display face is **Big Shoulders**; Google retired the name "Big
   Shoulders Display" when it became a superfamily.

## Attribution

Authorship is computed, never asserted. `WEBATHON2` is 29% yours (12/42
commits); `VortiFi` and `hashhawks-3d-showcase` are 0%. Do not write copy
implying sole authorship of shared work — the commit graph is one click away.

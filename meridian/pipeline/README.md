# @meridian/pipeline

Survey, diff, compose, revise, publish. **Manual trigger only.**

Covers R8 (the button), R9 (the automatic card) and R10 (the automatic
promotion) in one pipeline. You never ask for a card or a rank — you press
one button and the pipeline decides what is new, what moved, and what to
write.

## Run

```bash
npm install && npm run build
node dist/run.js --dry-run          # report the diff, write nothing
node dist/run.js                    # survey and publish
node dist/run.js --repo vakil       # one repository
node dist/run.js --data <raw.json>  # a different collection
```

## The six stages

| Stage | Does |
|---|---|
| `01 collect` | Read signals for every repository |
| `02 measure` | Five axes, no model involved |
| `03 diff` | New? moved? nothing? — **exits clean when nothing moved** |
| `04 compose` | Herald fills templates, Plumb verifies every claim |
| `05 revise` | Class changes become public revisions with a cause |
| `06 publish` | Write `catalogue.json` and `revisions.json` |

## Herald and Plumb

**Herald** is a fixed set of sentence templates, each bound to a measured
signal. No generation, no API. A template whose evidence is missing simply
does not fire, so every sentence it writes is true by construction. Each
template declares what it **cites**.

**Plumb** resolves those citations before a sentence is allowed onto a card:
a repository path must exist in the collected file tree, and a `signal:<name>`
citation must be present and non-empty. It is a file lookup, not a judgement.

The two must agree — a template should never write something Plumb rejects.
A test asserts exactly that, and another proves Plumb still bites when a
template outruns its evidence.

**What Herald cannot write is the thesis** — the line saying why a project
matters. You write that once per project in `data/prose.json`. A repository
without one still publishes, marked `annotated: false`, so a new project
appears without being asked for.

## Hysteresis, and explaining a promotion

A class moves only after the improvement holds: promote by clearing the
threshold by +2 for two consecutive runs, demote by falling 3 below it for
three, and never revoke a class within 30 days of granting it.

That creates a subtlety worth knowing about. The improvement usually lands
*one run before* the class moves, so comparing a promotion against the
previous run shows no movement at all — the first implementation produced
`stability 97.3 → 97.3`. State therefore snapshots `axesAtGrant` and
`compositeAtGrant` when a class is granted, and a revision is explained
against that snapshot:

```
VAKIL · EPIC → LEGENDARY · luminosity 47 → 95
  evidence: homepageStatus=200, readmeLength=10000, topics=10, releases=2
```

## Files

| File | Role |
|---|---|
| `src/catalogue.ts` | Entry, Revision, StateEntry, `dominantAxis` |
| `src/herald.ts` | The templates and the facts table |
| `src/plumb.ts` | Citation verification |
| `src/diff.ts` | What changed, and advancing class state |
| `src/compose.ts` | Herald + Plumb into one entry |
| `src/run.ts` | The six stages, `--dry-run`, `--repo` |
| `src/load.ts` | The collector JSON shape |
| `data/prose.json` | Your thesis lines. The one hand-written input. |

## The workflow

`.github/workflows/survey.yml` has a single trigger: `workflow_dispatch`,
with `repo` and `dry_run` inputs. **No cron, no push trigger.** It runs the
engine test suite before trusting its numbers, and commits only when
`pipeline/data` actually changed — so the history never fills with commits
saying nothing moved.

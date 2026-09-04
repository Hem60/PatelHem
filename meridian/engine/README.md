# @meridian/engine

Deterministic repository classification. Five axes, no language model.

The same signals always produce the same number, so every rank published on
the site can be reproduced by anyone who clones this package — and explained
on demand by `why`.

## Use

```bash
npm install
npm run build
npm test

node dist/cli.js score          # the catalogue as a table
node dist/cli.js why vakil      # the arithmetic behind one rank
node dist/cli.js why vakil -v   # including signals that scored zero
node dist/cli.js ladder         # the class thresholds
```

Reads `../phase00/out/raw.json` by default; override with `--data <path>`.

## Design

**Collection is I/O, scoring is pure.** `Signals` is the contract between
them. The engine never touches the network, never reads the clock — `now` is
injected through `ScoreContext` — and never calls a model. That is what makes
a published rank reproducible rather than merely asserted.

```
composite = 0.28·stability + 0.24·mass + 0.20·anomaly
          + 0.16·luminosity + 0.12·cadence
```

Stability outranks mass on purpose: a small well-tested project should beat a
large untested one. Stars sit inside luminosity, capped at 5 points, so
popularity can contribute but never carry a repository.

| Axis | Question |
|---|---|
| `stability` | Does it hold together? |
| `mass` | How much is actually there? |
| `anomaly` | How unusual is it? |
| `luminosity` | Can anyone else see it? |
| `cadence` | Is it alive? |

Every axis returns `parts` (what each sub-signal contributed) and `evidence`
(the raw values behind them), which is what `why` prints.

## Files

| File | Role |
|---|---|
| `src/signals.ts` | The contract. `Signals`, `ScoreContext`, result types. |
| `src/axes.ts` | The five axes, pure functions, one per question. |
| `src/classify.ts` | Thresholds, `classify`, `nextGate`, hysteresis. |
| `src/score.ts` | Weights, composition, authorship, catalogue membership. |
| `src/explain.ts` | `why` — formats the arithmetic. |
| `src/adapter.ts` | The only place phase 00's JSON shape is known. |
| `src/cli.ts` | `score`, `why`, `ladder`. |

## Hysteresis

A repo parked on 75.6 must not flip between EPIC and LEGENDARY on
consecutive runs. `transition()` is a pure function of state and score:

- **promote** — clear the threshold by +2, and hold it for 2 consecutive runs
- **demote** — fall below by −3, and hold that for 3 consecutive runs
- **floor** — never revoke a class within 30 days of granting it

`history` holds prior runs; the current score appends to it.

## Two findings pinned by tests

**Config lives inside manifests.** Reading `pyproject.toml` for `[tool.mypy]`
and friends, rather than only looking for standalone dotfiles, is worth 28
stability points on `vakil`. Without it the project scores 55.7 and reads as
RARE instead of EPIC.

**GitHub's `language` field is null for very small repositories.** Counting
primary languages from the `languages` map instead changes the distinctness
signal — it costs `IRIS-PREDICTOR` and `MOVIE_RECOMMENDER` 6 anomaly points
each relative to the phase 00 prototype. The map is the more accurate source.

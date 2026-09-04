# Meridian — phase 00, calibration

Reads the real account, computes the five axes from evidence, and reports
whether the class ladder discriminates. Nothing downstream may start until
it does.

## Run

```
node collect.mjs Hem60          # pull + cache raw signals -> out/raw.json
node calibrate.mjs              # score, distribution, verdict
node anchors.mjs owner/repo ... # score reference repos -> out/anchors.json
node anchor-report.mjs          # anchors vs vakil, one table
```

Auth comes from `gh` (already logged in as Hem60, `repo` scope).
Every API response is cached under `cache/`, so re-runs are free.
Delete `cache/` to force a refresh.

## Files

| File | Role |
|---|---|
| `gh.mjs` | Authenticated, disk-cached GitHub reads + `collectRepo` |
| `collect.mjs` | Every repo on an account |
| `anchors.mjs` | Named reference repos, for fixed points on the scale |
| `score.mjs` | The five axes. Deterministic. No model. |
| `calibrate.mjs` | Distribution, diagnostics, verdict, nearest gates |
| `anchor-report.mjs` | Anchors and yours in one table |

## Scoring

```
composite = 0.28·stability + 0.24·mass + 0.20·anomaly
          + 0.16·luminosity + 0.12·cadence
```

Every axis keeps `parts` (what each sub-signal contributed) and `evidence`
(the raw values), so `why <repo>` can print its own arithmetic.

## Detector note

Test, lint and type configuration is read from **inside** `pyproject.toml`
and `package.json`, not only from standalone dotfiles. Scoring the layout
instead of the project cost `vakil` 28 stability points before this was
fixed.

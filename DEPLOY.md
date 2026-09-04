# Deploying Meridian

The site is `meridian/site`, a Next.js app. It is not standalone: it imports
the scoring engine and the pipeline's Herald and Plumb from sibling packages,
and it reads `meridian/pipeline/data/*.json` at build time.

## Why there is a vercel.json at the root

Two things break a naive deploy, and both are handled by `vercel.json`:

1. **The site imports built output.** `lib/run/instruments.ts` imports
   `@meridian/pipeline/dist/herald.js` — a compiled file. `dist/` is
   gitignored, so it is not in the repository and does not exist on a fresh
   clone. The engine and the pipeline therefore have to be built *before* the
   site is, which is what `buildCommand` does, in that order.

2. **`file:` dependencies point at siblings.** `@meridian/engine` resolves to
   `file:../engine`, so the deploy has to run from the repository root with
   all three packages present, not from `meridian/site` alone. Hence the root
   `vercel.json` and `outputDirectory`.

Runtime file reads are already handled in `meridian/site/next.config.mjs`:
`outputFileTracingRoot` is set to `meridian/` and `pipeline/data/**` is traced
into the bundle, so `/api/run` can read the catalogue on a serverless
function.

## Vercel project settings

Import `Hem60/PatelHem` and leave **Root Directory** as the repository root.
Do not set it to `meridian/site` — that would hide `meridian/engine` and
`meridian/pipeline` from the build and reintroduce problem 2.

Everything else is read from `vercel.json`.

## Environment variables

| name | required | what it does |
|---|---|---|
| `GITHUB_TOKEN` | no | Raises the observing run's GitHub rate limit from 60 requests an hour to 5,000. Use a fine-grained token with **public repositories, read-only** and no write scopes. |

The site works without it. The run panel states which mode it is in —
`anonymous` or `authenticated` — either way, and refuses to invent data when
the limit is spent rather than faking a result.

Never commit the token. `.env` and `.env.local` are gitignored at both the
repository root and in `meridian/site`.

## Checking a deploy

The survey is not run on Vercel. The catalogue is committed
(`meridian/pipeline/data/catalogue.json`) and the build only renders it, so a
deploy publishes whatever the last local survey produced. To refresh the
figures, run the survey and push:

```bash
cd meridian/pipeline
node dist/run.js            # or --rebuild if the readings have not moved
git add data && git commit -m "survey: refresh catalogue" && git push
```

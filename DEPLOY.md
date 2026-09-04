# Deploying Meridian

The site is `meridian/site`, a Next.js app. It is not standalone: it imports
the scoring engine and the pipeline's Herald and Plumb from sibling packages,
and it reads `meridian/pipeline/data/*.json` at build time.

## Why the config lives in meridian/site

Two things break a naive deploy:

1. **The site imports built output.** `lib/run/instruments.ts` imports
   `@meridian/pipeline/dist/herald.js` — a compiled file. `dist/` is
   gitignored, so it is not in the repository and does not exist on a fresh
   clone. The engine and the pipeline therefore have to be built *before* the
   site is, which is what `buildCommand` does, in that order.

2. **`file:` dependencies point at siblings.** `@meridian/engine` resolves to
   `file:../engine`, so the build needs `meridian/engine` and
   `meridian/pipeline` on disk beside it.

The first attempt put `vercel.json` at the repository root and pointed
`outputDirectory` at `meridian/site/.next`. That does not work, and the error
is misleading: *"No Next.js version detected"*. Vercel does not locate a Next
app through `outputDirectory` — it runs its Next builder inside the **Root
Directory**, and a root holding no `app/` and no `next.config` is not a Next
app no matter what its `package.json` lists.

So the Root Directory is `meridian/site`, and `meridian/site/vercel.json`
builds the two siblings first using `../` paths. The CLI still uploads the
whole repository, so those siblings are present when it does.

Runtime file reads are already handled in `meridian/site/next.config.mjs`:
`outputFileTracingRoot` is set to `meridian/` and `pipeline/data/**` is traced
into the bundle, so `/api/run` can read the catalogue on a serverless
function.

## Vercel project settings

**Root Directory must be `meridian/site`.** It is set on the existing project.
A new project needs it set too, or the build fails with the misleading error
above. Everything else comes from `meridian/site/vercel.json`.

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

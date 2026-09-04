# Plan — closing the loop

Three things, in dependency order. The third needs a decision that changes a
rule in `CLAUDE.md`, so it is stated here rather than made quietly.

---

## 1. Connect the repository to Vercel — DONE

Connected: `Hem60/PatelHem`, production branch `main`, Root Directory survived
as `meridian/site`.

**Was:** `link: NOT CONNECTED`. The survey commits to GitHub and nothing
redeploys. The live site keeps serving the previous catalogue until somebody
runs `vercel deploy --prod` by hand, which makes the button on the site a
half-measure: it updates the data and not the page.

**Do:** `vercel git connect`, then confirm a push triggers a build.

**After:** push → build → live, with no human step.

---

## 2. Run the survey once, and measure it — DONE, and it found a bug

**Measured: 818s** (13m38s) wall clock, dispatch to completion.

```
01 collect  10 repositories read     (was 9 — PatelHem is new)
02 measure  6 scored                 (was 5 — a new card, ranked 2nd)
04 compose  6 entries · 25 claims upheld · 0 rejected
06 publish  wrote catalogue.json (6 entries)
✗ Check the published catalogue      ← blocked the commit
```

The survey itself worked and **proved step 3 already scores new repositories**:
`PatelHem` was catalogued and ranked above `RAG-CHAT-BOT` with no code change.

It failed at the test gate for a reason I built in: `regression.test.ts` pinned
against `phase00/out/raw.json`, which is the file the survey overwrites. So it
compared today's account against August's expectations. Fixed by freezing the
fixture — see `engine/test/fixtures/account-2026-08-26.json`.

**Original note:** the workflow had never run. Every number I have given about how long a
new card takes has been an estimate of one leg and a guess at the other.

**Do:** dispatch it, record wall-clock for each step, write the real figures
into `DEPLOY.md`.

**Known so far** — Vercel builds only, from the deployment history:

| deploy | duration |
|---|---|
| most recent, warm cache | 400s |
| first successful, cold | 759s |

**Watch for:** `collect.mjs` shells out to `gh api` once per request, serially,
with the cache cleared. Nine repositories is roughly fifty subprocesses. If the
run is slow this is why, and batching or restoring a keyed cache is the fix.

---

## 3. A new repository becomes a card on its own

**What already works:** nothing gates a card except

```ts
!s.fork && s.name.toLowerCase() !== user.toLowerCase()
```

No score floor, no topic. `webathon` is 0 KB and still publishes at 16.3. Any
new non-fork repository is catalogued and ranked by the same five axes the
moment a survey sees it. **The scoring needs no work at all** — only the
trigger does.

### The decision

`CLAUDE.md` line 54 says:

> `workflow_dispatch` only, no cron. It runs when a button is pressed, never
> on a schedule.

"A new repo becomes a card automatically" cannot be true while that holds. A
button is not automatic. So one of the two has to give.

**A webhook cannot rescue it.** GitHub has no account-level webhook for
personal accounts — `repository` events are organisation-only. Catching
"repository created" on a personal account needs a GitHub App with account
permissions, an endpoint to receive the delivery, a shared secret, and a token
with `actions: write` to re-dispatch. That is a lot of moving parts, and the
token is the same one I declined to put behind a public endpoint earlier.

**A schedule is the honest option, and cheaper than it first looks.** The rule
exists to stop the catalogue rewriting itself nightly and making `generated`
meaningless. But the run is already change-gated:

```
if (!dirty && !REBUILD) → "nothing moved — exiting without a commit"
```

A scheduled run that finds nothing writes nothing, commits nothing, and
deploys nothing. `generated` only moves when a reading does. The rule's
intent survives; only its letter changes.

### Proposed

- Add `schedule: cron` at **every 6 hours** to `survey.yml`, keeping
  `workflow_dispatch` so the button still works.
- Amend `CLAUDE.md` to say what is actually true: it runs on a button and on a
  six-hourly check, and it commits only when a reading moves.
- Add a step that names newly catalogued repositories in the run summary, so a
  new card is visible in the Actions log rather than only on the site.

**Cost:** four runs a day against a 2,000-minute monthly allowance. Measure in
step 2 before committing to the interval — if a run is 5 minutes, six-hourly
is 600 minutes a month and the interval should be widened.

**Not doing:** cron on a shorter interval than the Vercel build takes. A
trigger faster than the deploy is theatre.

---

## Order

1. Connect Vercel — the other two are pointless without it.
2. Run and measure — the interval in step 3 depends on the number.
3. Schedule, using the measured figure.

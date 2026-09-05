/**
 * The drafter.
 *
 * Writes a thesis line and a short description for repositories the survey has
 * found but nobody has written about yet, and records who wrote them.
 *
 * ── Why this exists, and what it is not allowed to touch ────────────────────
 * Everything else in this build is deterministic. Scores come out of the
 * engine, sentences come out of Herald's templates, and both are reproducible
 * by anyone who clones the repository. That does not change here: this script
 * runs AFTER the catalogue is published, reads it, and writes only prose. It
 * cannot alter an axis, a composite, a class, or a rank — it never touches
 * catalogue.json. If this file were deleted, every number on the site would be
 * identical and some cards would simply have no words.
 *
 * The gap it fills is real. A repository the survey discovers today publishes
 * immediately, which is the point, but it publishes with Herald's measured
 * sentences and a blank where the argument should be, until the author writes
 * one by hand. That blank could sit there for months.
 *
 * ── The three rules it works under ──────────────────────────────────────────
 * 1. It never overwrites a hand-written line. `source: "author"` is
 *    untouchable; a person's argument is not a draft to be improved on.
 * 2. It writes only from collected, checkable material: the owner's own
 *    repository description, the topics they tagged it with, the file paths
 *    in the default branch, Herald's verified sentences, and the recorded
 *    values. It is never given the CONTENTS of a file.
 *
 *    An earlier cut withheld the first three and passed only the measured
 *    sentences. It drafted nothing, five times out of five, and it was right
 *    to: "5 commits. Written in HTML. 9 KB." cannot answer "what problem does
 *    this address" without inventing one. The owner's own description can,
 *    and the paths name the parts of the system. Withholding the evidence and
 *    then asking for a conclusion is not caution — it is a request to guess.
 * 3. Every line it writes is labelled. `source: "groq"` reaches the catalogue,
 *    the card, and dossier.json. A reader can always tell which words are the
 *    author's.
 *
 * ── Change-gated ────────────────────────────────────────────────────────────
 * A draft is rewritten only when the measured sentences behind it change, kept
 * as `factsHash`. A survey where nothing moved calls the API zero times and
 * writes nothing, so this does not turn every run into a commit.
 *
 * ── No key, no problem ──────────────────────────────────────────────────────
 * Without GROQ_API_KEY the script reports what it would have drafted and exits
 * 0. The site builds, the catalogue publishes, the cards say "no thesis line
 * yet". Drafting is an enhancement to the pipeline, never a dependency of it.
 *
 * Usage:
 *   node scripts/draft.mjs                  draft what needs drafting
 *   node scripts/draft.mjs --dry-run        say what it would draft, call nothing
 *   node scripts/draft.mjs --force          redraft even where the hash matches
 *   node scripts/draft.mjs --models         what this key can reach, and the pick
 *   node scripts/draft.mjs --prompt <repo>  print the exact prompt, call nothing
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const CATALOGUE = join(DATA, "catalogue.json");
const PROSE = join(DATA, "prose.json");
/*
 * The collected account.
 *
 * The catalogue publishes readings. This carries the three things that say
 * what a project actually IS — the owner's own repository description, the
 * topics they tagged it with, and every path in the default branch. All three
 * are collected and checkable, and none of them is the contents of a file.
 *
 * Without them the drafter was being asked to write "what problem does this
 * address" from "5 commits, written in HTML, 9 KB", which is a request to
 * invent. It correctly refused, five times out of five.
 */
const RAW = join(HERE, "..", "..", "phase00", "out", "raw.json");

const KEY = process.env.GROQ_API_KEY ?? "";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = "https://api.groq.com/openai/v1/models";

const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry-run");
const LIST = process.argv.includes("--models");
/* Print the exact prompt one repository would be sent, and make no request. */
const SHOW = (() => { const i = process.argv.indexOf("--prompt"); return i === -1 ? null : process.argv[i + 1] ?? ""; })();

/**
 * Which model to draft with, when GROQ_MODEL does not name one.
 *
 * The first cut hard-coded `llama-3.3-70b-versatile` and every request came
 * back 404 model_not_found. Groq retires model ids on its own schedule, so a
 * name written here today is a survey that silently drafts nothing in six
 * months — and because a failed draft deliberately does not fail the survey,
 * it would fail quietly, which is the worst way for it to fail.
 *
 * So the model is discovered from the account's own /v1/models list and
 * chosen by preference, and the choice is printed. Substrings, not exact ids,
 * because the ids carry version suffixes that change.
 */
const PREFER = [
  "llama-3.3-70b", "llama-3.1-70b", "llama3-70b",
  "gpt-oss-120b", "gpt-oss-20b",
  "llama-3.1-8b", "llama3-8b", "llama-3.2",
  "qwen", "gemma",
];

/**
 * Models that cannot do this job: speech, embeddings, and the safety
 * classifiers, which return a label rather than prose.
 */
const NOT_A_WRITER = /whisper|tts|embed|guard|moderation|distil-whisper/i;

/** Caps. A thesis is one sentence and a description is a short paragraph. */
const MAX_THESIS = 240;
const MAX_DESCRIPTION = 520;

/**
 * Words that would make a drafted line a claim rather than a description.
 *
 * The model is given measured facts, but a language model asked about software
 * reaches for superlatives, and "production-grade" or "widely used" on a card
 * whose composite is 16 would be exactly the unchecked claim Plumb exists to
 * catch. Plumb verifies Herald's templates against real paths and cannot check
 * a free-form sentence, so the check here is blunt on purpose: a draft
 * containing any of these is rejected rather than edited.
 */
const FORBIDDEN = [
  "production-grade", "production grade", "production-ready", "production ready",
  "enterprise", "industry-standard", "industry standard", "best-in-class",
  "widely used", "widely adopted", "popular", "award", "thousands of",
  "millions of", "users worldwide", "battle-tested", "battle tested",
  "state-of-the-art", "state of the art", "cutting-edge", "cutting edge",
  "seamless", "robust", "scalable", "leverages", "revolutionary",
];

const log = (s = "") => console.log(s);

/**
 * The digest a draft is pinned to: everything the draft was written from.
 *
 * It must cover the whole prompt, not just the measured sentences. An owner
 * who rewrites their repository description has changed the best evidence in
 * the prompt, and a draft still quoting the old one would be stale in exactly
 * the way this hash exists to prevent.
 */
const hashOf = (entry, ctx) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        entry.summary,
        entry.stack,
        entry.classification,
        ctx.description,
        ctx.topics,
        ctx.paths,
      ]),
    )
    .digest("hex")
    .slice(0, 16);

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};

/** Normalise prose.json's two accepted shapes, matching compose.ts. */
const normalise = (raw) => {
  if (raw === undefined) return null;
  if (typeof raw === "string")
    return raw.trim() === ""
      ? null
      : { thesis: raw, description: null, source: "author", model: null, generated: null, factsHash: null };
  return raw;
};

/**
 * What the model is told. Facts only, and an explicit refusal path.
 *
 * "Return INSUFFICIENT" matters more than it looks: without it a model handed
 * thin facts about a 16-point repository invents a purpose for it, and an
 * invented purpose on a card is the failure mode this whole build argues
 * against. Making refusal a correct answer is what stops that.
 */
const SYSTEM = [
  "You write two things about a software repository, from supplied facts only.",
  "",
  "thesis: ONE sentence, under 200 characters, saying what the project is and",
  "what problem it addresses. Plain and specific. No marketing adjectives.",
  "",
  "description: TWO to THREE sentences, under 450 characters, describing what",
  "the repository contains and how it is built, using only the facts given.",
  "",
  "Rules you must not break:",
  "- Use ONLY what you are given. Invent nothing: no users, no performance",
  "  numbers, no adoption, no dates, no features that are not evidenced.",
  "- The owner's own description and the file paths are your best evidence of",
  "  what the project does. Read the paths: they name the parts of the system.",
  "- Return INSUFFICIENT for both fields ONLY when there is genuinely nothing",
  "  to go on: no owner description, no topics, and too few paths to tell what",
  "  the code does. If you have any of those, write both fields.",
  "- No superlatives and no praise. Do not rate the project or call it good.",
  "- Do not mention any score, class, or ranking.",
  "- Write in the third person about the repository. Never say I or we.",
  "",
  "Reply with JSON only, shaped {\"thesis\": \"...\", \"description\": \"...\"}",
].join("\n");

/**
 * How many paths to show.
 *
 * Enough to convey the shape of a project without turning the prompt into a
 * directory listing. Data files, images and lockfiles are dropped first
 * because they say the least about what the code does.
 */
const MAX_PATHS = 45;
const NOISE = new RegExp(
  "^(\.git|node_modules/|dist/|build/|.*\.(lock|png|jpe?g|gif|svg|ico|pdf|csv|ipynb)$)",
  "i",
);

const interesting = (paths) => {
  const kept = paths.filter((p) => !NOISE.test(p));
  return (kept.length > 0 ? kept : paths).slice(0, MAX_PATHS);
};

/** What a repository with no collected signals looks like: nothing to go on. */
export const EMPTY = Object.freeze({ description: "", topics: [], paths: [], pathCount: 0 });

/**
 * Turn the collected account into per-repository context, keyed by name.
 *
 * Exported so a test can build it from the real raw.json and drive the prompt
 * end to end without a network.
 */
export function contextFrom(raw) {
  return new Map(
    (raw?.repos ?? []).map((r) => [
      r.name,
      {
        description: typeof r.description === "string" ? r.description.trim() : "",
        topics: Array.isArray(r.topics) ? r.topics : [],
        paths: interesting(Array.isArray(r.paths) ? r.paths : []),
        pathCount: r.path_count ?? (Array.isArray(r.paths) ? r.paths.length : 0),
      },
    ]),
  );
}

export const userPrompt = (entry, ctx) =>
  [
    "Repository name: " + entry.name,
    "Languages: " + (entry.stack.length > 0 ? entry.stack.join(", ") : "none detected"),
    "",
    /*
     * The owner's own sentence about the project, when there is one. The most
     * useful line in the prompt, and not a guess: it is what the author wrote
     * on the repository itself.
     */
    ctx.description
      ? "The owner describes it as: " + ctx.description
      : "The owner has written no description for this repository.",
    ctx.topics.length > 0 ? "Topics the owner tagged it with: " + ctx.topics.join(", ") : "",
    "",
    "Files in the default branch" +
      (ctx.paths.length < ctx.pathCount ? " (" + ctx.paths.length + " of " + ctx.pathCount + ")" : "") +
      ":",
    ...(ctx.paths.length > 0 ? ctx.paths.map((x) => "- " + x) : ["- (none listed)"]),
    "",
    "Measured facts, each already verified against a file that exists:",
    ...(entry.summary.length > 0
      ? entry.summary.map((x) => "- " + x)
      : ["- (none: the survey found nothing beyond the repository itself)"]),
    "",
    "Recorded values:",
    ...entry.facts.map((f) => "- " + f.label + ": " + f.value),
  ]
    .filter((line) => line !== "")
    .join("\n");

/** Every model this key can reach, writers only, in the API's own order. */
async function available() {
  const res = await fetch(MODELS, { headers: { authorization: "Bearer " + KEY } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error("could not list models: " + res.status + " " + res.statusText + " — " + body);
  }
  const body = await res.json();
  return (body?.data ?? [])
    .map((m) => m.id)
    .filter((id) => typeof id === "string" && !NOT_A_WRITER.test(id));
}

/**
 * Pick a model, and say why.
 *
 * An explicit GROQ_MODEL always wins — pinning is the right answer once you
 * know what you want, and it makes a run reproducible. Everything else is
 * chosen from what the account can actually reach today.
 */
async function resolveModel() {
  const pinned = process.env.GROQ_MODEL;
  if (pinned !== undefined && pinned !== "") return { id: pinned, why: "pinned by GROQ_MODEL" };

  const ids = await available();
  if (ids.length === 0) throw new Error("this key can reach no text model");

  for (const want of PREFER) {
    const hit = ids.find((id) => id.includes(want));
    if (hit !== undefined) return { id: hit, why: "first match for " + want };
  }
  return { id: ids[0], why: "no preferred model available; took the first the API listed" };
}

/**
 * The request body, built and exported so it can be tested without a network.
 *
 * This is here because of a bug that reached the workflow: `draft` still had
 * the signature `(entry, model)` after the prompt gained a context argument,
 * so `userPrompt(entry)` was called with `ctx` undefined and every draft died
 * on "Cannot read properties of undefined". Nothing caught it locally, because
 * with no key `draft` never runs — the only path exercised at desk was the one
 * that builds the prompt directly.
 *
 * Splitting the body out makes everything short of the `fetch` testable, which
 * is the whole of the wiring.
 */
export function requestBody(entry, ctx, model) {
  return {
    model,
    temperature: 0.2,
    /*
     * Generous, because several of the models on offer here reason before
     * answering and that reasoning is charged against the same budget. At
     * 400 the first run produced an empty completion and a
     * `json_validate_failed` with `failed_generation: ""` — the model had
     * nothing left to write the answer with. The draft itself is ~120
     * tokens; the rest is headroom, and unused tokens cost nothing.
     */
    max_tokens: 1500,
    /* keep the thinking short on models that expose the control */
    ...(/gpt-oss|qwen3|reason/i.test(model) ? { reasoning_effort: "low" } : {}),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt(entry, ctx) },
    ],
  };
}

/** One request. Returns the parsed object, or throws. */
async function draft(entry, ctx, model) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
    body: JSON.stringify(requestBody(entry, ctx, model)),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(res.status + " " + res.statusText + " — " + body);
  }

  const body = await res.json();
  const choice = body?.choices?.[0];
  const text = choice?.message?.content;

  if (typeof text !== "string" || text.trim() === "") {
    /* say WHY there was nothing — `length` means the budget ran out */
    throw new Error("no content in response (finish_reason: " + (choice?.finish_reason ?? "unknown") + ")");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("response was not JSON: " + text.slice(0, 160));
  }
}

/** Reject anything that would put an unchecked claim on a card. */
export function reject(candidate) {
  const thesis = typeof candidate?.thesis === "string" ? candidate.thesis.trim() : "";
  const description = typeof candidate?.description === "string" ? candidate.description.trim() : "";

  /*
   * These two are not the same failure and must not share a message.
   * "INSUFFICIENT" is the model taking the refusal path on offer; an empty
   * string is the model producing nothing at all, which on a reasoning model
   * usually means the token budget went on reasoning and left none for the
   * answer. A single message for both sent the first round of debugging in
   * the wrong direction.
   */
  if (thesis === "INSUFFICIENT") return "the model declined — it judged the facts too thin";
  if (thesis === "") return "empty response — no thesis came back at all";
  if (thesis.length > MAX_THESIS) return "thesis is " + thesis.length + " characters, over " + MAX_THESIS;
  if (description.length > MAX_DESCRIPTION)
    return "description is " + description.length + " characters, over " + MAX_DESCRIPTION;

  const hay = (thesis + " " + description).toLowerCase();
  const bad = FORBIDDEN.find((w) => hay.includes(w));
  if (bad !== undefined) return "contains an unverifiable claim: \"" + bad + "\"";

  return null;
}

/** Exported so the test suite can pin the gate without making a request. */
export const GATE = { FORBIDDEN, MAX_THESIS, MAX_DESCRIPTION };

// ── run ─────────────────────────────────────────────────────────────────────

/* Importing this file for its gate must not fire a survey. */
const INVOKED = process.argv[1] !== undefined && process.argv[1].endsWith("draft.mjs");

if (INVOKED && LIST) {
  /* what this key can actually reach — the answer to a 404 model_not_found */
  if (KEY === "") {
    console.error("GROQ_API_KEY is not set, so there is nothing to list.");
    process.exit(1);
  }
  const ids = await available();
  log("models this key can write with, " + ids.length + " of them:");
  for (const id of ids) log("  " + id);
  const picked = await resolveModel();
  log("");
  log("would use: " + picked.id + " (" + picked.why + ")");
  process.exit(0);
}

if (INVOKED) {
  const cat = readJson(CATALOGUE, null);
  if (cat === null) {
    console.error("no catalogue.json — run the pipeline first");
    process.exit(1);
  }

  const prose = readJson(PROSE, {});

  /*
   * The collected signals, keyed by name.
   *
   * If raw.json is missing — someone ran this without collecting first — the
   * drafter still works, just with far less to go on, and will refuse more
   * often. That is the correct degradation: fewer drafts, never worse ones.
   */
  const context = contextFrom(readJson(RAW, { repos: [] }));

  if (SHOW !== null) {
    /*
     * Exactly what a repository would be sent, and nothing sent. The first
     * version of this script drafted nothing five times running and the log
     * could not say why, because nobody could see the prompt.
     */
    const entry = cat.entries.find((e) => e.name.toLowerCase() === SHOW.toLowerCase());
    if (entry === undefined) {
      console.error('no entry named ' + SHOW + '. Have: ' + cat.entries.map((e) => e.name).join(', '));
      process.exit(1);
    }
    log('----- system -----');
    log(SYSTEM);
    log('');
    log('----- user -----');
    log(userPrompt(entry, context.get(entry.name) ?? EMPTY));
    process.exit(0);
  }

  /* What needs words, and why. An authored line is never a candidate. */
  const candidates = [];
  for (const entry of cat.entries) {
    const existing = normalise(prose[entry.name]);
    if (existing?.source === "author") continue;

    const hash = hashOf(entry, context.get(entry.name) ?? EMPTY);
    if (existing === null) candidates.push({ entry, hash, why: "no thesis line" });
    else if (FORCE) candidates.push({ entry, hash, why: "forced" });
    else if (existing.factsHash !== hash) candidates.push({ entry, hash, why: "readings moved" });
  }

  log("catalogue: " + cat.entries.length + " entries · " + candidates.length + " needing a draft");
  for (const c of candidates) log("  " + c.entry.name.padEnd(20) + c.why);

  if (candidates.length === 0) {
    log("nothing to draft — no requests made.");
    process.exit(0);
  }

  if (KEY === "") {
    log("");
    log("GROQ_API_KEY is not set, so nothing was drafted and no request was made.");
    log("The catalogue is unaffected; these entries publish on measurement alone.");
    process.exit(0);
  }

  if (DRY) {
    log("");
    log("--dry-run: no requests made.");
    process.exit(0);
  }

  /*
   * Choose the model before drafting anything, and fail loudly here if there
   * is none. A per-entry 404 repeated once per repository is a wall of
   * identical noise that hides the one fact that matters.
   */
  let model;
  try {
    const picked = await resolveModel();
    model = picked.id;
    log("");
    log("model: " + model + " (" + picked.why + ")");
  } catch (err) {
    log("");
    log("no usable model — " + err.message);
    log("Nothing was drafted. These entries publish on measurement alone.");
    process.exit(0);
  }

  const next = { ...prose };
  let written = 0;
  let failed = 0;

  for (const { entry, hash } of candidates) {
    try {
      const got = await draft(entry, context.get(entry.name) ?? EMPTY, model);
      const bad = reject(got);
      if (bad !== null) {
        log("  ✗ " + entry.name + " — " + bad);
        failed += 1;
        continue;
      }
      const description = got.description.trim();
      next[entry.name] = {
        thesis: got.thesis.trim(),
        description: description === "INSUFFICIENT" ? null : description,
        source: "groq",
        model,
        generated: new Date().toISOString(),
        factsHash: hash,
      };
      written += 1;
      log("  ✓ " + entry.name + " — " + next[entry.name].thesis);
    } catch (err) {
      log("  ✗ " + entry.name + " — " + err.message);
      failed += 1;
    }
  }

  if (written > 0) {
    /* keys sorted, so a diff shows what changed rather than what moved */
    const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
    writeFileSync(PROSE, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  }

  log("");
  log("drafted " + written + " · rejected or failed " + failed + " · model " + model);

  /*
   * A failed draft is not a failed survey. The entry publishes without words,
   * exactly as it did before this script existed, and the next run tries again.
   */
  process.exit(0);
}

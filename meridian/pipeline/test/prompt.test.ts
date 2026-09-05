/**
 * The drafter's prompt, wired end to end short of the network.
 *
 * This file exists because of a bug that reached the workflow. When the prompt
 * gained a context argument, `draft` kept its old `(entry, model)` signature
 * and called `userPrompt(entry)` with `ctx` undefined, so every draft died on
 * "Cannot read properties of undefined (reading 'description')".
 *
 * Nothing at desk caught it: with no GROQ_API_KEY the request path never runs,
 * and the only thing exercised locally was `--prompt`, which calls the prompt
 * builder directly and so skipped exactly the broken join. The lesson is that
 * a code path guarded by a secret is a code path with no coverage unless the
 * body is separated from the send — so `requestBody` is exported, and this
 * drives it against the real catalogue and the real collected account.
 *
 * No request is made here. Nothing in this file needs a key.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs script, deliberately not part of the TS build
import { EMPTY, contextFrom, requestBody, userPrompt } from "../scripts/draft.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(HERE, "..", p), "utf8"));

const cat = read("data/catalogue.json");
const raw = read("../phase00/out/raw.json");
const context = contextFrom(raw);

const entryFor = (name: string) => {
  const e = cat.entries.find((x: { name: string }) => x.name === name);
  if (e === undefined) throw new Error("no catalogue entry named " + name);
  return e;
};

describe("the drafting request", () => {
  it("builds a complete body for every entry in the catalogue", () => {
    /* the bug: this threw for all six */
    for (const entry of cat.entries) {
      const body = requestBody(entry, context.get(entry.name) ?? EMPTY, "test-model");
      expect(body.model, entry.name).toBe("test-model");
      expect(body.messages, entry.name).toHaveLength(2);
      expect(body.messages[1].content.length, entry.name).toBeGreaterThan(40);
      expect(body.response_format).toEqual({ type: "json_object" });
    }
  });

  it("survives a repository with no collected signals at all", () => {
    /* raw.json missing, or a name that is not in it — fall back, never throw */
    const body = requestBody(entryFor(cat.entries[0]!.name), EMPTY, "test-model");
    expect(body.messages[1].content).toContain("no description");
  });

  it("gives the model the owner's own description when there is one", () => {
    /*
     * The whole reason the first drafting run produced nothing: the owner's
     * sentence about the project was collected and never passed. If this stops
     * being true, the drafter goes back to refusing.
     */
    const withDescription = cat.entries.filter(
      (e: { name: string }) => (context.get(e.name)?.description ?? "") !== "",
    );
    expect(withDescription.length).toBeGreaterThan(0);

    for (const entry of withDescription) {
      const ctx = context.get(entry.name)!;
      expect(userPrompt(entry, ctx), entry.name).toContain(ctx.description);
    }
  });

  it("names the files, because the paths say what the code does", () => {
    const entry = cat.entries.find((e: { name: string }) => (context.get(e.name)?.paths.length ?? 0) > 3);
    expect(entry, "no entry has more than three paths").toBeDefined();
    const prompt = userPrompt(entry, context.get(entry.name)!);
    expect(prompt).toContain("Files in the default branch");
    for (const p of context.get(entry.name)!.paths.slice(0, 5)) expect(prompt).toContain(p);
  });

  it("never sends the contents of a file, only its path", () => {
    /*
     * The rule in CLAUDE.md. Manifests are collected — package.json and
     * pyproject.toml arrive as raw text — and they must not reach the prompt.
     */
    for (const entry of cat.entries) {
      const prompt: string = userPrompt(entry, context.get(entry.name) ?? EMPTY);
      const repo = raw.repos.find((r: { name: string }) => r.name === entry.name);
      for (const contents of Object.values(repo?.manifests ?? {})) {
        const text = String(contents);
        if (text.length < 40) continue;
        expect(prompt.includes(text.slice(0, 40)), entry.name).toBe(false);
      }
    }
  });

  it("asks for short reasoning only from models that take the control", () => {
    const entry = cat.entries[0]!;
    const ctx = context.get(entry.name) ?? EMPTY;
    expect(requestBody(entry, ctx, "openai/gpt-oss-120b").reasoning_effort).toBe("low");
    expect(requestBody(entry, ctx, "llama-3.1-8b-instant").reasoning_effort).toBeUndefined();
  });

  it("leaves room for an answer after the reasoning", () => {
    /* 400 starved a reasoning model into an empty completion; see draft.mjs */
    expect(requestBody(cat.entries[0]!, EMPTY, "m").max_tokens).toBeGreaterThanOrEqual(1200);
  });
});

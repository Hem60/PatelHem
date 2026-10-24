/**
 * Renames.
 *
 * A repository name is not an identity. Rename one on GitHub and the survey
 * handles it perfectly — the catalogue is regenerated from the live account
 * every run, so the new name simply appears and the old one does not. Nothing
 * needs to be told.
 *
 * What does need telling is everything that pinned the old name BY HAND:
 *
 *   data/prose.json          keyed by repository name
 *   site/content/skills.json evidence lines naming repositories in prose
 *   catalogue state          keyed by repository name, and carrying the
 *                            class, the grant date and the score history
 *
 * The last one is the one that quietly costs something. State keyed by name
 * means a rename reads as "the old repository vanished and a new one appeared"
 * — the class history is lost, the grant date resets, and the hysteresis that
 * stops a project flickering between bands starts again from nothing. The
 * project did not change; only its label did.
 *
 * `RAG-CHAT-BOT` was renamed to `agentic-rag-chat-bot` and the survey failed
 * on a skill citing evidence from a repository the catalogue no longer held.
 * The guard was right to fail; the gap was that nothing propagated the change.
 *
 * ── How a rename is recognised ──────────────────────────────────────────────
 * By GitHub's numeric repository id, which survives a rename. A name match is
 * not evidence of anything and a heuristic — similar names, same languages —
 * would eventually migrate the wrong project's history onto an innocent
 * repository. An id match is proof; without one, nothing moves.
 *
 * State written before ids were recorded has none, so the first run after this
 * shipped adopts ids silently and detects nothing. That is correct: there is
 * no evidence a rename happened, so none is claimed.
 */
import type { Catalogue } from "./catalogue.js";

export interface Rename {
  readonly from: string;
  readonly to: string;
  readonly id: number;
}

/**
 * Repositories that kept their id and changed their name.
 *
 * `ids` maps the names seen in this collection to their GitHub ids. Previous
 * state carries the id each name had when it was last published.
 */
export function detectRenames(
  previous: Catalogue,
  ids: Readonly<Record<string, number>>,
): Rename[] {
  /* what each id was called last time, for ids we actually recorded */
  const was = new Map<number, string>();
  for (const [name, entry] of Object.entries(previous.state)) {
    if (typeof entry.id === "number") was.set(entry.id, name);
  }

  const renames: Rename[] = [];
  for (const [name, id] of Object.entries(ids)) {
    const before = was.get(id);
    if (before === undefined || before === name) continue;
    /* the same repository, under a different name */
    renames.push({ from: before, to: name, id });
  }
  return renames.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Move a name-keyed record onto its new key.
 *
 * Returns a new object; the input is untouched. A key that does not exist is
 * not an error — a repository may well have had no prose written for it.
 */
export function migrateKeys<T>(
  record: Readonly<Record<string, T>>,
  renames: readonly Rename[],
): { readonly next: Record<string, T>; readonly moved: string[] } {
  const next: Record<string, T> = { ...record };
  const moved: string[] = [];

  for (const r of renames) {
    if (!(r.from in next)) continue;
    /*
     * Never overwrite. If something already sits under the new name it was
     * written deliberately and is about the repository as it is now; the old
     * record is the stale one, and silently replacing the new with the old
     * would be the worst possible outcome of a rename.
     */
    if (r.to in next) continue;
    next[r.to] = next[r.from]!;
    delete next[r.from];
    moved.push(`${r.from} → ${r.to}`);
  }

  return { next, moved };
}

/**
 * Rewrite repository names inside authored prose.
 *
 * `skills.json` names repositories inside sentences a person wrote, so there
 * is no key to move — the name has to be replaced in the text. A repository
 * name is a distinctive token and the replacement is bounded by word edges, so
 * this does not maul unrelated words.
 *
 * It is deliberately a plain substitution and not something cleverer. The
 * alternative — teaching authored content to reference repositories by id —
 * would make the file unreadable to the person who writes it, and the whole
 * point of that file is that a human wrote the sentences in it.
 */
export function rewriteNames(text: string, renames: readonly Rename[]): string {
  let out = text;
  for (const r of renames) {
    const escaped = r.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g"), r.to);
  }
  return out;
}

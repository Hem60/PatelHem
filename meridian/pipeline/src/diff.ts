import { classify, transition, type ClassState, type ScoredRepo } from "@meridian/engine";
import type { Catalogue, StateEntry } from "./catalogue.js";

/**
 * Stage 03. What is new, what moved, and what should stay put.
 * Nothing here writes; it only decides.
 */

export type Change =
  | { readonly kind: "new"; readonly repo: string; readonly to: ScoredRepo }
  | { readonly kind: "promote"; readonly repo: string; readonly to: ScoredRepo; readonly fromClass: string }
  | { readonly kind: "demote"; readonly repo: string; readonly to: ScoredRepo; readonly fromClass: string }
  | { readonly kind: "rescore"; readonly repo: string; readonly to: ScoredRepo; readonly delta: number }
  | { readonly kind: "hold"; readonly repo: string; readonly to: ScoredRepo; readonly reason: string }
  /**
   * In the previous catalogue and not in this survey.
   *
   * Deleted, archived, made private, or renamed without the rename being
   * recognised. There is no ScoredRepo because there is nothing left to
   * score — which is exactly why this was missed: every other change is
   * discovered by walking what WAS collected, and a deletion is the one
   * thing that can only be found by walking what was not.
   */
  | { readonly kind: "removed"; readonly repo: string };

export interface DiffResult {
  readonly changes: readonly Change[];
  /** True when something must be written. Otherwise the run exits clean. */
  readonly dirty: boolean;
}

/** Composites differing by less than this are treated as unchanged. */
export const RESCORE_EPSILON = 0.05;

export function diff(
  previous: Catalogue,
  scored: readonly ScoredRepo[],
  now: string,
  options: {
    /**
     * Whether `scored` is the whole account.
     *
     * A removal can only be inferred from absence, and absence means nothing
     * unless everything was looked at. A partial run — `--repo one-project` —
     * would otherwise report every other repository as deleted and the
     * catalogue would be emptied by a diagnostic command.
     */
    readonly complete?: boolean;
  } = {},
): DiffResult {
  const { complete = true } = options;
  const changes: Change[] = [];

  for (const r of scored) {
    const prior = previous.state[r.name];
    if (!prior) {
      changes.push({ kind: "new", repo: r.name, to: r });
      continue;
    }

    const state: ClassState = prior;
    const move = transition(state, r.composite, now);

    if (move.kind === "promote") {
      changes.push({ kind: "promote", repo: r.name, to: r, fromClass: move.from });
      continue;
    }
    if (move.kind === "demote") {
      changes.push({ kind: "demote", repo: r.name, to: r, fromClass: move.from });
      continue;
    }

    const before = prior.history[prior.history.length - 1];
    const delta = before === undefined ? 0 : r.composite - before;
    if (Math.abs(delta) >= RESCORE_EPSILON) {
      changes.push({ kind: "rescore", repo: r.name, to: r, delta: Math.round(delta * 10) / 10 });
    } else {
      changes.push({ kind: "hold", repo: r.name, to: r, reason: move.reason });
    }
  }

  if (complete) {
    /*
     * What the survey no longer finds.
     *
     * Walked over the previous catalogue rather than the current readings,
     * because a deleted repository leaves nothing behind to iterate. Without
     * this a deletion produced no change at all: every survivor held, `dirty`
     * stayed false, the run exited without a commit, and the deleted
     * project kept its card on the site indefinitely.
     */
    const present = new Set(scored.map(r => r.name));
    for (const name of Object.keys(previous.state)) {
      if (!present.has(name)) changes.push({ kind: "removed", repo: name });
    }
  }

  const dirty = changes.some(c => c.kind !== "hold");
  return { changes, dirty };
}

/** Advance per-repo class state for the next run. */
export function advance(
  previous: Catalogue,
  scored: readonly ScoredRepo[],
  changes: readonly Change[],
  now: string,
  historyLimit = 8,
  /**
   * GitHub's numeric id per repository name, from this collection.
   *
   * Recorded into state so the NEXT run can tell a rename from a deletion
   * plus a creation. Without it a renamed repository loses its class history
   * and its grant date, and the hysteresis that stops a project flickering
   * between bands starts again from nothing.
   */
  ids: Readonly<Record<string, number>> = {},
): Catalogue["state"] {
  const next: Record<string, StateEntry> = {};
  const byName = new Map(changes.map(c => [c.repo, c]));

  for (const r of scored) {
    const prior = previous.state[r.name];
    const change = byName.get(r.name);
    const moved = change?.kind === "promote" || change?.kind === "demote";
    const isNew = change?.kind === "new";

    const granting = moved || isNew || !prior;
    const current = granting ? classify(r.composite) : prior.current;
    const since = granting ? now : prior.since;
    const history = [...(prior?.history ?? []), r.composite].slice(-historyLimit);
    const axesAtGrant = granting
      ? Object.fromEntries(Object.entries(r.axes).map(([k, v]) => [k, Math.round(v.value * 10) / 10]))
      : prior.axesAtGrant;
    const compositeAtGrant = granting ? r.composite : prior.compositeAtGrant;

    const id = ids[r.name] ?? prior?.id;
    next[r.name] = {
      ...(id === undefined ? {} : { id }),
      current, since, history, axesAtGrant, compositeAtGrant,
    };
  }
  return next;
}

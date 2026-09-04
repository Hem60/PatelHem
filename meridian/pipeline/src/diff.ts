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
  | { readonly kind: "hold"; readonly repo: string; readonly to: ScoredRepo; readonly reason: string };

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
): DiffResult {
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

    next[r.name] = { current, since, history, axesAtGrant, compositeAtGrant };
  }
  return next;
}

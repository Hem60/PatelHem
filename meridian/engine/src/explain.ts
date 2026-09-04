import { nextGate, type Thresholds, THRESHOLDS } from "./classify.js";
import { WEIGHTS } from "./score.js";
import type { AxisName, ScoredRepo } from "./signals.js";

/**
 * `why <repo>` — the command the reference implementation cannot have,
 * because there is no engine underneath its ranks to answer with.
 * Every number a visitor sees can print the arithmetic that produced it.
 */

const AXIS_ORDER: readonly AxisName[] = ["stability", "mass", "anomaly", "luminosity", "cadence"];

const bar = (v: number, width = 24): string => {
  const filled = Math.round((v / 100) * width);
  return "\u2588".repeat(filled) + "\u00b7".repeat(width - filled);
};

const fmtEvidence = (e: Readonly<Record<string, unknown>>): string =>
  Object.entries(e)
    .map(([k, v]) => `${k}=${v === true ? "yes" : v === false ? "no" : v === null ? "\u2014" : String(v)}`)
    .join("  ");

export interface ExplainOptions {
  readonly thresholds?: Thresholds;
  /** Show every sub-signal, including the ones that scored zero. */
  readonly verbose?: boolean;
}

export function explain(r: ScoredRepo, opts: ExplainOptions = {}): string {
  const t = opts.thresholds ?? THRESHOLDS;
  const out: string[] = [];
  const pad = (s: string, n: number): string => s.padEnd(n);

  out.push("");
  out.push(`  ${r.name}${r.fork ? "  (fork \u2014 not catalogued)" : ""}`);
  out.push("");

  for (const axis of AXIS_ORDER) {
    const a = r.axes[axis];
    const weighted = a.value * WEIGHTS[axis];
    out.push(
      `  ${pad(axis, 12)}${a.value.toFixed(1).padStart(5)}  ${bar(a.value)}` +
      `  \u00d7${WEIGHTS[axis].toFixed(2)} = ${weighted.toFixed(2)}`,
    );

    const parts = Object.entries(a.parts)
      .filter(([, v]) => opts.verbose || v !== 0)
      .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
    if (parts.length > 0) {
      out.push(`  ${" ".repeat(12)}${parts.map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v.toFixed(1)}`).join("  ")}`);
    }
    out.push(`  ${" ".repeat(12)}\u2514 ${fmtEvidence(a.evidence)}`);
    out.push("");
  }

  out.push(`  ${"\u2500".repeat(62)}`);
  out.push(`  ${pad("composite", 12)}${r.composite.toFixed(1).padStart(5)}  \u2192  ${r.classification}`);

  const gate = nextGate(r.composite, t);
  if (gate) {
    out.push(`  ${pad("next gate", 12)}${gate.target} at ${t[gate.target as Exclude<typeof gate.target, "COMMON">].toFixed(1)}  (+${gate.gap.toFixed(1)} needed)`);

    // Which single axis is the cheapest route to the next class?
    const cheapest = AXIS_ORDER
      .map(axis => ({ axis, needed: gate.gap / WEIGHTS[axis], headroom: 100 - r.axes[axis].value }))
      .filter(c => c.needed <= c.headroom)
      .sort((a, b) => a.needed - b.needed)[0];
    if (cheapest) {
      out.push(`  ${" ".repeat(12)}cheapest route: +${cheapest.needed.toFixed(0)} ${cheapest.axis} ` +
        `(now ${r.axes[cheapest.axis].value.toFixed(1)}, headroom ${cheapest.headroom.toFixed(0)})`);
    } else {
      out.push(`  ${" ".repeat(12)}no single axis can close this \u2014 it needs work on several`);
    }
  } else {
    out.push(`  ${pad("next gate", 12)}none \u2014 top of the ladder`);
  }

  if (r.authorship.share !== null) {
    out.push(`  ${pad("authorship", 12)}${r.authorship.share}%  (${r.authorship.mine}/${r.authorship.total} commits)`);
  }
  out.push("");
  return out.join("\n");
}

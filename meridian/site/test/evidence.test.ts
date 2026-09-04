/**
 * Phase 04 tests.
 *
 * The catalogue renders what the pipeline wrote, so the interesting risk is
 * the constellation: a graph that draws an edge nothing supports is exactly
 * the failure this whole build exists to avoid.
 */
import { describe, expect, it } from "vitest";
import { catalogue } from "../lib/catalogue";
import {
  DETECTORS,
  ROOT_ID,
  ancestors,
  capabilities,
  constellation,
  descendants,
  TREE_BOX,
  tree,
  unmatchedClaims,
} from "../lib/evidence";
import { AXES } from "../lib/bands";

const cat = catalogue();

describe("claim detection", () => {
  it("recognises every sentence the pipeline published", () => {
    /* If Herald's wording changes, this fails loudly rather than letting the
       graph quietly lose a node. */
    expect(unmatchedClaims(cat)).toEqual([]);
  });

  it("keys every detector to a Herald template id", () => {
    const ids = DETECTORS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["tests", "ci", "typing", "lint", "container", "evals", "docs"]) {
      expect(ids).toContain(id);
    }
  });

  it("never invents support for a capability", () => {
    const names = new Set(cat.entries.map((e) => e.name));
    for (const cap of capabilities(cat)) {
      expect(cap.repos.length, cap.id).toBeGreaterThan(0);
      for (const repo of cap.repos) expect(names.has(repo), `${cap.id} cites ${repo}`).toBe(true);
    }
  });

  it("gives every capability as much evidence as it claims support", () => {
    for (const cap of capabilities(cat)) {
      expect(cap.evidence.length, cap.id).toBe(cap.repos.length);
      for (const e of cap.evidence) expect(e.href).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it("reads languages from the measured stack, not from prose", () => {
    const langs = capabilities(cat).filter((c) => c.category === "language");
    for (const cap of langs) {
      const name = cap.id.replace(/^language:/, "");
      for (const repo of cap.repos) {
        const entry = cat.entries.find((e) => e.name === repo)!;
        expect(entry.stack, `${repo} stack`).toContain(name);
      }
    }
  });
});

describe("the implication graph", () => {
  const { nodes, edges } = constellation(cat);
  const support = new Map(nodes.map((n) => [n.id, new Set(n.repos)]));
  support.set(ROOT_ID, new Set(cat.entries.map((e) => e.name)));

  it("draws an edge only where the containment actually holds", () => {
    for (const e of edges) {
      const from = support.get(e.from)!;
      const to = support.get(e.to)!;
      /* every repository evidencing `to` must also evidence `from` */
      for (const repo of to) expect(from.has(repo), `${e.to} without ${e.from}: ${repo}`).toBe(true);
      expect(to.size, `${e.from} → ${e.to}`).toBeLessThan(from.size);
    }
  });

  it("is acyclic, because strict containment cannot loop", () => {
    for (const n of nodes) {
      expect(ancestors(edges, n.id).has(n.id), n.id).toBe(false);
      expect(descendants(edges, n.id).has(n.id), n.id).toBe(false);
    }
  });

  it("keeps only immediate links — no edge that another node already mediates", () => {
    for (const e of edges) {
      const from = support.get(e.from)!;
      const to = support.get(e.to)!;
      const mediator = [...support.entries()].find(([id, s]) => {
        if (id === e.from || id === e.to) return false;
        const between = s.size < from.size && s.size > to.size;
        if (!between) return false;
        return [...s].every((r) => from.has(r)) && [...to].every((r) => s.has(r));
      });
      expect(mediator?.[0], `${e.from} → ${e.to} is mediated`).toBeUndefined();
    }
  });

  it("runs every chain back to the account itself", () => {
    for (const n of nodes) {
      const up = ancestors(edges, n.id);
      expect(up.has(ROOT_ID), `${n.id} is orphaned`).toBe(true);
    }
  });

  it("sizes nodes by evidence and places them deterministically", () => {
    const again = constellation(cat);
    expect(again.nodes.map((n) => [n.id, n.x, n.y, n.r])).toEqual(
      nodes.map((n) => [n.id, n.x, n.y, n.r]),
    );
    const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
    expect(sorted[0]!.r).toBeGreaterThanOrEqual(sorted[sorted.length - 1]!.r);
  });

  it("puts broader capabilities nearer the centre", () => {
    for (const e of edges) {
      if (e.from === ROOT_ID) continue;
      const from = nodes.find((n) => n.id === e.from)!;
      const to = nodes.find((n) => n.id === e.to)!;
      expect(from.depth, `${e.from} → ${e.to}`).toBeLessThan(to.depth);
    }
  });
});

describe("the catalogue's own arithmetic", () => {
  it("recomposes every published composite from its axes and weights", () => {
    for (const entry of cat.entries) {
      const sum = AXES.reduce((total, a) => total + (entry.axes[a.key] ?? 0) * a.weight, 0);
      /* the pipeline rounds axes to one decimal before publishing, so the
         recomposition lands within rounding distance rather than exactly */
      expect(Math.abs(sum - entry.composite), entry.name).toBeLessThan(0.5);
    }
  });
});

describe("the columnar tree", () => {
  const layout = tree(cat);

  it("draws one column per depth in the graph", () => {
    const depths = new Set(layout.nodes.map((n) => n.depth));
    expect(layout.columns.length).toBe(depths.size);
    for (const n of layout.nodes) expect(n.column).toBeLessThan(layout.columns.length);
  });

  it("places every capability in exactly one box", () => {
    expect(layout.nodes.length).toBe(capabilities(cat).length);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(layout.nodes.length);
  });

  it("never overlaps two boxes in the same column", () => {
    for (const column of layout.columns) {
      const inColumn = layout.nodes
        .filter((n) => n.column === column.index)
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < inColumn.length; i++) {
        const above = inColumn[i - 1]!;
        expect(inColumn[i]!.y, `${above.id} overlaps ${inColumn[i]!.id}`).toBeGreaterThanOrEqual(
          above.y + above.h,
        );
      }
    }
  });

  it("runs every connector left to right between boxes that exist", () => {
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const e of layout.edges) {
      const from = byId.get(e.from);
      const to = byId.get(e.to);
      expect(from, e.from).toBeDefined();
      expect(to, e.to).toBeDefined();
      expect(from!.column, `${e.from} -> ${e.to}`).toBeLessThan(to!.column);
      expect(e.path.startsWith("M ")).toBe(true);
    }
  });

  it("reports coverage as a real share of the account", () => {
    for (const n of layout.nodes) {
      expect(n.coverage).toBe(Math.round((n.repos.length / cat.entries.length) * 100));
      expect(n.coverage).toBeGreaterThan(0);
      expect(n.coverage).toBeLessThanOrEqual(100);
    }
  });

  it("lays out identically every time", () => {
    const again = tree(cat);
    expect(again.nodes.map((n) => [n.id, n.x, n.y])).toEqual(layout.nodes.map((n) => [n.id, n.x, n.y]));
  });
});

describe("the tree's boxes", () => {
  const layout = tree(cat);

  it("gives every box the same width and height", () => {
    expect(new Set(layout.nodes.map((n) => n.w)).size).toBe(1);
    expect(new Set(layout.nodes.map((n) => n.h)).size).toBe(1);
  });

  it("fits the coverage bar inside the box with even padding", () => {
    for (const n of layout.nodes) {
      const barWidth = n.segments * TREE_BOX.segW + (n.segments - 1) * TREE_BOX.segGap;
      expect(barWidth, n.id).toBeLessThanOrEqual(n.w - TREE_BOX.pad * 2);
      expect(TREE_BOX.barY + TREE_BOX.barH, n.id).toBeLessThanOrEqual(n.h);
    }
  });

  it("fills segments in proportion to the reading, never empty", () => {
    for (const n of layout.nodes) {
      expect(n.filled, n.id).toBeGreaterThan(0);
      expect(n.filled, n.id).toBeLessThanOrEqual(n.segments);
      expect(n.filled).toBe(Math.max(1, Math.round((n.coverage / 100) * n.segments)));
    }
  });

  it("bands colour by coverage, so the hue still means something", () => {
    for (const n of layout.nodes) {
      const hotter = layout.nodes.filter((o) => o.coverage > n.coverage);
      for (const o of hotter) {
        /* a colder reading never takes a hotter hue */
        const order = ["--verdigris", "--indigo", "--plum", "--ochre", "--oxide"];
        expect(order.indexOf(o.hue), `${o.id} vs ${n.id}`).toBeGreaterThanOrEqual(
          order.indexOf(n.hue),
        );
      }
    }
  });

  it("leaves room above the first row for the column headings", () => {
    const top = Math.min(...layout.nodes.map((n) => n.y));
    expect(top).toBeGreaterThanOrEqual(40);
  });
});

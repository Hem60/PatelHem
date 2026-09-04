/**
 * Evidence, and the graph it implies.
 *
 * The Constellation is not a skill list with lines drawn between things that
 * felt related. Every node is a capability some repository actually evidences,
 * and every edge is a containment relation computed from that evidence: an
 * edge A → B says *B never appears in this account without A*, which is a
 * claim a reader can falsify by opening two repositories.
 *
 * That definition matters. A hand-authored dependency taxonomy would let the
 * page assert "continuous integration requires tests" while one of the
 * catalogued repositories runs CI with no test suite at all. This graph cannot
 * lie that way — if the evidence stops supporting an edge, the edge stops
 * being drawn on the next observing run.
 *
 * Detection is keyed to the pipeline's Herald templates. Herald writes the
 * sentence, this reads it back. test/evidence.test.ts fails loudly if any
 * published sentence stops matching a known template, so a wording change in
 * the pipeline surfaces as a red build rather than a thinning graph.
 */
import type { Catalogue, Entry } from "./catalogue";

export type Category = "practice" | "language";

interface Detector {
  /** Herald's template id. Same string the pipeline uses. */
  readonly id: string;
  readonly label: string;
  readonly gloss: string;
  readonly pattern: RegExp;
  /** Paths this claim points at, relative to the repository root. */
  readonly path?: string;
}

/**
 * One detector per Herald template that describes a capability.
 *
 * `scale` and `stack` are deliberately absent: they are counts, not
 * capabilities. Commits become node weight and languages become their own
 * nodes, read from the entry's stack rather than from prose.
 */
export const DETECTORS: readonly Detector[] = [
  {
    id: "tests",
    label: "Tests",
    gloss: "A test suite exists and is committed.",
    pattern: /^\d+ test files? under `tests\/`\./,
    path: "tests",
  },
  {
    id: "ci",
    label: "Continuous integration",
    gloss: "A workflow runs on every push.",
    pattern: /^Continuous integration runs on every push/,
    path: ".github/workflows",
  },
  {
    id: "typing",
    label: "Static typing",
    gloss: "Type checking is enforced, not optional.",
    pattern: /^Type checking is enforced in strict mode\./,
  },
  {
    id: "lint",
    label: "Linting",
    gloss: "A linter is configured and part of the build.",
    pattern: /^Linting is configured and part of the build\./,
  },
  {
    id: "container",
    label: "Containerised",
    gloss: "The project ships a container definition.",
    pattern: /^Containerised/,
  },
  {
    id: "evals",
    label: "Evaluation harness",
    gloss: "Its own behaviour is measured rather than asserted.",
    pattern: /^Ships an evaluation harness/,
  },
  {
    id: "docs",
    label: "Documentation",
    gloss: "Documents committed under docs/.",
    pattern: /^\d+ documents? under `docs\/`\./,
    path: "docs",
  },
  {
    id: "deployed",
    label: "Deployed",
    gloss: "Reachable at a live URL when last checked.",
    pattern: /^Deployed and reachable\./,
  },
  {
    id: "licensed",
    label: "Licensed",
    gloss: "Released under an explicit licence.",
    pattern: /^Released under /,
  },
];

/** Sentences that are counts rather than capabilities. Matched, then ignored. */
const COUNTED = [/^\d+ commits?/, /^Written in /];

/** Every published sentence must be one or the other. Nothing may fall through. */
export function unmatchedClaims(cat: Catalogue): { repo: string; text: string }[] {
  const out: { repo: string; text: string }[] = [];
  for (const entry of cat.entries) {
    for (const text of entry.summary) {
      const known =
        DETECTORS.some((d) => d.pattern.test(text)) || COUNTED.some((p) => p.test(text));
      if (!known) out.push({ repo: entry.name, text });
    }
  }
  return out;
}

export interface Capability {
  readonly id: string;
  readonly label: string;
  readonly gloss: string;
  readonly category: Category;
  /** Repositories that evidence it, strongest first. */
  readonly repos: readonly string[];
  /** The sentence, per repository, that put it here. */
  readonly evidence: readonly { readonly repo: string; readonly text: string; readonly href: string }[];
}

const repoUrl = (entry: Entry): string => entry.links.code;

/** Capabilities the account can actually evidence, strongest support first. */
export function capabilities(cat: Catalogue): Capability[] {
  const ranked = [...cat.entries].sort((a, b) => b.composite - a.composite);
  const out: Capability[] = [];

  for (const d of DETECTORS) {
    const hits = ranked
      .map((entry) => {
        const text = entry.summary.find((s) => d.pattern.test(s));
        return text === undefined ? null : { entry, text };
      })
      .filter((h): h is { entry: Entry; text: string } => h !== null);
    if (hits.length === 0) continue;

    out.push({
      id: `practice:${d.id}`,
      label: d.label,
      gloss: d.gloss,
      category: "practice",
      repos: hits.map((h) => h.entry.name),
      evidence: hits.map((h) => ({
        repo: h.entry.name,
        text: h.text,
        href: d.path ? `${repoUrl(h.entry)}/tree/HEAD/${d.path}` : repoUrl(h.entry),
      })),
    });
  }

  /* languages come from the stack the survey measured, never from prose */
  const langs = new Map<string, Entry[]>();
  for (const entry of ranked) {
    for (const lang of entry.stack) {
      const list = langs.get(lang) ?? [];
      list.push(entry);
      langs.set(lang, list);
    }
  }
  for (const [lang, entries] of [...langs.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  )) {
    out.push({
      id: `language:${lang}`,
      label: lang,
      gloss: `Measured from the repository's language map.`,
      category: "language",
      repos: entries.map((e) => e.name),
      evidence: entries.map((e) => ({
        repo: e.name,
        text: `${lang} is in the measured language map for ${e.name}.`,
        href: repoUrl(e),
      })),
    });
  }

  return out;
}

export interface Node extends Capability {
  /** Longest path from the root. Rings are drawn by depth. */
  readonly depth: number;
  readonly weight: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface Edge {
  /** The broader capability. */
  readonly from: string;
  /** The narrower one, which never appears without it. */
  readonly to: string;
}

export interface Constellation {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly rings: readonly number[];
  readonly size: number;
}

const ROOT = "root";

/**
 * A → B when support(B) is a strict subset of support(A): B never appears
 * without A. Then take the transitive reduction, so the picture shows the
 * immediate relation rather than every implication it entails.
 */
function implications(supports: Map<string, Set<string>>): Edge[] {
  const ids = [...supports.keys()];
  const subset = (a: Set<string>, b: Set<string>) => [...a].every((v) => b.has(v));
  const strict = (a: string, b: string) => {
    const sa = supports.get(a)!;
    const sb = supports.get(b)!;
    return sb.size < sa.size && subset(sb, sa);
  };

  const direct: Edge[] = [];
  for (const a of ids) {
    for (const b of ids) {
      if (a === b || !strict(a, b)) continue;
      /* immediate only: no c sitting strictly between a and b */
      const mediated = ids.some((c) => c !== a && c !== b && strict(a, c) && strict(c, b));
      if (!mediated) direct.push({ from: a, to: b });
    }
  }
  return direct;
}

/**
 * The radial layout. Deterministic: the same catalogue lays out identically on
 * every machine, so the picture is as reproducible as the ranks are.
 */
export function constellation(cat: Catalogue, size = 720): Constellation {
  const caps = capabilities(cat);
  const all = cat.entries.map((e) => e.name);

  const supports = new Map<string, Set<string>>();
  supports.set(ROOT, new Set(all));
  for (const c of caps) supports.set(c.id, new Set(c.repos));

  const edges = implications(supports);

  /* depth = longest path from the root through the reduced graph */
  const incoming = new Map<string, string[]>();
  for (const e of edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);

  const depths = new Map<string, number>([[ROOT, 0]]);
  const resolve = (id: string, seen: Set<string> = new Set()): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 1; /* cannot happen: subset order is acyclic */
    seen.add(id);
    const parents = incoming.get(id) ?? [ROOT];
    const d = Math.max(...parents.map((p) => resolve(p, seen))) + 1;
    depths.set(id, d);
    return d;
  };
  for (const c of caps) resolve(c.id);

  const maxDepth = Math.max(1, ...caps.map((c) => depths.get(c.id) ?? 1));
  const centre = size / 2;
  const usable = size / 2 - 56;

  /* order within a ring: practices first, then languages, then by support and
     name — so the ring reads as a sequence rather than a scatter */
  const byRing = new Map<number, Capability[]>();
  for (const c of caps) {
    const d = depths.get(c.id) ?? 1;
    byRing.set(d, [...(byRing.get(d) ?? []), c]);
  }

  const nodes: Node[] = [];
  const maxSupport = Math.max(1, ...caps.map((c) => c.repos.length));

  for (const [depth, ring] of [...byRing.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...ring].sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        b.repos.length - a.repos.length ||
        a.label.localeCompare(b.label),
    );
    /* the first ring starts well clear of the root: a ring at a third of the
       radius puts its labels on top of the centre node */
    const radius = usable * (maxDepth === 1 ? 1 : 0.42 + (0.58 * (depth - 1)) / (maxDepth - 1));
    ordered.forEach((c, i) => {
      /* the ring starts at twelve o'clock and runs clockwise; the half-step
         offset per ring keeps nodes on adjacent rings from stacking up */
      const angle = (i / ordered.length) * Math.PI * 2 - Math.PI / 2 + (depth % 2 ? 0 : Math.PI / ordered.length);
      nodes.push({
        ...c,
        depth,
        weight: c.repos.length,
        x: Math.round((centre + Math.cos(angle) * radius) * 100) / 100,
        y: Math.round((centre + Math.sin(angle) * radius) * 100) / 100,
        r: Math.round((7 + 11 * Math.sqrt(c.repos.length / maxSupport)) * 100) / 100,
      });
    });
  }

  const rings = [...new Set(nodes.map((n) => n.depth))]
    .sort((a, b) => a - b)
    .map(
      (d) =>
        Math.round(usable * (maxDepth === 1 ? 1 : 0.42 + (0.58 * (d - 1)) / (maxDepth - 1)) * 100) /
        100,
    );

  return { nodes, edges, rings, size };
}

export interface TreeNode extends Capability {
  readonly depth: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Share of the account evidencing it, 0–100. Drawn as segments. */
  readonly coverage: number;
  /**
   * The CSS token this box is drawn in.
   *
   * Colour bands the coverage rather than decorating the box: the hottest hue
   * is the capability the whole account evidences, the coolest is the one a
   * single repository carries. Colour on this page always means something.
   */
  readonly hue: string;
  /** Filled and total segments in the coverage bar. */
  readonly filled: number;
  readonly segments: number;
}

export interface TreeEdge {
  readonly from: string;
  readonly to: string;
  /** An orthogonal elbow: right out of the parent, across, into the child. */
  readonly path: string;
}

export interface Tree {
  readonly columns: readonly { readonly index: number; readonly label: string; readonly x: number }[];
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  readonly width: number;
  readonly height: number;
}

/** Column headings, in the order the implication graph deepens. */
const COLUMN_LABELS = [
  "Foundations",
  "Built on those",
  "Applied",
  "Where it points",
  "Further out",
];

/** Box geometry. Exported so the renderer never guesses at the layout. */
export const TREE_BOX = {
  pad: 14,
  markerSize: 8,
  labelY: 26,
  barY: 40,
  barH: 7,
  segW: 6,
  segGap: 2,
} as const;

const PAD = TREE_BOX.pad;
const SEG_W = TREE_BOX.segW;
const SEG_GAP = TREE_BOX.segGap;

/**
 * Colour bands the coverage: the hue is hot where the whole account evidences
 * a capability and cool where one repository carries it alone. That keeps the
 * rule this build started with — colour always means something — while giving
 * the tree the range of hues the layout needs to stay readable.
 */
function hueFor(coverage: number): string {
  if (coverage >= 90) return "--oxide";
  if (coverage >= 70) return "--ochre";
  if (coverage >= 50) return "--plum";
  if (coverage >= 30) return "--indigo";
  return "--verdigris";
}

/**
 * The columnar layout, matched to the reference build's capability tree.
 *
 * Same graph as the radial view — computed containment, transitively reduced —
 * laid out left to right by depth rather than outward by ring. Deterministic:
 * no measuring, no randomness, so the picture is as reproducible as the ranks.
 */
export function tree(cat: Catalogue, width = 1200): Tree {
  const caps = capabilities(cat);
  const all = cat.entries.map((e) => e.name);
  const total = Math.max(1, all.length);

  const supports = new Map<string, Set<string>>();
  supports.set(ROOT, new Set(all));
  for (const c of caps) supports.set(c.id, new Set(c.repos));

  const edgeList = implications(supports);

  const incoming = new Map<string, string[]>();
  for (const e of edgeList) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from]);

  const depths = new Map<string, number>([[ROOT, 0]]);
  const resolve = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const parents = incoming.get(id) ?? [ROOT];
    const d = Math.max(...parents.map(resolve)) + 1;
    depths.set(id, d);
    return d;
  };
  for (const c of caps) resolve(c.id);

  const orderedDepths = [...new Set(caps.map((c) => depths.get(c.id) ?? 1))].sort((a, b) => a - b);

  const GAP_X = 58;
  const GAP_Y = 26;
  const NODE_H = 62;
  const HEAD = 48;
  /*
   * Boxes are capped rather than stretched to fill the viewport. A three-stage
   * graph across a wide screen would otherwise produce 360px boxes carrying one
   * short label each, which reads as empty rather than dense.
   */
  const columnWidth = Math.min(
    264,
    Math.max(
      190,
      Math.floor((width - GAP_X * (orderedDepths.length - 1)) / Math.max(1, orderedDepths.length)),
    ),
  );

  /* the bar runs the full inner width of the box, in 5px cells with a 1px gap */
  const segments = Math.max(8, Math.floor((columnWidth - PAD * 2 + SEG_GAP) / (SEG_W + SEG_GAP)));

  const nodes: TreeNode[] = [];
  orderedDepths.forEach((depth, column) => {
    const inColumn = caps
      .filter((c) => (depths.get(c.id) ?? 1) === depth)
      .sort(
        (a, b) =>
          b.repos.length - a.repos.length ||
          a.category.localeCompare(b.category) ||
          a.label.localeCompare(b.label),
      );
    inColumn.forEach((c, row) => {
      const coverage = Math.round((c.repos.length / total) * 100);
      nodes.push({
        ...c,
        depth,
        column,
        x: column * (columnWidth + GAP_X),
        y: HEAD + row * (NODE_H + GAP_Y),
        w: columnWidth,
        h: NODE_H,
        coverage,
        hue: hueFor(coverage),
        filled: Math.max(1, Math.round((coverage / 100) * segments)),
        segments,
      });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: TreeEdge[] = [];
  for (const e of edgeList) {
    if (e.from === ROOT) continue; /* the root has no box to draw from */
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + a.w;
    const y1 = a.y + a.h / 2;
    const x2 = b.x;
    const y2 = b.y + b.h / 2;
    const mid = Math.round((x1 + x2) / 2);
    edges.push({
      from: e.from,
      to: e.to,
      path: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`,
    });
  }

  const tallest = Math.max(
    ...orderedDepths.map((d) => caps.filter((c) => (depths.get(c.id) ?? 1) === d).length),
  );
  const height = HEAD + tallest * NODE_H + (tallest - 1) * GAP_Y;

  return {
    columns: orderedDepths.map((_, i) => ({
      index: i,
      label: COLUMN_LABELS[i] ?? `Stage ${i + 1}`,
      x: i * (columnWidth + GAP_X),
    })),
    nodes,
    edges,
    width: orderedDepths.length * columnWidth + GAP_X * (orderedDepths.length - 1),
    height,
  };
}

/** Everything upstream of a node, back to the root. */
export function ancestors(edges: readonly Edge[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (node: string) => {
    for (const e of edges) {
      if (e.to === node && !out.has(e.from)) {
        out.add(e.from);
        walk(e.from);
      }
    }
  };
  walk(id);
  return out;
}

/** Everything the node underlies, forward. */
export function descendants(edges: readonly Edge[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (node: string) => {
    for (const e of edges) {
      if (e.from === node && !out.has(e.to)) {
        out.add(e.to);
        walk(e.to);
      }
    }
  };
  walk(id);
  return out;
}

export const ROOT_ID = ROOT;

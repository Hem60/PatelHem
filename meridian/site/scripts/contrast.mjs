#!/usr/bin/env node
/*
 * The contrast gate.
 *
 * Maximalist density fails fastest on contrast, so this is a build step and
 * not a review note. It parses styles/tokens.css — the file that actually
 * ships — resolves every colour on both plates, composites the translucent
 * rules over their ground, and measures WCAG 2.1 contrast for every pair the
 * design actually puts together.
 *
 * Exit 1 on any failure. Run: npm run contrast
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(here, "..", "styles", "tokens.css");

/** Pull one selector block's custom properties out of the stylesheet. */
function block(css, selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`selector not found in tokens.css: ${selector}`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  const out = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/i);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  }
  throw new Error(`unparseable colour: ${value}`);
}

/** Source-over composite of a translucent colour on an opaque ground. */
function over(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(fgValue, bgValue) {
  const bg = parseColor(bgValue);
  const fg = over(parseColor(fgValue), bg);
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;      /* body and label text */
const GRAPHIC = 3.0;   /* rules, borders, non-text indicators */

/** Every pair the design actually composes, with the floor it must clear. */
function pairs(t) {
  const grounds = [
    ["sky", t["--sky"]],
    ["plate", t["--plate"]],
    ["plate-raised", t["--plate-raised"]],
  ];
  const text = ["--ink", "--ink-dim", "--ink-faint", "--signal"];
  const classes = ["--c-common", "--c-uncommon", "--c-rare", "--c-epic", "--c-legendary", "--c-mythic"];
  const graphic = ["--rule-hard"];

  const out = [];
  for (const [gname, gval] of grounds) {
    for (const token of [...text, ...classes]) out.push({ fg: token, bg: gname, floor: TEXT, fgv: t[token], bgv: gval });
    for (const token of graphic) out.push({ fg: token, bg: gname, floor: GRAPHIC, fgv: t[token], bgv: gval });
  }
  /* the class chip and the signal chip are filled, and carry ink on the fill */
  out.push({ fg: "--signal-ink", bg: "signal fill", floor: TEXT, fgv: t["--signal-ink"], bgv: t["--signal"] });

  /* the rarity band is a solid fill with inverted ink across it. Six more
     pairs, and the ones most likely to break: a band is the first thing read
     on a card and the fill colour changes with every class. */
  for (const token of classes) {
    out.push({
      fg: "--ink-inverse",
      bg: `${token.replace("--c-", "")} band`,
      floor: TEXT,
      fgv: t["--ink-inverse"],
      bgv: t[token],
    });
  }
  return out;
}

export function audit() {
  const css = readFileSync(TOKENS, "utf8");
  const themes = {
    night: block(css, ':root,\n[data-plate="night"]'),
    day: block(css, '[data-plate="day"]'),
  };
  const rows = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const p of pairs(tokens)) {
      const ratio = contrast(p.fgv, p.bgv);
      rows.push({ theme, ...p, ratio, pass: ratio >= p.floor });
    }
  }
  return rows;
}

if (process.argv[1] && process.argv[1].endsWith("contrast.mjs")) {
  const rows = audit();
  const failed = rows.filter((r) => !r.pass);
  let theme = "";
  for (const r of rows) {
    if (r.theme !== theme) {
      theme = r.theme;
      process.stdout.write(`\n  ${theme.toUpperCase()} PLATE\n`);
    }
    const mark = r.pass ? "·" : "✗";
    process.stdout.write(
      `  ${mark} ${r.fg.padEnd(14)} on ${r.bg.padEnd(13)} ${r.ratio.toFixed(2).padStart(6)}  floor ${r.floor.toFixed(1)}\n`,
    );
  }
  process.stdout.write(
    `\n  ${rows.length - failed.length}/${rows.length} pairs pass. ` +
      (failed.length ? `${failed.length} BELOW FLOOR.\n\n` : "Contrast gate PASSED.\n\n"),
  );
  process.exit(failed.length ? 1 : 0);
}

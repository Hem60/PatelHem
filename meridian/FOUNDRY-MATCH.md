# Meridian → Foundry match

Direction change, decided 2026-08-28. The brief is no longer "cover the same
subject matter, replace every mechanic". It is now: **match the reference build
— PAVAN//FOUNDRY at myselfpavan.vercel.app — in look and structure**, using
Hem Patel's own data and identity.

Measured directly off the live build, not from the screenshots: the reference
has moved on since `photo/` was captured. It now carries rarity bands with
scores on the vault cards, a music toggle in the HUD, and a ninth plate (`THE
ASSAY`).

## What is copied, and what is not

**Copied:** the token system, the four typefaces, the section structure and
order, the plate-numbering device, card anatomy, HUD composition, the XP and
level mechanic, the roster/recruit interaction, mission-console framing, the
columnar capability tree, the hard-cut shadow language, the pointer-tracked
foil, the engraved raster.

**Not copied, at any point:** the `PAVAN//FOUNDRY` wordmark, Pavan Patel's
name, his education, his location, his employer claims, the two Google defect
filings, his operative names and quotes, his project copy. Every fact on
Meridian stays Hem's and stays computed. A cloned layout with someone else's
credentials in it is not a portfolio, it is a forgery.

**Kept from Meridian:** the engine, the pipeline, the computed ranks, the score
breakdowns, Plumb's verification, the live observing run with real API calls.
Those are re-skinned into his vocabulary, not deleted. The reference's scores
are authored; ours will still be computed, which is the one thing the match
does not cost us.

---

## Token system — measured from the live build

```
--paper           #100e0c     the ground. Warm near-black, not blue.
--paper-raised    #171512
--paper-sunken    #0a0908
--paper-inverse   #f4f1e8     inverted bands and the light strip
--ink             #ece5d6     warm cream, not white
--ink-soft        #c4bcab
--ink-muted       #a89f8d
--ink-faint       #857d6d
--rule            rgba(236,229,214,0.18)
--rule-strong     rgba(236,229,214,0.45)
--rule-hair       rgba(236,229,214,0.09)

--oxide           #e2674a     THE accent. Coral-red. Buttons, plate numbers, XP.
--verdigris       #4fb0a0
--indigo          #7d92e0
--ochre           #dcae4e
--plum            #c07aa2
  each with a  -soft  variant at 0.16–0.18 alpha
```

Rarity ramp, his mapping extended to our six bands:

```
COMMON     --ink-muted    UNCOMMON  --verdigris
RARE       --indigo       EPIC      --plum
LEGENDARY  --ochre        MYTHIC    --oxide
```

Geometry and motion:

```
--radius-0/1/2    0px / 2px / 4px          nothing is rounded past 4px
--shadow-cut      3px 3px 0 var(--ink)     hard offset, no blur
--shadow-cut-lg   6px 6px 0 var(--ink)
--shadow-plate    0 1px 0 var(--rule), 0 18px 40px -22px rgba(0,0,0,0.9)
--dur-fast/dur/dur-slow   140ms / 260ms / 620ms
--ease-out        cubic-bezier(0.16,1,0.3,1)
--ease-step       steps(6,end)
--column          1400px       --gutter  clamp(1rem,4vw,4rem)
--measure         68ch
```

Type scale runs `--t-2xs` 0.62rem through `--t-4xl` clamp(3.6rem,2.2rem+6.4vw,9rem).
Spacing scale `--s-1` 0.25rem through `--s-10` 9rem.

## Typefaces — the four to adopt

| Role | Face | Use |
|---|---|---|
| Display | **Pixelify Sans** | every heading, the wordmark, card names, mission titles |
| Micro | **Silkscreen** | plate numbers, eyebrows, band labels, tiny caps |
| Body + data | **IBM Plex Mono** | body copy, all numbers, chips, the whole page's default |
| Lead | **Instrument Serif** | hero lead line, card thesis lines, operative quotes |

This reverses the current stack outright. Big Shoulders, Newsreader, JetBrains
Mono and Handjet all come out. Note that his **body copy is mono** — the page
reads as a console because prose is set in IBM Plex Mono, with serif reserved
for one-sentence leads.

## Section structure — his order, our data

| Plate | His id | His title | Becomes |
|---|---|---|---|
| 01 | `#top` | hero, "DETERMINISTIC BY DESIGN" | hero, Hem's line, computed readout |
| 02 | `#dossier` | WHO YOU ARE READING | current Parallax, as a plain/technical toggle |
| — | — | "This page is a console, not a scroll." | the console explainer |
| 03 | `#roster` | THE ROSTER | the five instruments, as recruitable operatives |
| 04 | `#console` | MISSION CONSOLE | the observing run, re-framed as missions |
| 05 | `#vault` | THE VAULT | the catalogue, as rarity cards |
| 06 | `#tree` | CAPABILITY TREE | the constellation, redrawn columnar |
| 07 | `#log` | THE CAREER LOG | the log + revisions |
| 08 | `#assay` | THE ASSAY | how the score is computed — the rubric |
| 09 | `#shell` | CONSOLE | the console — built, see below |
| 10 | `#signal` | CONTACT | Hailing |

Section head device, replacing the gutter coordinate:

```
PLATE 03  · · · · · · · · · · · · · · · · · · · · · · · · · · ·
THE ROSTER                                    ← Pixelify Sans, --t-3xl
Six operatives, one discipline each…          ← IBM Plex Mono, --measure
```

Plate number in Silkscreen at `--oxide`, followed by a dashed rule to the right
edge. This is the device the previous direction removed on purpose; it comes
back.

## Component anatomy

**HUD** — one bar, top, recombined from the split chrome:
wordmark (pixel, `//` in oxide, underlined) · nav (About, Console, Work,
Skills, Education, Assay, Terminal, Contact) · operative sigil row (one 5×5
pixel glyph per instrument, coloured, `data-on` when recruited) · level and XP
meter · sound toggle · mobile drawer button.

**Vault card** — `--rarity` and agent colour as custom properties on the card:
- rarity band across the top: `MYTHIC` left, `75/100` right, band tinted
- 5×5 pixel sigil, agent colour, in a bordered square
- operative tag + category, micro caps
- name in Pixelify Sans
- one-line thesis in Instrument Serif
- mono description paragraph
- label/value fact grid, 2 columns, ruled
- tech chips, bordered, mono
- footer: `▸ TAP TO INSPECT` left, operative name right
- pointer-tracked foil via `--mx`/`--my`, and a flip to the detail face

Portrait, on a fixed 30rem height so a row stays aligned whether or not an
entry carries a thesis line. The whole front face is one transparent flip
surface: a click anywhere turns the card, including on the project name, which
is text rather than a link for exactly that reason. The repository link lives
on the back as `VIEW CODE ↗` beside a `◂ CLOSE` control, and is the only
element on either face sitting above the flip surface. The face turned away
gets `pointer-events: none` — `backface-visibility` stops it painting but not,
reliably, from swallowing clicks meant for the face in front.

**Mission console** — framed panel, title bar with three squares left,
`FOUNDRY/RUNTIME — M-01` centre, status right. Mission rows: id in oxide,
title in pixel, one-line effect in mono, `+120 XP` right.

**Console (plate 09)** — an inverted title bar, `handle@meridian — shell` left
and a live line count right, over a sunken body: a `$` prompt in oxide with a
muted placeholder, output above it, and a rail of command chips underneath.
Output rows are laid out as a table whose column template is chosen by cell
count, so each command's block aligns with itself.

Command set, all pure functions over data already on the page
(`lib/console.ts`):

| Command | Prints |
|---|---|
| `whoami` | who this is and what he does |
| `projects` | list the indexed builds |
| `open <name>` | open a project's repository |
| `skills` | top capabilities by level |
| `education` | degrees, in progress |
| `awards` | competitive results and appointments |
| `find <query>` | search everything on this page |
| `contact` | how to reach him |
| `clear` | clear the screen |

`help` prints exactly that index and is not listed in it. Arrow keys walk the
history; the line counter counts what was actually printed.

Notes on three of them:

- **`open <name>`** opens the repository in a new tab from inside the keypress
  that asked for it, and prints the URL as well. The URL is the entry's own
  `links.code` — the console never assembles one.
- **`skills`** ranks capabilities by level, where level is the share of the
  catalogue evidencing them, and prints the repositories behind each one. It is
  a measurement, not a self-assessment.
- **`education` and `awards`** read the author-supplied record strand in
  `content/log.json`. Both are empty today, and both say "Nothing recorded"
  rather than inventing an entry.

**Buttons** — square, hard `--shadow-cut`, primary filled oxide with dark ink,
secondary outlined.

## Mechanics to add

- **XP and levels.** Recruiting an operative, dispatching a mission and
  inspecting a card award XP; XP fills a pixel-segment bar and raises a level
  shown in the HUD. Replaces the current resolution meter.
- **Recruit.** Each operative starts un-recruited; clicking recruits it, lights
  its HUD sigil and opens its full briefing.
- **Card flip.** Front face is the summary; the back carries the detail.
- **Foil.** Pointer position tracked into `--mx`/`--my` for the card sheen.
- **Sound toggle.** A music control in the HUD.

## What must stay true

Even under a full match, three rules survive from the original build, because
they are the only things that make this page better than the one it copies:

1. **Ranks stay computed.** His band scores are authored. Ours come out of the
   engine, and the assay plate shows the arithmetic.
2. **The console stays real.** His claims live API calls; ours makes them, and
   the network tab proves it. Never fake a latency to match his pacing.
3. **Nothing claims another person's work.** Authorship stays computed per
   repository and shown.

## Build order

1. ✅ **Tokens and type** — his palette, his four faces, the plate head device
   restored. Contrast gate re-run and passing 68/68 on the new palette.
2. ✅ **HUD** — one bar: wordmark, index, instrument sigils lit by recruitment,
   level and XP, sound, exposure, mobile drawer.
3. ✅ **Hero** — status square, micro eyebrow with boxed tag, pixel headline
   with one word in oxide, serif lead, ruled mono credit line, hard-shadow
   buttons. *(Engraved raster still outstanding.)*
4. ✅ **Vault cards** — rarity band with the computed score, instrument sigil,
   computed category, pixel name, serif thesis, spec grid, tags, pointer
   foil, and a flip to the assay face.
5. ✅ **Roster** — plate 03. Butted instrument panels with sigil, recruit
   control, discipline, an authored line, the real call names as tags, and a
   ruled measurement strip (axis read, account mean, network or pure, entries
   owned). Recruiting awards XP, tints the panel, opens the briefing and
   lights the sigil in the HUD.
6. ✅ **Mission console** — plate 04. Runtime frame with three pips, the
   target and the state; one mission row per catalogued repository with its
   id, pixel title, a computed effect line and its XP. Dispatching runs the
   real survey; the lanes, transcript, meter and reconciliation sit beneath.
7. ✅ **Capability tree** — plate 06. Columnar, stages left to right, ruled
   column headings, boxes with a marker square, name, coverage number and a
   full-width segmented bar, joined by orthogonal connectors. Hovering lights
   the chain both ways. Box geometry is fixed in `TREE_BOX` and asserted by
   tests: uniform width and height, the bar always inside its padding, and the
   column width capped at 264px so wide screens do not stretch a short label
   across a third of the page.
8. ✅ **Console** — plate 09. Live shell with nine commands over the same data
   the page renders; `projects` lists the catalogue, `skills` ranks
   capabilities by evidence, `contact` gives email, GitHub and LinkedIn.
   History on the arrow keys, command chips on a rail, a line counter that
   counts real output.
9. ⬜ Career log, assay, contact, footer; hero raster.

### Notes from the build

- **XP replaces resolution.** Levels 1–8, 400 XP each. Reading a plate is 40,
  inspecting a card 60, recruiting an instrument 120, dispatching a survey 200.
  Progress persists in `localStorage` and awards are keyed so nothing can be
  farmed twice. A level still buys precision only: every plate, card and number
  is on the page at level one.
- **Sigils are computed, not decorative.** Each instrument has a 5×5 bitmap,
  and a repository is filed under the instrument whose axis it scores highest
  on — so the tag on a card is another measurement.
- **The sound toggle synthesises its blip** with WebAudio rather than shipping
  an audio file.
- **Recruiting locks nothing.** The reference opens an operative's briefing on
  recruit; here the discipline, the axis, the account mean, the call list and
  the owned-entry count are all on the panel before anyone clicks. Recruiting
  adds the per-entry breakdown and lights the HUD sigil. The one rule kept from
  the original build is that no claim hides behind an interaction.
- **Instrument ownership is measured.** An entry is filed under the instrument
  reading its strongest axis, and `test/roster.test.ts` checks that every entry
  is filed exactly once and always under the winning axis.
- **Tool lists are the real call names.** A test asserts that the two
  instruments marked `network` are the two that actually appear as dispatchers
  in `lib/run/instruments.ts`, so the roster cannot drift into describing work
  the run does not do.
- **Mission effect lines are computed.** Each row states the band, composite
  and claim count the run will recompute, read from the entry it targets.
- **Box colour bands the coverage** — oxide at 90%+ down to verdigris below
  30% — so the tree gets the reference build's range of hues without colour
  becoming decoration. A test checks that a colder reading never takes a hotter
  hue.
- **The tree is the same graph as the radial view was**, laid out by depth
  instead of by ring. Columns are stages in the computed implication graph and
  the number on a box is the share of the account evidencing it — not an
  authored proficiency score. `tree()` is pure and deterministic, and
  `test/evidence.test.ts` checks that boxes never overlap, that every connector
  runs left to right between boxes that exist, and that the layout is identical
  on every call.
- **The console cannot outrun the page.** Every command is a pure function
  over the catalogue the sections already render, so there is no second source
  of truth to drift. `test/console.test.ts` checks that `projects` lists every
  entry strongest-first with the published class and computed authorship, that
  `why` sums to the published composite, that `find` only returns things that
  actually match and ranks them highest-first, and that `revisions` prints the
  empty state rather than inventing a line.
- **`lib/run/plan.ts` exists for one reason:** the console renders the call
  estimate in the browser, and importing a value from `lib/run/instruments.ts`
  drags `node:fs` into the client bundle. Constants a client component needs
  live apart from the code that does I/O.

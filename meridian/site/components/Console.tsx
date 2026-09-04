"use client";

/**
 * The Console — plate 09.
 *
 * The same index the instruments search, exposed directly. Type instead of
 * scroll: `projects` lists the catalogue, `skills` ranks capabilities by the
 * evidence behind them, `find tests` searches everything on the page.
 *
 * Every command is a pure function over data already on the page
 * (`lib/console.ts`), so nothing here can report something the rest of the
 * page does not. The line counter in the title bar counts what was actually
 * printed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CHIPS, type ConsoleLine, run } from "@/lib/console";
import { classVar } from "@/lib/bands";
import type { Catalogue } from "@/lib/catalogue";
import type { RecordEntry, Skill } from "@/lib/content";
import { OWNER } from "@/lib/owner";
import { Observed } from "./Calibration";
import { SectionHead } from "./Plate";

/*
 * The line the shell opens on.
 *
 * An empty box with a blinking prompt tells a first-time reader nothing about
 * what it accepts. One line does: the two ways in are typing `help` and
 * clicking a chip, and both are named.
 */
const GREETING: ConsoleLine = {
  kind: "text",
  text: "meridian shell — type `help`, or click a suggestion below.",
  tone: "dim",
};

const TONE: Record<string, string> = {
  accent: "var(--oxide)",
  dim: "var(--ink-faint)",
  ok: "var(--verdigris)",
  warn: "var(--ochre)",
};

export function Console({
  cat,
  record,
  skills,
}: {
  cat: Catalogue;
  record: RecordEntry[];
  skills: Skill[];
}) {
  const [lines, setLines] = useState<ConsoleLine[]>([GREETING]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const body = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = body.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines]);

  const submit = useCallback(
    (raw: string) => {
      const command = raw.trim();
      if (command === "") return;

      if (command.toLowerCase() === "clear") {
        /* `clear` empties the scrollback and reprints the greeting, so the box
           never sits blank with no hint of what it takes. */
        setLines([GREETING]);
        setHistory((h) => [command, ...h]);
        setValue("");
        setCursor(-1);
        return;
      }

      const result = run(command, { cat, record, skills, owner: OWNER });
      setLines((prev) => [...prev, { kind: "input", text: command }, ...result.lines]);

      /* `open` navigates, and it does so from inside the keypress that asked
         for it — which is both what the user requested and what keeps the
         browser from treating it as an unsolicited pop-up. */
      if (result.open) window.open(result.open, "_blank", "noopener,noreferrer");
      setHistory((h) => [command, ...h]);
      setValue("");
      setCursor(-1);
    },
    [cat, record, skills],
  );

  /* up and down walk the history, the way a shell does */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(cursor + 1, history.length - 1);
      if (next >= 0) {
        setCursor(next);
        setValue(history[next] ?? "");
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = cursor - 1;
      setCursor(next);
      setValue(next < 0 ? "" : (history[next] ?? ""));
    }
  };

  return (
    <Observed id="shell" className="shell">
      <SectionHead plate="09" title="Console" note="Type instead of scroll" />

      <p className="t-body mb-6">
        The same index the instruments search, exposed directly. Everything reachable here is also
        on the page above — the console is a faster route through it, never the only way to
        something.
      </p>

      <div className="term">
        <div className="term__bar">
          <span>
            {OWNER.handle.toLowerCase()}@meridian — shell
          </span>
          <span>{lines.length} lines</span>
        </div>

        <div
          ref={body}
          className="term__body"
          onClick={() => input.current?.focus()}
          role="log"
          aria-live="polite"
        >
          {lines.map((line, i) => (
            <Line key={i} line={line} />
          ))}

          <div className="term__prompt">
            <span aria-hidden="true">$</span>
            <input
              ref={input}
              className="term__input"
              value={value}
              spellCheck={false}
              autoComplete="off"
              placeholder="type a command…"
              aria-label="Console command"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(value);
                else onKeyDown(e);
              }}
            />
          </div>
        </div>

        <div className="term__chips">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className="tag"
              onClick={() => {
                submit(c === "find" ? "find tests" : c);
                input.current?.focus();
              }}
            >
              {c === "find" ? "find tests" : c}
            </button>
          ))}
        </div>
      </div>
    </Observed>
  );
}

function Line({ line }: { line: ConsoleLine }) {
  if (line.kind === "blank") return <div style={{ height: "0.55rem" }} />;

  if (line.kind === "input") {
    return (
      <p className="term__line">
        <span style={{ color: "var(--oxide)" }}>$ </span>
        <span style={{ color: "var(--ink)" }}>{line.text}</span>
      </p>
    );
  }

  if (line.kind === "error") {
    return (
      <p className="term__line" style={{ color: "var(--oxide)" }}>
        {line.text}
      </p>
    );
  }

  if (line.kind === "row") {
    const cells = line.cells ?? [];
    return (
      <p className="term__row" data-cols={cells.length} data-lead={line.lead}>
        {cells.map((cell, i) => (
          <span
            key={i}
            style={{
              color:
                i === 0 && line.klass
                  ? "var(--ink)"
                  : i === 1 && line.klass
                    ? classVar(line.klass)
                    : i === 0
                      ? "var(--ink-soft)"
                      : "var(--ink-faint)",
            }}
          >
            {line.href && i === 0 ? (
              <a href={line.href} rel="noreferrer noopener" target="_blank">
                {cell}
              </a>
            ) : (
              cell
            )}
          </span>
        ))}
      </p>
    );
  }

  return (
    <p className="term__line" style={{ color: line.tone ? TONE[line.tone] : "var(--ink-soft)" }}>
      {line.text}
    </p>
  );
}

"use client";

/**
 * The Observing Run.
 *
 * Press dispatch and five instruments survey a repository live. The header
 * states what the run is expected to cost before it starts; the footer states
 * what it actually spent, how much of that was cache, and what the API says is
 * left on the rate limit. Every latency on screen was measured around a real
 * request.
 *
 * The transcript uses a dual register: the machine line first, then the same
 * event in plain language. A visitor who does not read HTTP still learns what
 * happened, and a visitor who does can check it against their network tab.
 *
 * What this panel will never do is claim a call it did not make. That is the
 * exact thing the reference build was caught doing, and the reason this
 * section exists at all.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEvent } from "@/lib/run/instruments";
import { ESTIMATED_CALLS } from "@/lib/run/plan";
import type { Catalogue, Entry } from "@/lib/catalogue";
import { classVar } from "@/lib/bands";
import { Observed, XP_AWARDS, useProgress } from "./Calibration";
import { Plate, SectionHead } from "./Plate";
import { Marker, Note, Notes } from "./Marginalia";

const INSTRUMENTS = [
  { id: "almanac", name: "Almanac", job: "Retrieves history, contributors, releases, last CI run.", network: true },
  { id: "prism", name: "Prism", job: "Reads the file tree, the language map and the manifests.", network: true },
  { id: "sextant", name: "Sextant", job: "Scores the five axes. Pure function, no calls.", network: false },
  { id: "herald", name: "Herald", job: "Writes the entry from templates bound to signals.", network: false },
  { id: "plumb", name: "Plumb", job: "Verifies every clause against a path that resolves.", network: false },
] as const;

type LaneState = "idle" | "running" | "done";

interface Line {
  readonly key: string;
  readonly instrument: string;
  readonly machine: string;
  readonly plain?: string;
  readonly ms?: number;
  readonly cached?: boolean;
  readonly status?: number;
}

interface Meter {
  calls: number;
  network: number;
  cacheHits: number;
  elapsed: number;
  rateRemaining: number | null;
  rateLimit: number | null;
}

const EMPTY_METER: Meter = {
  calls: 0,
  network: 0,
  cacheHits: 0,
  elapsed: 0,
  rateRemaining: null,
  rateLimit: null,
};

export function ObservingRun({ cat }: { cat: Catalogue }) {
  const entries = [...cat.entries].sort((a, b) => b.composite - a.composite);
  const [target, setTarget] = useState(entries[0]?.name ?? "");
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [lanes, setLanes] = useState<Record<string, LaneState>>({});
  const [meter, setMeter] = useState<Meter>(EMPTY_METER);
  const [mode, setMode] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<RunEvent, { t: "done" }> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { award } = useProgress();
  const source = useRef<EventSource | null>(null);
  const log = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => source.current?.close(), []);

  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines]);

  const dispatch = useCallback((repo: string) => {
    source.current?.close();
    setLines([]);
    setLanes({});
    setMeter(EMPTY_METER);
    setResult(null);
    setFailure(null);
    setMode(null);
    setRunning(true);

    award(`survey:${repo}`, XP_AWARDS.survey);

    const es = new EventSource(`/api/run?repo=${encodeURIComponent(repo)}`);
    source.current = es;

    es.addEventListener("end", () => {
      es.close();
      setRunning(false);
    });

    es.onerror = () => {
      es.close();
      setRunning(false);
      setFailure((prev) => prev ?? "The stream closed before the run finished.");
    };

    es.onmessage = (message) => {
      const event = JSON.parse(message.data) as RunEvent;

      if (event.t === "start") {
        setMode(event.mode);
        setLines((prev) => [
          ...prev,
          {
            key: `start-${prev.length}`,
            instrument: "run",
            machine: `DISPATCH  ${event.owner}/${event.repo} · estimate ${event.estimatedCalls} calls · ${event.mode}`,
            plain: `Surveying ${event.repo}. The estimate above is what the run expects to spend; the footer will say what it actually spent.`,
          },
        ]);
      }

      if (event.t === "dispatch") {
        setLanes((prev) => ({ ...prev, [event.instrument]: "running" }));
        setLines((prev) => [
          ...prev,
          {
            key: `d-${prev.length}`,
            instrument: event.instrument,
            machine: `→ ${event.request}`,
          },
        ]);
      }

      if (event.t === "receive") {
        setLanes((prev) => ({ ...prev, [event.instrument]: "done" }));
        setLines((prev) => [
          ...prev,
          {
            key: `r-${prev.length}`,
            instrument: event.instrument,
            machine: `← ${event.summary}`,
            ms: event.ms,
            cached: event.cached,
            status: event.status,
          },
        ]);
      }

      if (event.t === "note") {
        setLines((prev) => [
          ...prev,
          { key: `n-${prev.length}`, instrument: event.instrument, machine: "", plain: event.text },
        ]);
      }

      if (event.t === "meter") {
        setMeter({
          calls: event.calls,
          network: event.network,
          cacheHits: event.cacheHits,
          elapsed: event.elapsed,
          rateRemaining: event.rateRemaining,
          rateLimit: event.rateLimit,
        });
      }

      if (event.t === "done") {
        setResult(event);
        setMeter((prev) => ({
          ...prev,
          calls: event.calls,
          network: event.network,
          cacheHits: event.cacheHits,
          elapsed: event.elapsed,
        }));
      }

      if (event.t === "error") setFailure(event.message);
    };
  }, [award]);

  const published = entries.find((e) => e.name === target) ?? null;

  /*
   * One mission per catalogued repository, in rank order. The effect line is
   * computed from the entry rather than written: it states what this run will
   * recompute, in the numbers it will recompute.
   */
  const missions = entries.map((entry, i) => ({
    id: `M-${String(i + 1).padStart(2, "0")}`,
    repo: entry.name,
    title: `Survey ${entry.name}`,
    effect: `Recomputes the ${entry.classification} band at ${entry.composite.toFixed(
      1,
    )}, five readings, and re-verifies ${entry.summary.length} claims.`,
  }));
  const selectedMission = missions.find((m) => m.repo === target) ?? null;

  return (
    <Observed id="observing-run" className="shell">
      <SectionHead plate="04" title="Mission console" note="Real calls · dispatched on demand" />

      <div className="spread mb-6">
        <p className="t-body lg:col-span-8 lg:pr-10">
          Dispatch a survey and watch it happen. Two of the five instruments make real requests to
          the GitHub API<Marker n={1} />; three are pure functions and say so rather than
          pretending to be busy. Every latency below was measured around an actual request, and
          the footer reconciles what the run estimated against what it spent.
        </p>
        <Notes className="lg:col-span-4">
          <Note n={1}>
            Open your network tab before pressing dispatch. Every line the transcript claims has a
            matching request behind it — that is the whole point of the section.
          </Note>
          <Note n={2}>
            Responses are cached per commit SHA. A cached read is labelled cached and shows its
            disk time, not a network time it never spent.
          </Note>
          <Note n={3}>
            One axis is scored against an approximation. Anomaly compares a repository to the rest
            of the account, and a live run reads that distribution from the published catalogue
            rather than recollecting every repository — so anomaly, and only anomaly, can differ
            by a few points from the published entry.
          </Note>
        </Notes>
      </div>

      {/* the runtime frame: three squares, the target, the state */}
      <div className="runtime">
        <div className="runtime__bar">
          <span className="runtime__pips" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="runtime__title">
            Meridian/runtime — {selectedMission ? selectedMission.id : "idle"}
          </span>
          <span
            className="runtime__state"
            style={{ color: running ? "var(--oxide)" : result ? "var(--verdigris)" : "var(--ink-faint)" }}
          >
            {running ? "Observing" : result ? "Complete" : "Idle"}
          </span>
        </div>

        {/* the missions. One per catalogued repository, dispatched for real. */}
        <ul>
          {missions.map((m) => {
            const active = m.repo === target;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="mission"
                  data-active={active}
                  disabled={running}
                  onClick={() => {
                    setTarget(m.repo);
                    dispatch(m.repo);
                  }}
                >
                  <span className="mission__id">{m.id}</span>
                  <span className="mission__body">
                    <span className="mission__title t-display">{m.title}</span>
                    <span className="mission__effect t-data">{m.effect}</span>
                  </span>
                  <span className="mission__xp">+{XP_AWARDS.survey} XP</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="margin-note px-4 pb-3 pt-1">
          Estimated cost: {ESTIMATED_CALLS} calls per mission. Only catalogued repositories can be
          dispatched — an open target box here would be an open proxy on somebody else&rsquo;s rate
          limit.
        </p>
      </div>

      <div className="spread mt-4">
        {/* the instrument lanes */}
        <Plate className="p-4 lg:col-span-4">
          <div className="header-rule mb-3">
            <span className="t-pixel" style={{ color: "var(--oxide)" }}>
              Lanes
            </span>
          </div>
          <ul>
            {INSTRUMENTS.map((i) => {
              const state = lanes[i.id] ?? "idle";
              return (
                <li key={i.id} className="border-b py-2.5" style={{ borderColor: "var(--rule)" }}>
                  <div className="flex items-baseline gap-2">
                    <span className="t-data" style={{ fontSize: "var(--t-sm)", color: "var(--ink)" }}>
                      {i.name}
                    </span>
                    <span
                      className="label ml-auto"
                      style={{
                        color:
                          state === "running"
                            ? "var(--oxide)"
                            : state === "done"
                              ? "var(--ink-soft)"
                              : "var(--ink-faint)",
                      }}
                    >
                      {state === "idle" ? (i.network ? "network" : "pure") : state}
                    </span>
                  </div>
                  <p className="margin-note mt-1">{i.job}</p>
                  {state === "running" && (
                    <span className="live-rule mt-1.5 block" data-live="true" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        </Plate>

        {/* the transcript */}
        <Plate className="p-4 lg:col-span-8 butt" raised corners={4}>
          <div className="header-rule mb-3">
            <span className="t-pixel" style={{ color: "var(--oxide)" }}>
              Transcript
            </span>
            <span className="label">
              {mode === null ? "idle" : mode === "authenticated" ? "token · 5,000/hr" : "anonymous · 60/hr"}
            </span>
          </div>

          <div
            ref={log}
            className="overflow-y-auto"
            style={{ height: "22rem", scrollbarWidth: "thin" }}
            aria-live="polite"
          >
            {lines.length === 0 && !failure && (
              <p className="t-body" style={{ fontSize: "var(--t-sm)" }}>
                Nothing has run yet, and the panel is not going to invent a transcript to fill
                the space. Pick a mission above.
              </p>
            )}

            {lines.map((line) => (
              <div key={line.key} className="mb-1.5">
                {line.machine && (
                  <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-dim)" }}>
                    <span
                      className="mr-2 inline-block w-16 uppercase tracking-[0.14em]"
                      style={{ color: "var(--ink-faint)" }}
                    >
                      {line.instrument}
                    </span>
                    {line.machine}
                    {line.ms !== undefined && (
                      <span style={{ color: line.cached ? "var(--ink-faint)" : "var(--signal)" }}>
                        {"  "}
                        [{line.ms.toFixed(1)}ms{line.cached ? " · cached" : ""}]
                      </span>
                    )}
                    {line.status !== undefined && line.status !== 200 && (
                      <span style={{ color: "var(--c-mythic)" }}> {line.status}</span>
                    )}
                  </p>
                )}
                {line.plain && (
                  <p
                    className="t-body ml-[4.5rem] mt-0.5"
                    style={{ fontSize: "var(--t-sm)", maxWidth: "60ch" }}
                  >
                    {line.plain}
                  </p>
                )}
              </div>
            ))}

            {failure && (
              <p className="t-data mt-2" style={{ fontSize: "var(--t-sm)", color: "var(--c-mythic)" }}>
                {failure}
              </p>
            )}
          </div>

          {/* the footer meter — what it actually cost */}
          <dl
            className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t pt-2"
            style={{ borderColor: "var(--rule)" }}
          >
            <Reading label="Calls" value={String(meter.calls)} />
            <Reading label="Network" value={String(meter.network)} />
            <Reading label="Cache hits" value={String(meter.cacheHits)} />
            <Reading label="Elapsed" value={`${(meter.elapsed / 1000).toFixed(2)}s`} />
            <Reading
              label="Rate limit left"
              value={
                meter.rateRemaining === null
                  ? "—"
                  : `${meter.rateRemaining}${meter.rateLimit ? ` / ${meter.rateLimit}` : ""}`
              }
            />
          </dl>
        </Plate>
      </div>

      {/* the reconciliation: what the run computed against what is published */}
      {result && published && <Reconciliation result={result} published={published} />}
    </Observed>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="label">{label}</dt>
      <dd className="t-data" style={{ fontSize: "var(--t-sm)" }}>
        {value}
      </dd>
    </div>
  );
}

function Reconciliation({
  result,
  published,
}: {
  result: Extract<RunEvent, { t: "done" }>;
  published: Entry;
}) {
  const drift = Math.round((result.composite - published.composite) * 10) / 10;
  const same = result.classification === published.classification;

  return (
    <div className="spread mt-4">
      <Plate className="p-4 lg:col-span-7">
        <div className="header-rule mb-3">
          <span className="t-pixel" style={{ color: "var(--signal)" }}>
            This run
          </span>
          <span className="label">vs the published entry</span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <p className="label mb-1">Computed just now</p>
            <p className="t-data" style={{ fontSize: "var(--t-lg)" }}>
              {result.composite.toFixed(1)}{" "}
              <span className="chip ml-1" style={{ ["--class" as string]: classVar(result.classification as never) }}>
                {result.classification}
              </span>
            </p>
          </div>
          <div>
            <p className="label mb-1">Published entry</p>
            <p className="t-data" style={{ fontSize: "var(--t-lg)", color: "var(--ink-dim)" }}>
              {published.composite.toFixed(1)}{" "}
              <span className="chip ml-1" style={{ ["--class" as string]: classVar(published.classification) }}>
                {published.classification}
              </span>
            </p>
          </div>
          <div>
            <p className="label mb-1">Drift</p>
            <p className="t-data" style={{ fontSize: "var(--t-lg)", color: drift === 0 ? "var(--ink-dim)" : "var(--signal)" }}>
              {drift > 0 ? "+" : ""}
              {drift.toFixed(1)}
            </p>
          </div>
        </div>

        <p className="t-body mt-3" style={{ fontSize: "var(--t-sm)" }}>
          {drift === 0 && same
            ? `The live survey lands on the published number exactly. Same code, same rubric, same repository state — which is what a reproducible rank is supposed to look like.`
            : `The live survey differs from the published entry by ${Math.abs(drift).toFixed(1)} points${same ? "" : `, and the class reads ${result.classification} rather than ${published.classification}`}. Nothing was adjusted to hide it, and there are exactly three things it can be: the repository has changed since the last observing run; the clock has moved, which decays cadence a little every day; or the anomaly axis is reading against an approximated account context — a live run scores one repository against the published catalogue's stack lists rather than recollecting every language map in the account, because that would spend the entire anonymous rate limit on arithmetic.`}
        </p>

        <ul className="mt-3">
          {result.upheld.map((line) => (
            <li key={line} className="margin-note mb-0.5">
              ├ {line}
            </li>
          ))}
          {result.rejected.map((r) => (
            <li key={r.text} className="margin-note mb-0.5" style={{ color: "var(--c-mythic)" }}>
              ✗ {r.text} — rejected: {r.rejection}
            </li>
          ))}
        </ul>
      </Plate>

      <Plate className="p-4 lg:col-span-5 butt">
        <div className="header-rule mb-3">
          <span className="label">Axes, this run</span>
        </div>
        <dl>
          {Object.entries(result.axes).map(([axis, value]) => {
            const before = published.axes[axis];
            const moved = before === undefined ? 0 : Math.round((value - before) * 10) / 10;
            return (
              <div
                key={axis}
                className="flex items-baseline gap-3 border-b py-1.5"
                style={{ borderColor: "var(--rule)" }}
              >
                <dt className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-dim)", width: "6rem" }}>
                  {axis}
                </dt>
                <dd className="t-data" style={{ fontSize: "var(--t-sm)" }}>
                  {value.toFixed(1)}
                </dd>
                <dd
                  className="t-data ml-auto"
                  style={{ fontSize: "var(--t-xs)", color: moved === 0 ? "var(--ink-faint)" : "var(--signal)" }}
                >
                  {moved > 0 ? "+" : ""}
                  {moved.toFixed(1)}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="margin-note mt-2">
          Right-hand column is movement against the published entry. Scoring itself made no network
          calls: the survey collected, and the engine computed.
        </p>
      </Plate>
    </div>
  );
}

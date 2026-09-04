"use client";

/**
 * The Roster — plate 03.
 *
 * Five instruments, one discipline each, laid out as butted panels the way the
 * reference build lays out its operatives. Recruiting one awards XP and lights
 * its sigil in the HUD.
 *
 * Nothing is locked. Every card states its discipline, the axis it reads, the
 * account mean on that axis, what it actually calls and which repositories it
 * owns, before anyone clicks anything. Recruiting opens the briefing — the
 * arithmetic and the entry list — and the control that opens it is visible on
 * the card from the first paint. A page that hides its claims behind an
 * interaction is a page betting you will not interact.
 *
 * The tool lists are the real call names used by lib/run/instruments.ts. A
 * decorative tool list would be the easiest lie on this page to tell.
 */
import type { Catalogue } from "@/lib/catalogue";
import { SIGILS, axisMean, ownedBy } from "@/lib/sigil";
import { XP_AWARDS, useProgress } from "./Calibration";
import { Observed } from "./Calibration";
import { SectionHead } from "./Plate";
import { Sigil } from "./Sigil";

export function Roster({ cat }: { cat: Catalogue }) {
  const { isRecruited, recruit, recruited } = useProgress();

  return (
    <Observed id="roster" className="shell">
      <SectionHead plate="03" title="The roster" note={`${recruited.length} of ${SIGILS.length} recruited`} />

      <p className="t-body mb-6">
        Five instruments, one discipline each — they are the five things the survey actually does.
        Recruit one to earn XP and open its briefing. All five work from the start, and every
        reading below is on the page whether you click or not.
      </p>

      <ul className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
        {SIGILS.map((s, i) => {
          const owned = ownedBy(cat.entries, s.id);
          const mean = axisMean(cat.entries, s.axis);
          const on = isRecruited(s.id);
          return (
            <li
              key={s.id}
              className={`relative border p-5 ${i > 0 ? "md:-ml-px" : ""} -mt-px first:mt-0`}
              style={{
                borderColor: on ? `color-mix(in srgb, var(${s.token}) 55%, transparent)` : "var(--rule)",
                background: on ? `color-mix(in srgb, var(${s.token}) 5%, transparent)` : "transparent",
                color: `var(${s.token})`,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex items-center justify-center border"
                  style={{ borderColor: "currentColor", padding: "7px", lineHeight: 0 }}
                >
                  <Sigil id={s.id} size={4} on />
                </span>

                <button
                  type="button"
                  onClick={() => recruit(s.id)}
                  className="label ml-auto roster__recruit"
                  style={{ color: on ? `var(${s.token})` : "var(--ink-faint)", letterSpacing: "0.18em" }}
                  aria-pressed={on}
                >
                  {on ? "◆ Recruited" : "◇ Recruit"}
                </button>
              </div>

              <h3 className="t-display mt-4" style={{ fontSize: "var(--t-lg)", color: "var(--ink)" }}>
                {s.name}
              </h3>
              <p className="label" style={{ color: "var(--ink-faint)" }}>
                {s.discipline}
              </p>

              <p className="t-thesis mt-3" style={{ fontSize: "var(--t-base)" }}>
                &ldquo;{s.line}&rdquo;
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.tools.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>

              <dl
                className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t pt-2"
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="flex items-baseline gap-1.5">
                  <dt className="label">Reads</dt>
                  <dd className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink)" }}>
                    {s.axis}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="label">Account mean</dt>
                  <dd className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink)" }}>
                    {mean === null ? "—" : mean.toFixed(1)}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="label">Calls</dt>
                  <dd className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink)" }}>
                    {s.network ? "network" : "none — pure"}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="label">Owns</dt>
                  <dd className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink)" }}>
                    {owned.length}
                  </dd>
                </div>
              </dl>

              {/* the briefing. Opened by recruiting, and by nothing else that
                  matters: everything above is already on the page. */}
              {on && (
                <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
                  <p className="label mb-2">Briefing · entries filed under {s.name}</p>
                  {owned.length === 0 ? (
                    <p className="t-data" style={{ fontSize: "var(--t-xs)", color: "var(--ink-faint)" }}>
                      Nothing in the catalogue reads {s.axis} as its strongest axis, so this
                      instrument owns no entries today. It still runs on every survey.
                    </p>
                  ) : (
                    <ul>
                      {owned.map((e) => (
                        <li
                          key={e.name}
                          className="t-data flex items-baseline gap-2"
                          style={{ fontSize: "var(--t-xs)", color: "var(--ink-soft)" }}
                        >
                          <span style={{ color: `var(${s.token})` }}>▸</span>
                          <a href={e.links.code} rel="noreferrer noopener" target="_blank">
                            {e.name}
                          </a>
                          <span style={{ color: "var(--ink-faint)" }}>
                            {s.axis} {(e.axes[s.axis] ?? 0).toFixed(1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="label mt-2" style={{ color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                    +{XP_AWARDS.recruit} XP awarded once. Recruiting lights this sigil in the HUD
                    and does not unlock anything, because nothing here was locked.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Observed>
  );
}

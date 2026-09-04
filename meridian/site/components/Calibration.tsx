"use client";

/**
 * Progress — XP, levels, recruitment, and the resolution they buy.
 *
 * Matched to the reference build's mechanic: reading a plate, recruiting an
 * instrument, dispatching a survey and inspecting a card all award XP; XP
 * fills a segmented bar and raises a level shown in the HUD.
 *
 * The one rule kept from the earlier build: **a level never hides anything.**
 * Every plate, card and number is on the page at level one. What a level buys
 * is precision — 67 becomes 67.4 becomes 67.40 — and a lit sigil. A visitor
 * who lands, reads nothing and leaves has still seen every claim made here.
 *
 * Awards are keyed, so the same action cannot be farmed twice.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Resolution } from "@/lib/format";

const XP_PER_LEVEL = 400;
const MAX_LEVEL = 8;
const STORAGE = "meridian.progress";

export const XP_AWARDS = {
  plate: 40,
  recruit: 120,
  survey: 200,
  inspect: 60,
} as const;

interface ProgressState {
  xp: number;
  level: number;
  /** XP into the current level, and what the level costs. */
  intoLevel: number;
  perLevel: number;
  resolution: Resolution;
  recruited: readonly string[];
  isRecruited: (id: string) => boolean;
  /**
   * Whether the ambient track is playing.
   *
   * The only sound the page makes. There were synthesised interface tones —
   * a click on every control, and two progress blips — and all of them are
   * gone: the blips fired on scroll rather than on a press, and the click was
   * removed after them. Nothing here now makes a noise the reader did not
   * explicitly ask for by pressing this control.
   */
  sound: boolean;
  toggleSound: () => void;
  /** Whether a track is actually playing, or was asked for and not found. */
  music: "unknown" | "playing" | "missing";
  /** Award once for this key. Repeat calls with the same key do nothing. */
  award: (key: string, amount: number) => void;
  recruit: (id: string) => void;
  /** Kept for the sections that report themselves read. */
  observe: (id: string) => void;
  seen: number;
  total: number;
  /**
   * A count of each kind of action this reader has taken.
   *
   * Derived from the claimed keys rather than kept as its own counters — the
   * keys are already the source of truth for what has been awarded, and a
   * second tally would be a second thing to keep in step.
   */
  tally: { plates: number; recruits: number; inspects: number; surveys: number };
  /** Clear everything and start again. Wipes storage as well as state. */
  reset: () => void;
}

const Ctx = createContext<ProgressState | null>(null);

export function useProgress(): ProgressState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress outside the provider");
  return ctx;
}

/** Back-compatible name: the resolution figures are printed at. */
export function useResolution(): Resolution {
  return useProgress().resolution;
}

export function useCalibration(): ProgressState {
  return useProgress();
}

/**
 * The looping track, if one has been added.
 *
 * Drop a file at `public/audio/ambient.mp3` and the sound toggle plays it.
 * Leave the folder empty and the toggle still works — it just carries the
 * click tick alone, and says so. Nothing here assumes the file exists,
 * because a 404 that silently does nothing is the kind of dead control this
 * page is supposed to be the opposite of.
 */
const TRACK = "/audio/ambient.mp3";
const TRACK_VOLUME = 0.32;
const FADE_MS = 900;

export function CalibrationProvider({ children }: { children: ReactNode }) {
  const [xp, setXp] = useState(0);
  const [recruited, setRecruited] = useState<string[]>([]);
  /* off until asked for: an ambient loop is unsolicited by nature */
  const [sound, setSound] = useState(false);
  const [seen, setSeen] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [music, setMusic] = useState<"unknown" | "playing" | "missing">("unknown");
  const claimed = useRef<Set<string>>(new Set());
  const soundRef = useRef(false);
  const track = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<number | null>(null);

  /* hydrate after mount: reading storage during render would desync the
     server-rendered markup from the first client paint */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw) as {
          xp?: number;
          recruited?: string[];
          sound?: boolean | string;
          keys?: string[];
        };
        if (typeof saved.xp === "number") setXp(saved.xp);
        if (Array.isArray(saved.recruited)) setRecruited(saved.recruited);
        /*
         * Migrate both older shapes. This preference has been a boolean, then
         * a three-state mode, and is a boolean again — only the mode that
         * actually played the track maps to true.
         */
        const on =
          typeof saved.sound === "boolean"
            ? saved.sound
            : saved.sound === "all"
              ? true
              : saved.sound === "ui" || saved.sound === "off"
                ? false
                : null;
        if (on !== null) {
          setSound(on);
          soundRef.current = on;
        }
        if (Array.isArray(saved.keys)) claimed.current = new Set(saved.keys);
      }
    } catch {
      /* a browser refusing storage just means progress starts fresh */
    } finally {
      setHydrated(true);
    }
  }, []);

  /*
   * One writer, driven by the state itself.
   *
   * Persisting inside each action looked fine and was wrong: the callbacks
   * closed over a stale `xp`, so a recruit wrote the score from before the
   * award. Writing from an effect means what is saved is what is rendered.
   * The `hydrated` guard stops the first pass overwriting saved progress with
   * the initial zeroes.
   */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ xp, recruited, sound, keys: [...claimed.current] }),
      );
    } catch {
      /* not worth failing an interaction over */
    }
  }, [hydrated, xp, recruited, sound]);

  const award = useCallback((key: string, amount: number) => {
    if (claimed.current.has(key)) return;
    claimed.current.add(key);
    setXp((prev) => prev + amount);
    /*
     * No tone on an award.
     *
     * XP is granted by `observe`, which fires when a plate scrolls into view —
     * so this beeped at the reader for merely scrolling, with no action of
     * theirs behind it. Sound belongs on a deliberate press and nowhere else.
     */
  }, []);

  const observe = useCallback(
    (id: string) => {
      const key = `plate:${id}`;
      if (claimed.current.has(key)) return;
      setSeen((n) => n + 1);
      award(key, XP_AWARDS.plate);
    },
    [award],
  );

  const recruit = useCallback(
    (id: string) => {
      setRecruited((prev) => (prev.includes(id) ? prev : [...prev, id]));
      award(`recruit:${id}`, XP_AWARDS.recruit);
      /* likewise: recruiting is a side effect of reading, not a keypress */
    },
    [award],
  );

  /** Ramp the volume rather than cutting it — a loop that snaps on is worse
   *  than no loop at all. */
  const rampTo = useCallback((target: number, onDone?: () => void) => {
    const el = track.current;
    if (!el) return;
    if (fade.current) window.clearInterval(fade.current);
    const steps = 18;
    const from = el.volume;
    let i = 0;
    fade.current = window.setInterval(() => {
      i += 1;
      el.volume = Math.min(1, Math.max(0, from + ((target - from) * i) / steps));
      if (i >= steps) {
        if (fade.current) window.clearInterval(fade.current);
        fade.current = null;
        onDone?.();
      }
    }, FADE_MS / steps);
  }, []);

  const toggleSound = useCallback(() => {
    setSound((prev) => {
      const next = !prev;
      soundRef.current = next;

      if (next) {
        /* built here rather than at mount: nothing is fetched until somebody
           actually asks for sound */
        if (!track.current) {
          const el = new Audio(TRACK);
          el.loop = true;
          el.preload = "none";
          el.volume = 0;
          track.current = el;
        }
        void track.current
          .play()
          .then(() => {
            setMusic("playing");
            rampTo(TRACK_VOLUME);
          })
          .catch(() => {
            /* no file, or the browser refused. Either way, say so instead of
               leaving a control that looks like it did something. */
            setMusic("missing");
          });
      } else if (track.current) {
        rampTo(0, () => track.current?.pause());
      }

      return next;
    });
  }, [rampTo]);

  useEffect(
    () => () => {
      if (fade.current) window.clearInterval(fade.current);
      track.current?.pause();
    },
    [],
  );

  const reset = useCallback(() => {
    claimed.current = new Set();
    setXp(0);
    setRecruited([]);
    setSeen(0);
    /*
     * Removing the key is belt-and-braces: the write effect fires on the state
     * change a moment later and puts an empty record back. That is fine — the
     * stored value is `{xp:0, recruited:[], keys:[]}` either way — but it does
     * mean the key survives a Clear, so nothing should claim otherwise.
     */
    try {
      localStorage.removeItem(STORAGE);
    } catch {
      /* the state is already cleared; storage catching up is a courtesy */
    }
  }, []);

  const level = Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1);
  const resolution = level as Resolution;

  useEffect(() => {
    document.documentElement.dataset.level = String(level);
  }, [level]);

  const value = useMemo<ProgressState>(
    () => ({
      xp,
      level,
      intoLevel: level >= MAX_LEVEL ? XP_PER_LEVEL : xp % XP_PER_LEVEL,
      perLevel: XP_PER_LEVEL,
      resolution,
      recruited,
      isRecruited: (id: string) => recruited.includes(id),
      sound,
      toggleSound,
      music,
      award,
      recruit,
      observe,
      seen,
      total: MAX_LEVEL,
      /* recomputed whenever xp moves, which is whenever a key is claimed */
      tally: (() => {
        const keys = [...claimed.current];
        const count = (prefix: string) => keys.filter((k) => k.startsWith(prefix)).length;
        return {
          plates: count("plate:"),
          recruits: count("recruit:"),
          inspects: count("inspect:"),
          surveys: count("survey:"),
        };
      })(),
      reset,
    }),
    [xp, level, resolution, recruited, sound, toggleSound, music, award, recruit, observe, seen, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Wraps a plate and reports it read once it is genuinely on screen. The plate
 * renders identically whether or not it has been observed.
 */
export function Observed({
  id,
  children,
  className,
  as: As = "section",
}: {
  id: string;
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "footer" | "header";
}) {
  const { observe } = useProgress();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      observe(id);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observe(id);
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [id, observe]);

  return (
    <As id={id} ref={ref as never} className={className}>
      {children}
    </As>
  );
}

/**
 * Formatting, and the one rule that governs it.
 *
 * Calibration raises the resolution of what is already on screen from 1× to
 * 8×. It never reveals a section, never unlocks a card, and never awards a
 * point. A visitor who scrolls past everything without touching a control sees
 * every claim on this page — just rounded harder.
 */

export type Resolution = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** A measured figure, printed to the precision the current resolution earns. */
export function figure(value: number, resolution: Resolution): string {
  if (resolution < 3) return String(Math.round(value));
  if (resolution < 6) return (Math.round(value * 10) / 10).toFixed(1);
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** UTC everywhere. A stamp that reads differently in two timezones is a bug. */
export function stamp(iso: string, resolution: Resolution = 8): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toISOString().slice(0, 10);
  if (resolution < 4) return date;
  return `${date} ${d.toISOString().slice(11, 16)}Z`;
}

/** Julian-style day marker used in the margin rails and plate corners. */
export function plateMark(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "————";
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start) / 86_400_000);
  return `${String(d.getUTCFullYear()).slice(2)}·${String(day).padStart(3, "0")}`;
}

/** Whole days between two instants, floored. Used for the 30-day tick window. */
export function daysBetween(a: string, b: string): number {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return Number.POSITIVE_INFINITY;
  return Math.floor(Math.abs(t2 - t1) / 86_400_000);
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * A record date, printed the way a person writes it.
 *
 * "2025-08" becomes "Aug 2025"; a bare "2024" stays "2024". No timezone maths
 * — these are calendar labels the author typed, not instants.
 */
export function monthYear(value: string): string {
  const match = value.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!match) return value;
  const [, year, month] = match;
  if (!month) return year!;
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : year!;
}

/** "Aug 2025 – May 2026", or just the start when there is no end. */
export function span(from: string, until?: string): string {
  return until ? `${monthYear(from)} – ${monthYear(until)}` : monthYear(from);
}

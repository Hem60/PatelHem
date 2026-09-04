/** Typings for the contrast gate, so the test suite can import it directly. */
export interface ContrastRow {
  theme: "night" | "day";
  fg: string;
  bg: string;
  fgv: string;
  bgv: string;
  floor: number;
  ratio: number;
  pass: boolean;
}
export function contrast(fgValue: string, bgValue: string): number;
export function audit(): ContrastRow[];

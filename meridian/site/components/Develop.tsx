"use client";

/**
 * The arrival — plate development.
 *
 * The page opens on bare sky. Over 1400ms the graticule draws in from the
 * top-left origin, the survey plate resolves up through eight discrete steps
 * rather than a smooth fade, the headline sets, and the readout counts to
 * figures a visitor can verify in the repository.
 *
 * The motion is the page reporting its own data arriving. Under reduced
 * motion the plate is simply present and the numbers are simply correct — the
 * attribute is never set, so no animation is armed at all.
 */
import { useEffect } from "react";

export function Develop() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.dataset.arrived = "true";
      return;
    }
    /* the attribute stays put once set: every development animation fills
       both ways, so removing it would snap the finished plate back. */
    root.dataset.develop = "running";
    const done = window.setTimeout(() => {
      root.dataset.arrived = "true";
    }, 1400);
    return () => window.clearTimeout(done);
  }, []);

  return null;
}

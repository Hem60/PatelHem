"use client";

/**
 * A measured figure. Renders at the resolution calibration has reached, and
 * carries the full-precision value in the DOM so a screen reader and a
 * copy-paste both get the real number regardless of what is drawn.
 */
import { useEffect, useRef, useState } from "react";
import { figure } from "@/lib/format";
import { useResolution } from "./Calibration";

export function Figure({
  value,
  suffix,
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const resolution = useResolution();
  return (
    <span className={className} data-exact={value}>
      {figure(value, resolution)}
      {suffix}
    </span>
  );
}

/**
 * The hero readout. Counts from zero to the real figure as the plate develops,
 * then stops on a value a visitor can verify in the repository. Under reduced
 * motion it is simply correct from the first frame.
 */
export function Counter({
  value,
  duration = 1100,
  delay = 500,
  decimals = 0,
  className,
}: {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  className?: string;
}) {
  return (
    <CounterImpl value={value} duration={duration} delay={delay} decimals={decimals} className={className} />
  );
}

function CounterImpl({
  value,
  duration,
  delay,
  decimals,
  className,
}: {
  value: number;
  duration: number;
  delay: number;
  decimals: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      return;
    }
    setShown(0);
    let start = 0;
    const timer = window.setTimeout(() => {
      const step = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / duration);
        /* the same easing the plate develops on, so they read as one event */
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(value * eased);
        if (p < 1) frame.current = requestAnimationFrame(step);
        else setShown(value);
      };
      frame.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, delay]);

  return (
    <span className={className} data-exact={value}>
      {shown.toFixed(decimals)}
    </span>
  );
}

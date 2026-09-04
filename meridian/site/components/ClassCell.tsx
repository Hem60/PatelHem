"use client";

/**
 * Layer 10 in motion — the class field shift.
 *
 * The eight-step dither ramp tilts with the pointer, so rank becomes something
 * physical rather than a coloured word. Transform only, 120ms, and it never
 * moves far: the point is that the ramp has steps, and you can only see steps
 * when the light across them changes.
 *
 * Under reduced motion nothing moves; the field is simply there.
 */
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { classVar } from "@/lib/bands";
import type { Classification } from "@/lib/catalogue";

const RANGE = 6; /* px — any further and it reads as a parallax gimmick */

export function ClassCell({
  classification,
  children,
  className = "",
  style,
  as: As = "div",
}: {
  classification: Classification;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const onMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setOffset({ x: -x * RANGE * 2, y: -y * RANGE * 2 });
  }, []);

  const onLeave = useCallback(() => setOffset(null), []);

  return (
    <As
      ref={ref as never}
      className={`relative ${className}`}
      data-class={classification}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        ...style,
        ["--class" as string]: classVar(classification),
        ["--field-x" as string]: `${offset?.x ?? 0}px`,
        ["--field-y" as string]: `${offset?.y ?? 0}px`,
      }}
    >
      <span className="class-field" aria-hidden="true" />
      {children}
    </As>
  );
}

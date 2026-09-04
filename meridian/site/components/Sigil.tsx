"use client";

/**
 * A 5×5 pixel sigil, drawn as a grid of cells rather than an image.
 *
 * No raster, no icon font: twenty-five spans, coloured by the instrument's
 * own token. It scales by changing one number and stays crisp at any density,
 * which is the whole reason the reference build draws them this way.
 */
import { sigilOf } from "@/lib/sigil";

export function Sigil({
  id,
  size = 3,
  on = true,
  title,
}: {
  id: string;
  /** Cell edge in pixels. 2 in the HUD, 3 on a card. */
  size?: number;
  /** An un-recruited instrument is drawn dim rather than hidden. */
  on?: boolean;
  title?: string;
}) {
  const sigil = sigilOf(id);
  return (
    <span
      aria-hidden="true"
      title={title}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(5, ${size}px)`,
        gap: "1px",
        lineHeight: 0,
        color: `var(${sigil.token})`,
        opacity: on ? 1 : 0.28,
        transition: "opacity var(--dur) var(--ease-out)",
      }}
    >
      {sigil.bits.split("").map((bit, i) => (
        <span
          key={i}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            background: bit === "1" ? "currentColor" : "transparent",
          }}
        />
      ))}
    </span>
  );
}

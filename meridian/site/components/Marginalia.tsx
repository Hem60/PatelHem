/**
 * Marginalia.
 *
 * Footnotes belong in the margin of a chart, not underneath it. A note is a
 * number in the prose and the same number in the gutter column beside it, so
 * the caveat sits level with the claim it qualifies rather than at the bottom
 * of the page where nobody reads it.
 *
 * The gutter collapses below 64rem and the notes stack under the block they
 * annotate — still present, still numbered, never hidden.
 */
import type { ReactNode } from "react";

export function Marker({ n }: { n: number }) {
  return (
    <span className="marker" aria-hidden="true">
      [{n}]
    </span>
  );
}

export function Notes({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <aside className={`gutter ${className}`} aria-label="Notes">
      {children}
    </aside>
  );
}

export function Note({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="note">
      <span className="note-index">[{n}]</span>
      <p className="note-body">{children}</p>
    </div>
  );
}

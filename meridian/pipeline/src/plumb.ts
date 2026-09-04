import type { Signals } from "@meridian/engine";
import type { Claim, VerifiedClaim } from "./catalogue.js";

/**
 * Plumb. Nothing Herald writes reaches a card until every citation resolves
 * against something real.
 *
 * Two kinds of citation:
 *   - a repository path, which must exist in the collected file tree
 *   - `signal:<name>`, which must be present and non-empty in Signals
 *
 * This is the check that keeps an automatically written card from claiming
 * something the repository does not contain. It is deterministic — a file
 * lookup, not a judgement.
 */

const SIGNAL_PREFIX = "signal:";

/** Signals that count as present. Absent or empty fails the citation. */
function signalPresent(s: Signals, name: string): boolean {
  switch (name) {
    case "commitCount": return s.commitCount > 0;
    case "languages": return Object.keys(s.languages).length > 0;
    case "homepageStatus": return s.homepageStatus === 200;
    case "license": return s.license !== null;
    case "releaseCount": return s.releaseCount > 0;
    case "topics": return s.topics.length > 0;
    default: return false;
  }
}

export function verifyClaim(s: Signals, claim: Claim): VerifiedClaim {
  if (claim.cites.length === 0) {
    return { ...claim, upheld: false, rejection: "no citation" };
  }
  const paths = new Set(s.paths);
  for (const cite of claim.cites) {
    if (cite.startsWith(SIGNAL_PREFIX)) {
      const name = cite.slice(SIGNAL_PREFIX.length);
      if (!signalPresent(s, name)) {
        return { ...claim, upheld: false, rejection: `signal ${name} absent` };
      }
      continue;
    }
    // A directory citation is satisfied by anything beneath it.
    const isDir = cite.endsWith("/");
    const ok = isDir
      ? s.paths.some(p => p.startsWith(cite))
      : paths.has(cite) || Object.hasOwn(s.manifests, cite);
    if (!ok) {
      return { ...claim, upheld: false, rejection: `no such path: ${cite}` };
    }
  }
  return { ...claim, upheld: true };
}

export interface VerificationReport {
  readonly upheld: readonly VerifiedClaim[];
  readonly rejected: readonly VerifiedClaim[];
}

export function verify(s: Signals, claims: readonly Claim[]): VerificationReport {
  const checked = claims.map(c => verifyClaim(s, c));
  return {
    upheld: checked.filter(c => c.upheld),
    rejected: checked.filter(c => !c.upheld),
  };
}

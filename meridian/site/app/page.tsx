/**
 * The page, in the order the plan lays it out.
 *
 * Plate order follows the reference build: hero, dossier, mission console,
 * vault, capability tree, career log, assay, signal. The terminal is plate 09
 * and is not built yet, which is why the numbering skips it.
 */
import { catalogue, revisions } from "@/lib/catalogue";
import { contributions } from "@/lib/contributions";
import { record, skills } from "@/lib/content";
import { FirstLight } from "@/components/FirstLight";
import { Parallax } from "@/components/Parallax";
import { HowToRead } from "@/components/HowToRead";
import { ObservingRun } from "@/components/ObservingRun";
import { Roster } from "@/components/Roster";
import { Catalogue } from "@/components/Catalogue";
import { CapabilityTree } from "@/components/CapabilityTree";
import { LogRevisions } from "@/components/LogRevisions";
import { Console } from "@/components/Console";
import { Hailing } from "@/components/Hailing";
import { ObservationLog } from "@/components/ObservationLog";
import { Colophon } from "@/components/Colophon";

export default function Page() {
  const cat = catalogue();
  const revs = revisions();
  const log = record();
  const skillList = skills();
  const contrib = contributions();

  return (
    <>
      <FirstLight cat={cat} revisions={revs} />
      <Parallax cat={cat} record={log} skills={skillList} />
      <Roster cat={cat} />
      <ObservingRun cat={cat} />
      <Catalogue cat={cat} contrib={contrib} />
      <CapabilityTree cat={cat} />
      <LogRevisions cat={cat} revisions={revs} record={log} />
      <HowToRead cat={cat} />
      <Console cat={cat} record={log} skills={skillList} />
      <Hailing cat={cat} skills={skillList} />
      {/* what this reader did, and what it was worth — last before the colophon */}
      <ObservationLog />
      <Colophon cat={cat} />
    </>
  );
}

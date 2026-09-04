/**
 * The observing run, streamed.
 *
 * Server-sent events rather than a single JSON reply, because the point of the
 * panel is watching real calls settle out of order. If this returned one blob
 * at the end, the ordering would be a story the client tells rather than
 * something the network did.
 *
 * Runs on the Node runtime: the transport writes a disk cache and reads a
 * token from the environment.
 */
import { catalogue } from "@/lib/catalogue";
import { observingRun } from "@/lib/run/instruments";
import { runContext } from "@/lib/run/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only repositories the catalogue already lists. An open box here is an open
 *  proxy to the GitHub API on somebody else's rate limit. */
function permitted(repo: string): boolean {
  return catalogue().entries.some((e) => e.name === repo);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const repo = url.searchParams.get("repo") ?? "";
  const cat = catalogue();

  if (!permitted(repo)) {
    return new Response(
      JSON.stringify({
        error: `"${repo}" is not in the catalogue. The run only surveys repositories this page already lists.`,
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of observingRun(cat.user, repo, runContext(cat).languageCounts)) {
          send(event);
          if (request.signal.aborted) break;
        }
      } catch (error) {
        send({
          t: "error",
          message: error instanceof Error ? error.message : "the run failed for an unstated reason",
        });
      } finally {
        controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      /* proxies love to buffer streams into a single flush */
      "x-accel-buffering": "no",
    },
  });
}

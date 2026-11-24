import type { Resume } from "./schema";

/**
 * A short-lived, in-memory hand-off between POST /api/pdf and the /print page
 * that headless Chrome renders.
 *
 * The route stores the document it was sent under a random token and points
 * Chrome at `/print?token=...`; the page reads it back on the server. Nothing
 * touches the disk, and a job lives only until the route deletes it or its
 * time to live runs out, whichever comes first.
 *
 * The map hangs off `globalThis` because the route handler and the page can
 * be compiled into separate module graphs: a plain module-level Map would then
 * exist twice, and the page would never see what the route stored.
 */

/**
 * The route stores a job only once Chrome is up (see `renderPdf`), so this has
 * to outlast loading the page, which is capped at `PDF_STEP_TIMEOUT_MS`
 * (30s), and not a launch on top of it. Twice that leaves room to spare and
 * still nothing behind for long.
 */
export const PRINT_JOB_TTL_MS = 60_000;

type PrintJob = { resume: Resume; expiresAt: number };

const STORE_KEY = Symbol.for("resume-builder.print-store");

function store(): Map<string, PrintJob> {
  const holder = globalThis as typeof globalThis & {
    [STORE_KEY]?: Map<string, PrintJob>;
  };
  holder[STORE_KEY] ??= new Map();
  return holder[STORE_KEY];
}

/** Stores a copy of the document and returns the token that reads it back. */
export function putPrintJob(resume: Resume, now = Date.now()): string {
  const jobs = store();
  for (const [token, job] of jobs) {
    if (job.expiresAt <= now) jobs.delete(token);
  }

  const token = globalThis.crypto.randomUUID();
  jobs.set(token, {
    resume: structuredClone(resume),
    expiresAt: now + PRINT_JOB_TTL_MS,
  });
  return token;
}

/**
 * The document stored under `token`, or `null`. Not consumed by reading: the
 * route owns the job and deletes it once the PDF is done, so a page that
 * happens to render twice still finds it.
 */
export function getPrintJob(token: unknown, now = Date.now()): Resume | null {
  if (typeof token !== "string") return null;

  const jobs = store();
  const job = jobs.get(token);
  if (!job) return null;
  if (job.expiresAt <= now) {
    jobs.delete(token);
    return null;
  }
  return job.resume;
}

export function deletePrintJob(token: string): void {
  store().delete(token);
}

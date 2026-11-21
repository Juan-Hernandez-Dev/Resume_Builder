import { formatIssues, messageOf } from "./api-response";
import { resumeSchema, type Resume } from "./schema";

/**
 * Validating a file the user picked with "Import JSON".
 *
 * The size is checked before a single byte is read: `file.text()` followed by
 * `JSON.parse` on a file the user picked by accident (a database dump, a video
 * renamed to .json) would read the whole thing into memory and then build a
 * second copy of it as a JavaScript value, which is how a file picker turns
 * into a frozen tab.
 */

/**
 * The largest file accepted as a resume. A full resume with long bullets is a
 * few tens of kilobytes; this leaves three orders of magnitude of headroom and
 * still rules out anything that was clearly not a resume.
 */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type ImportResult =
  | { ok: true; resume: Resume }
  | { ok: false; error: string };

/** Reads and validates a picked file, naming it in every failure message. */
export async function readResumeFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    const limit = Math.round(MAX_IMPORT_BYTES / 1024);
    return {
      ok: false,
      error: `${file.name} is too large to be a resume (${Math.round(file.size / 1024)} KB, limit ${limit} KB).`,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch (cause) {
    return {
      ok: false,
      error: `${file.name} is not readable JSON: ${messageOf(cause)}`,
    };
  }

  const parsed = resumeSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `${file.name} is not a valid resume. ${formatIssues(parsed.error.issues)}`,
    };
  }

  return { ok: true, resume: parsed.data };
}

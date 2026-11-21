import { resumeSchema, type Resume } from "./schema";

/**
 * Reading the /api/variants responses: validating a payload and turning a
 * failure into one readable line.
 *
 * These live here rather than beside the editor hook so they can be unit
 * tested next to the rest of the pure logic, and so both the editor and the
 * recovery screen format a failure the same way.
 */

/** At most this many zod issues are spelled out before the rest are counted. */
export const MAX_ISSUES = 5;

/**
 * Validates the `resume` of an API payload, so no cast is needed. `null` means
 * the response was not a resume: a body that is not JSON, not an object, or a
 * document the schema rejects.
 */
export async function readResume(response: Response): Promise<Resume | null> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const parsed = resumeSchema.safeParse(
    (payload as { resume?: unknown }).resume,
  );
  return parsed.success ? parsed.data : null;
}

/**
 * Turns an API failure into one readable line. Zod issues from a 400 or 422 are
 * spelled out rather than swallowed, because they name the field at fault.
 */
export async function describeFailure(
  response: Response,
  fallback: string,
): Promise<string> {
  const status = `HTTP ${response.status}`;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return `${fallback} (${status})`;
  }

  if (typeof payload !== "object" || payload === null) {
    return `${fallback} (${status})`;
  }

  const { error, issues } = payload as { error?: unknown; issues?: unknown };
  const head = typeof error === "string" ? error : `${fallback} (${status})`;
  if (!Array.isArray(issues) || issues.length === 0) return head;
  return `${head} ${formatIssues(issues)}`;
}

/** "header.name: Expected string; sections.0.title: ... (+2 more)" */
export function formatIssues(issues: readonly unknown[]): string {
  const shown = issues.slice(0, MAX_ISSUES).map(formatIssue).join("; ");
  const hidden = issues.length - MAX_ISSUES;
  return hidden > 0 ? `${shown} (+${hidden} more)` : shown;
}

function formatIssue(issue: unknown): string {
  if (typeof issue !== "object" || issue === null) return String(issue);

  const { path, message } = issue as { path?: unknown; message?: unknown };
  const where = Array.isArray(path)
    ? path.map(String).join(".")
    : typeof path === "string"
      ? path
      : "";
  const what = typeof message === "string" ? message : "invalid value";
  return where ? `${where}: ${what}` : what;
}

export function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

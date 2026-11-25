import { InvalidVariantNameError } from "../variant-name";

/**
 * The failures every resume repository reports, whichever storage is behind
 * it: files under data/ in local mode, IndexedDB in the web build, or the
 * /api/variants routes as seen from the browser.
 *
 * Each message is one line fit for the user, which is why every class takes an
 * optional message: the HTTP adapter passes on the server's own wording, which
 * names the field at fault, instead of rebuilding a vaguer one here.
 */

export class VariantNotFoundError extends Error {
  constructor(
    readonly variant: string,
    message = `Variant "${variant}" does not exist.`,
  ) {
    super(message);
    this.name = "VariantNotFoundError";
  }
}

export class VariantExistsError extends Error {
  constructor(
    readonly variant: string,
    message = `Variant "${variant}" already exists.`,
  ) {
    super(message);
    this.name = "VariantExistsError";
  }
}

export class InvalidVariantDataError extends Error {
  constructor(
    readonly variant: string,
    readonly issues: readonly { path: string; message: string }[],
    message = `Variant "${variant}" does not match the resume schema.`,
  ) {
    super(message);
    this.name = "InvalidVariantDataError";
  }
}

/**
 * Why the storage itself failed, as opposed to a variant being missing or
 * malformed: full (`quota`), not there at all (`unavailable`, such as
 * IndexedDB in a locked-down private window), or anything else (`io`).
 */
export type StorageFailureReason = "quota" | "unavailable" | "io";

export class StorageError extends Error {
  readonly reason: StorageFailureReason;
  /** Whether trying the same operation again later could succeed. */
  readonly retryable: boolean;

  constructor(
    message: string,
    {
      reason,
      retryable,
      cause,
    }: { reason: StorageFailureReason; retryable: boolean; cause?: unknown },
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "StorageError";
    this.reason = reason;
    this.retryable = retryable;
  }
}

/**
 * Whether the error is one a repository reports on purpose, whose message can
 * be shown as it is. Anything else (a request that never reached the server, a
 * bug) still needs saying what was being attempted.
 */
export function isRepositoryError(error: unknown): error is Error {
  return (
    error instanceof VariantNotFoundError ||
    error instanceof VariantExistsError ||
    error instanceof InvalidVariantDataError ||
    error instanceof InvalidVariantNameError ||
    error instanceof StorageError
  );
}

/** zod issues as `{ path: "a.b", message }`, the shape the errors carry. */
export function flattenIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): { path: string; message: string }[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

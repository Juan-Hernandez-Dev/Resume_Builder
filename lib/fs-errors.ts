/**
 * Turns the filesystem errors that can realistically happen on a local machine
 * into messages the user can act on.
 *
 * Without this every one of them reaches the editor as `(HTTP 500)`, which
 * makes a full disk, a file an antivirus has locked and an actual bug in the
 * app look identical. The messages are built from the error *code* only: the
 * `message` Node throws embeds the absolute path of the file, and the response
 * body is not the place for the host's directory layout.
 *
 * ENOENT is deliberately absent. A missing file is a normal outcome here and
 * the variant layer already reports it as VariantNotFoundError / a 404.
 */

/** What the user can do about each code, one sentence, no paths. */
const FS_REASONS = {
  EACCES:
    "The file or the data directory denies access. Check its permissions and that nothing is running as another user.",
  // Windows reports EPERM for several unrelated causes, so this one says what
  // to check rather than asserting a single reason.
  EPERM:
    "The operating system refused the operation. The usual cause is another program holding the file, so close anything that has it open and try again.",
  EBUSY:
    "The file is locked by another program, such as an editor or a virus scanner. Try again in a moment.",
  ENOSPC:
    "The disk is full, so nothing was written. Free some space and try again.",
  EROFS: "The data directory is on a read-only filesystem, so nothing was written.",
  EMFILE:
    "This process has too many files open. Try again in a moment, and restart the dev server if it keeps happening.",
  ENFILE:
    "The system has too many files open. Try again in a moment.",
  EISDIR:
    "A directory is sitting where a variant file should be. Rename or remove it.",
  ENOTDIR:
    "Part of the path to the data directory is a file, not a directory. Remove or rename it.",
  EAGAIN: "The filesystem was temporarily unavailable. Try again in a moment.",
} as const satisfies Record<string, string>;

type FsErrorCode = keyof typeof FS_REASONS;

/**
 * Codes a later attempt can plausibly get past, which is what makes the
 * difference between "retry" and "fix something first" for the caller.
 */
const TRANSIENT_CODES = new Set<FsErrorCode>([
  "EPERM",
  "EBUSY",
  "EMFILE",
  "ENFILE",
  "EAGAIN",
]);

function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
}

function knownCode(error: unknown): FsErrorCode | null {
  const code = codeOf(error);
  return code !== null && code in FS_REASONS ? (code as FsErrorCode) : null;
}

/** Whether this is a filesystem failure {@link describeFsError} can explain. */
export function isFsError(error: unknown): boolean {
  return knownCode(error) !== null;
}

/**
 * `"<what failed>: <why, and what to do> (<CODE>)"`, or `null` when the error
 * is not a filesystem failure this module knows — in which case the caller
 * must rethrow, so a real bug still surfaces as a real bug.
 */
export function describeFsError(
  error: unknown,
  description: string,
): string | null {
  const code = knownCode(error);
  if (code === null) return null;
  return `${description}: ${FS_REASONS[code]} (${code})`;
}

/** 503 when trying again could work, 500 when something must be fixed first. */
export function fsErrorStatus(error: unknown): number {
  const code = knownCode(error);
  return code !== null && TRANSIENT_CODES.has(code) ? 503 : 500;
}

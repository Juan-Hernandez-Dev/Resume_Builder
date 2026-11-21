import { promises as fs } from "node:fs";

/**
 * Crash-safe file writes for the resume JSON files.
 *
 * The resume content is the only irreplaceable thing in this app and there is
 * no undo, so a write must never be able to leave a half-written or empty file
 * behind. `fs.writeFile` cannot promise that: its default `w` flag truncates
 * the file the moment it is opened, so a disk-full error, a killed dev server
 * or a Windows sharing violation mid-write destroys the previous content.
 *
 * Instead every write goes: temp file in the same directory -> fsync -> copy
 * the current file to a rolling `.bak` -> rename the temp over the target.
 * `rename` within one directory is a single filesystem operation, so a reader
 * sees either all of the old file or all of the new one, and a failure at any
 * step leaves the target exactly as it was.
 *
 * Verified on this platform (and asserted by the tests): `fs.promises.rename`
 * replaces an existing file on Windows when both paths are on the same volume,
 * which is why the temp file is a sibling of the target rather than in the OS
 * temp directory.
 *
 * This module deliberately does not import `server-only`: it is pure
 * filesystem plumbing with no Next.js coupling, imported only by
 * lib/variants.ts, and it is unit tested against real temp directories.
 */

/** Suffix of the rolling copy of the last good content. */
export const BACKUP_SUFFIX = ".bak";

/** Suffix of the in-progress write. Never a valid variant file name. */
const TEMP_SUFFIX = ".tmp";

/**
 * A rename onto a file another process has open fails on Windows with EPERM
 * (an antivirus scan or an editor holding the handle), and that clears on its
 * own within milliseconds. These are the codes worth one more try.
 */
const RETRYABLE_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

/** Backoff between rename attempts, in milliseconds. One entry per retry. */
const RETRY_DELAYS_MS = [20, 60, 180];

/** Makes every temp name in this process unique, so writes never collide. */
let tempCounter = 0;

/** Where {@link writeFileAtomic} keeps the previous content of `file`. */
export function backupPathFor(file: string): string {
  return `${file}${BACKUP_SUFFIX}`;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Writes `contents` and flushes it to the disk before returning. */
async function writeSynced(file: string, contents: string): Promise<void> {
  const handle = await fs.open(file, "w");
  try {
    await handle.writeFile(contents, "utf8");
    // Without this the rename can land before the bytes do, so a power loss
    // leaves a renamed but empty file: the exact outcome this module prevents.
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Renames `from` over `to`, retrying the transient Windows lock errors. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const retryable =
        RETRYABLE_CODES.has(errorCode(error) ?? "") &&
        attempt < RETRY_DELAYS_MS.length;
      if (!retryable) throw error;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/**
 * Copies the current content aside so a bad write can still be recovered by
 * hand. A missing target is the first write and has nothing to back up; any
 * other failure is reported, because silently skipping the backup would make
 * the next write the one with no safety net.
 */
async function keepBackup(file: string): Promise<void> {
  try {
    await fs.copyFile(file, backupPathFor(file));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw error;
  }
}

/**
 * Replaces `file` with `contents` without ever leaving it truncated.
 *
 * The parent directory must already exist. On failure the target keeps its
 * previous content, the temp file is removed, and the error is rethrown so the
 * caller can tell the user that nothing was saved.
 */
export async function writeFileAtomic(
  file: string,
  contents: string,
): Promise<void> {
  tempCounter += 1;
  const temp = `${file}.${process.pid.toString(36)}-${tempCounter.toString(36)}${TEMP_SUFFIX}`;

  try {
    await writeSynced(temp, contents);
    await keepBackup(file);
    await renameWithRetry(temp, file);
  } catch (error) {
    // Best effort: the write already failed, and a missing temp file is fine.
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Creates `file` with `contents` only if it does not exist yet, and reports
 * whether it did. The `wx` flag makes the check and the create one operation,
 * so two callers racing can never overwrite each other's file.
 *
 * No temp file and no backup: there is no previous content to protect. A
 * failure part way through removes the partial file instead of leaving invalid
 * JSON where a variant should be.
 */
export async function createFileExclusive(
  file: string,
  contents: string,
): Promise<boolean> {
  let handle;
  try {
    handle = await fs.open(file, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  }

  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await fs.rm(file, { force: true }).catch(() => undefined);
    throw error;
  }

  await handle.close();
  return true;
}

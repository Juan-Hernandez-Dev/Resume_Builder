import "server-only";

import { describeFsError, fsErrorStatus } from "../fs-errors";
import { resumeSchema, type Resume } from "../schema";
import {
  createVariant,
  duplicateVariant,
  listVariants,
  readVariant,
  variantExists,
  writeVariant,
} from "../variants";

import {
  InvalidVariantDataError,
  StorageError,
  VariantNotFoundError,
  flattenIssues,
  isRepositoryError,
} from "./errors";
import type { ResumeRepository } from "./port";

/**
 * The files under data/ as a repository: lib/variants.ts behind the port, for
 * the local page, which opens the editor on the server.
 *
 * lib/variants.ts throws the raw Node error for a filesystem failure; here it
 * becomes a StorageError worded by lib/fs-errors.ts, the same line the API
 * routes answer with, so the recovery screen can show it as it is. A failure
 * fs-errors does not know still gets a sentence naming what failed.
 */
export const fsRepository: ResumeRepository = {
  list: () => guard(listVariants, "The data directory could not be read"),

  read: (name) => guard(() => readVariant(name), `"${name}" could not be read`),

  write: (name, resume) =>
    guard(async () => {
      const parsed = validated(name, resume);
      // `writeVariant` creates the file if needed; the port never does.
      if (!(await variantExists(name))) throw new VariantNotFoundError(name);
      return writeVariant(name, parsed);
    }, `Could not save "${name}"`),

  create: (name, resume) =>
    guard(
      async () => createVariant(name, validated(name, resume)),
      `Could not create "${name}"`,
    ),

  duplicate: (from, to) =>
    guard(() => duplicateVariant(from, to), `Could not create "${to}"`),
};

async function guard<T>(run: () => Promise<T>, description: string): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isRepositoryError(error)) throw error;
    throw new StorageError(
      describeFsError(error, description) ?? `${description}.`,
      { reason: "io", retryable: fsErrorStatus(error) === 503, cause: error },
    );
  }
}

function validated(name: string, resume: Resume): Resume {
  const result = resumeSchema.safeParse(resume);
  if (!result.success) {
    throw new InvalidVariantDataError(name, flattenIssues(result.error.issues));
  }
  return result.data;
}

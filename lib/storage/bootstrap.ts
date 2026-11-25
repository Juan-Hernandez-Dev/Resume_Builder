import { emptyResume, type Resume } from "../schema";

import { InvalidVariantDataError, VariantExistsError, isRepositoryError } from "./errors";
import type { ResumeRepository } from "./port";

/**
 * What the app opens on, whatever the storage: the local page runs these on
 * the server against the files, the web build in the browser against
 * IndexedDB.
 */

export const DEFAULT_VARIANT = "default";

/**
 * Guarantees there is a variant to save into, and returns the variant list.
 *
 * On a first run the storage holds nothing: without this the editor would open
 * on a blank document whose every save failed, because `write` deliberately
 * refuses to create variants. Seeding one empty variant is the whole
 * bootstrap. An existing variant is never touched, and the seed is an
 * exclusive create, so one that appears in between is kept as it is.
 */
export async function ensureFirstVariant(
  repository: ResumeRepository,
  name: string,
): Promise<string[]> {
  const existing = await repository.list();
  if (existing.length > 0) return existing;

  try {
    await repository.create(name, emptyResume());
  } catch (error) {
    // Someone else got there first: that variant is the first one.
    if (!(error instanceof VariantExistsError)) throw error;
  }
  return [name];
}

export type InitialView =
  | { kind: "editor"; variant: string; resume: Resume; variants: string[] }
  | {
      kind: "recovery";
      variant: string;
      variants: string[];
      reason: string;
      issues: readonly { path: string; message: string }[];
    };

/**
 * The variant list and the starting document, or the recovery screen.
 *
 * Two things can go wrong before the editor can even open, and neither may
 * leave the app unusable: the storage cannot be listed at all, or the variant
 * exists but cannot be read (a document the schema rejects, a refused read).
 * The recovery screen keeps the variant picker and Import reachable, which is
 * where the user fixes it.
 *
 * `requested` is the `?variant=` of the address, so the recovery screen can
 * still get to another variant when the current one is the broken one.
 */
export async function openInitial(
  repository: ResumeRepository,
  requested: string | string[] | null | undefined,
): Promise<InitialView> {
  let variants: string[];
  try {
    variants = await ensureFirstVariant(repository, DEFAULT_VARIANT);
  } catch (error) {
    // The storage itself is unreachable, so there is no list to show.
    return {
      kind: "recovery",
      variant: DEFAULT_VARIANT,
      variants: [],
      reason: isRepositoryError(error)
        ? error.message
        : "The saved variants could not be read.",
      issues: [],
    };
  }

  const variant = pickVariant(variants, requested);
  try {
    const resume = await repository.read(variant);
    return { kind: "editor", variant, resume, variants };
  } catch (error) {
    return {
      kind: "recovery",
      variant,
      variants,
      reason: isRepositoryError(error)
        ? error.message
        : `"${variant}" could not be read.`,
      issues: error instanceof InvalidVariantDataError ? error.issues : [],
    };
  }
}

/** The requested variant if it exists, else "default", else the first one. */
function pickVariant(
  variants: string[],
  requested: string | string[] | null | undefined,
): string {
  if (typeof requested === "string" && variants.includes(requested)) {
    return requested;
  }
  return variants.includes(DEFAULT_VARIANT)
    ? DEFAULT_VARIANT
    : (variants[0] ?? DEFAULT_VARIANT);
}

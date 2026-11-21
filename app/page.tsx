import { EditorShell } from "@/components/editor/EditorShell";
import { VariantRecovery } from "@/components/editor/VariantRecovery";
import { describeFsError } from "@/lib/fs-errors";
import type { Resume } from "@/lib/schema";
import {
  InvalidVariantDataError,
  VariantNotFoundError,
  ensureFirstVariant,
  readVariant,
} from "@/lib/variants";

/** The JSON files are read on every request, so edits show up on reload. */
export const dynamic = "force-dynamic";

const DEFAULT_VARIANT = "default";

/**
 * Reads the variant list and the starting document on the server, then hands
 * both to the client editor. This is the only place lib/variants.ts is touched
 * outside the API routes.
 *
 * Two things can go wrong before the editor can even open, and neither may be
 * allowed to leave the app unusable:
 *
 * - There is no variant file at all (a fresh clone). `ensureFirstVariant`
 *   seeds one, because `PUT` refuses to create files and every save would
 *   otherwise fail with a 404 forever.
 * - The variant exists but cannot be read: malformed JSON, a document the
 *   schema rejects, or a file the operating system refused. Rendering the
 *   recovery screen keeps the variant picker and Import reachable, which is
 *   where the user fixes it.
 *
 * `?variant=<name>` picks which variant to open. The editor's own dropdown
 * switches variants over the API without reloading; this exists so the
 * recovery screen can still get to another variant when the current one is
 * the broken file.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { variant: requested } = await searchParams;

  let variants: string[];
  try {
    variants = await ensureFirstVariant(DEFAULT_VARIANT);
  } catch (error) {
    // The data directory itself is unreachable, so there is no list to show.
    return (
      <VariantRecovery
        variant={DEFAULT_VARIANT}
        variants={[]}
        reason={
          describeFsError(error, "The data directory could not be read") ??
          "The data directory could not be read."
        }
        issues={[]}
      />
    );
  }

  const variant = pickVariant(variants, requested);

  let resume: Resume;
  try {
    resume = await readVariant(variant);
  } catch (error) {
    return (
      <VariantRecovery
        variant={variant}
        variants={variants}
        reason={reasonFor(error, variant)}
        issues={error instanceof InvalidVariantDataError ? error.issues : []}
      />
    );
  }

  return (
    <EditorShell
      initialVariant={variant}
      initialResume={resume}
      variants={variants}
    />
  );
}

/** The requested variant if it exists, else "default", else the first one. */
function pickVariant(
  variants: string[],
  requested: string | string[] | undefined,
): string {
  if (typeof requested === "string" && variants.includes(requested)) {
    return requested;
  }
  return variants.includes(DEFAULT_VARIANT)
    ? DEFAULT_VARIANT
    : (variants[0] ?? DEFAULT_VARIANT);
}

function reasonFor(error: unknown, variant: string): string {
  if (
    error instanceof InvalidVariantDataError ||
    error instanceof VariantNotFoundError
  ) {
    return error.message;
  }
  return (
    describeFsError(error, `"${variant}" could not be read`) ??
    `"${variant}" could not be read.`
  );
}

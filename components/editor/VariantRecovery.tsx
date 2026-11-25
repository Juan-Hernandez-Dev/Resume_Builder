"use client";

import { useState } from "react";

import { usePlatform } from "@/components/platform/PlatformProvider";
import { messageOf } from "@/lib/api-response";
import { readResumeFile } from "@/lib/import-file";
import { isRepositoryError } from "@/lib/storage/errors";

import { VariantRecoveryView } from "./VariantRecoveryView";

/**
 * Shown instead of the editor when the variant the page tried to open cannot
 * be read: a document that no longer matches the schema, malformed JSON, or
 * storage that refused the read.
 *
 * The point is that one bad variant never makes the app unloadable. Everything
 * needed to get out of the state is here: which variant is at fault, exactly
 * what is wrong with it, a way to open any other variant, and a way to
 * overwrite the broken one with a known-good export. The broken variant itself
 * is left untouched until the user explicitly replaces it.
 *
 * This is the container: it replaces the variant through the platform's
 * repository and reloads. VariantRecoveryView draws the screen.
 */
export function VariantRecovery({
  variant,
  variants,
  reason,
  issues,
  reload = () => window.location.reload(),
}: {
  variant: string;
  variants: string[];
  reason: string;
  issues: readonly { path: string; message: string }[];
  /** Starts the page over once the variant is replaced. */
  reload?: () => void;
}) {
  const { repository, storage } = usePlatform();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function replaceWith(file: File) {
    setStatus(null);

    const imported = await readResumeFile(file);
    if (!imported.ok) {
      setStatus(imported.error);
      return;
    }

    if (
      !window.confirm(
        `Replace the contents of ${storage.describe(variant)} with ${file.name}? The current ${
          storage.kind === "filesystem" ? "file" : "contents"
        } cannot be recovered from the app afterwards.`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await repository.write(variant, imported.resume);
      reload();
    } catch (cause) {
      setStatus(
        isRepositoryError(cause)
          ? cause.message
          : `Could not write "${variant}": ${messageOf(cause)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <VariantRecoveryView
      variant={variant}
      variants={variants}
      reason={reason}
      issues={issues}
      storage={storage}
      busy={busy}
      status={status}
      onReplace={(file) => void replaceWith(file)}
      onReload={reload}
    />
  );
}

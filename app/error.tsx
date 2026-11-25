"use client";

import { useEffect } from "react";

import { Button } from "@/components/editor/ui/Button";

/**
 * Last resort for anything the page did not already handle.
 *
 * The page (`app/page.local.tsx`, or WebEditorRoot in the web build) catches
 * the failures that are expected of stored data (a corrupt variant, storage
 * that cannot be read) and renders the recovery screen instead. This boundary exists so that a failure nobody
 * predicted still leaves a page the user can read and retry from, rather than
 * the framework's error screen with no way back into the app.
 *
 * Nothing here touches the resume files, so retrying is always safe.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // The terminal running `next dev` is the only log this app has.
    console.error(error);
  }, [error]);

  // A value thrown in a Client Component arrives as-is and need not be an Error.
  const detail = error instanceof Error ? error.message : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8 text-sm">
      <h1 className="text-lg font-semibold text-neutral-900">
        Something went wrong
      </h1>
      <p className="text-neutral-700">
        The editor could not be rendered. Your resume files were not changed.
      </p>
      {detail === null ? null : (
        <p className="font-mono text-xs break-words text-red-900">{detail}</p>
      )}
      <p className="text-neutral-500">
        Retrying re-reads the files from disk. If it keeps failing, the terminal
        running <code>npm run dev</code> has the full error, and the files in{" "}
        <code>data/</code> can be opened in any editor.
      </p>
      <div className="flex gap-2">
        <Button primary onClick={() => retry()}>
          Try again
        </Button>
        {/* A full reload, not a client navigation: the point is to re-run the
            server component and read the files from disk again. */}
        <Button onClick={() => window.location.reload()}>
          Reload the editor
        </Button>
      </div>
    </main>
  );
}

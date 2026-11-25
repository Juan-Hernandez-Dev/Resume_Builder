"use client";

import { useEffect, useMemo, useState } from "react";

import { EditorShell } from "@/components/editor/EditorShell";
import { VariantRecovery } from "@/components/editor/VariantRecovery";
import { Button } from "@/components/editor/ui/Button";
import {
  PlatformProvider,
  browserStorage,
  type Platform,
} from "@/components/platform/PlatformProvider";
import { openInitial, selectRepository, type InitialView } from "@/lib/storage/bootstrap";
import { createBrowserRepository } from "@/lib/storage/browser-repository";
import { createMemoryRepository } from "@/lib/storage/memory-repository";
import type { ResumeRepository } from "@/lib/storage/port";

/**
 * The whole app of the web build: the same editor as the local app, on this
 * browser's IndexedDB instead of files, with Export PDF going through the
 * print dialog.
 *
 * The page is a static file, so nothing about the visitor is known when it is
 * built. The server render and the first client render are both the same
 * "Loading…" screen, which keeps hydration exact; the storage is opened only
 * afterwards, in an effect, where the browser's APIs exist. The start-up
 * itself is the use case the local page runs on the server
 * (lib/storage/bootstrap.ts): seed `default` on a first visit, open the
 * variant `?variant=` names, or show the recovery screen.
 *
 * A browser with no usable IndexedDB (some private windows) still gets a
 * working editor on a memory store, with a warning that nothing outlives the
 * tab, rather than an app that cannot open at all. That holds for any failure
 * while starting, including a browser where merely reading `indexedDB` throws
 * (blocked site data); if even the memory store cannot start, the page says
 * so instead of loading forever.
 */
export function WebEditorRoot({
  createRepository = () => createBrowserRepository(),
  createFallback = () => createMemoryRepository(),
}: {
  /** The storage to open; tests pass a fresh database or a memory store. */
  createRepository?: () => ResumeRepository;
  /** The storage used when that one cannot be opened. */
  createFallback?: () => ResumeRepository;
}) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "failed" }
    | {
        phase: "ready";
        repository: ResumeRepository;
        degraded: boolean;
        view: InitialView;
      }
  >({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    const requested = new URLSearchParams(window.location.search).get(
      "variant",
    );

    async function start() {
      try {
        const { repository, degraded } = await selectRepository(
          createRepository(),
          createFallback,
        );
        return {
          repository,
          degraded,
          view: await openInitial(repository, requested),
        };
      } catch {
        // Whatever went wrong, a tab-long memory store beats no editor.
        const repository = createFallback();
        return {
          repository,
          degraded: true,
          view: await openInitial(repository, requested),
        };
      }
    }

    start().then(
      (ready) => {
        if (!cancelled) setState({ phase: "ready", ...ready });
      },
      () => {
        if (!cancelled) setState({ phase: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
    // Runs once: the page is opened on one storage for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repository = state.phase === "ready" ? state.repository : null;
  const platform = useMemo<Platform | null>(
    () =>
      repository === null
        ? null
        : { repository, pdf: "print", storage: browserStorage },
    [repository],
  );

  if (state.phase === "failed") {
    return (
      <main
        role="alert"
        className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-red-700"
      >
        The editor could not start in this browser. Reload the page to try
        again.
      </main>
    );
  }

  if (state.phase === "loading" || platform === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </main>
    );
  }

  const { view, degraded } = state;
  return (
    <PlatformProvider value={platform}>
      {view.kind === "editor" ? (
        <EditorShell
          initialVariant={view.variant}
          initialResume={view.resume}
          variants={view.variants}
          notice={<StorageNotice degraded={degraded} />}
        />
      ) : (
        <VariantRecovery
          variant={view.variant}
          variants={view.variants}
          reason={view.reason}
          issues={view.issues}
        />
      )}
    </PlatformProvider>
  );
}

/**
 * Where the resumes are, said once under the toolbar. A visitor who clears
 * their browser data loses them, and Export JSON is the backup. Dismissing it
 * lasts for the visit; the degraded warning cannot be dismissed, because it is
 * true for as long as the tab is open.
 */
function StorageNotice({ degraded }: { degraded: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (degraded) {
    return (
      <div
        role="status"
        className="no-print flex shrink-0 items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-900"
      >
        This browser&apos;s storage is not available (a private window or blocked
        site data can cause this), so nothing is saved when this tab closes.
        Export JSON to keep your work.
      </div>
    );
  }

  if (dismissed) return null;
  return (
    <div
      role="status"
      className="no-print flex shrink-0 items-center gap-3 border-b border-neutral-300 bg-neutral-50 px-4 py-1.5 text-xs text-neutral-700"
    >
      <span className="min-w-0 flex-1">
        Your resumes are saved only in this browser. Export JSON to keep a
        backup.
      </span>
      <Button onClick={() => setDismissed(true)}>Dismiss</Button>
    </div>
  );
}

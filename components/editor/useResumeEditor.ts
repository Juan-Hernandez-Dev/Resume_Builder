"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePlatform } from "@/components/platform/PlatformProvider";
import { messageOf } from "@/lib/api-response";
import { EXAMPLE_VARIANT, loadExampleResume } from "@/lib/example-resume";
import { readResumeFile } from "@/lib/import-file";
import * as ops from "@/lib/resume-ops";
import {
  type Resume,
  type ResumeLink,
  type ResumeSettings,
  type SectionType,
} from "@/lib/schema";
import { createOrOpen } from "@/lib/storage/bootstrap";
import { isRepositoryError } from "@/lib/storage/errors";

/**
 * The editor's whole state layer: the document, which variant it came from,
 * and everything needed to persist it.
 *
 * Persistence goes through the platform's repository (see
 * components/platform/PlatformProvider.tsx): the /api/variants routes in local
 * mode, IndexedDB in the web build. This file never imports lib/variants.ts —
 * that module is server-only. Everything pure that
 * used to live down here (reading a payload, formatting a failure, validating
 * a picked file) is in lib/api-response.ts and lib/import-file.ts, where it is
 * unit tested; this file is the stateful part, tested through the hook.
 */

/** How long the document must sit still before autosave fires. */
export const AUTOSAVE_DELAY_MS = 800;

/**
 * Backoff for retrying a failed save, one entry per retry. A Windows file lock
 * from an antivirus scan or an open editor clears on its own in seconds, and
 * the user should not have to type again to get their edits written.
 */
export const SAVE_RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

export type ResumeEditor = ReturnType<typeof useResumeEditor>;

export function useResumeEditor({
  initialVariant,
  initialResume,
  initialVariants,
}: {
  initialVariant: string;
  initialResume: Resume;
  initialVariants: string[];
}) {
  const { repository } = usePlatform();
  const [resume, setResume] = useState(initialResume);
  const [variant, setVariant] = useState(initialVariant);
  const [variants, setVariants] = useState(initialVariants);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by a failed save to schedule the next retry. 0 means "settled". */
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Mirrors of the state that the async save path reads, so a save always
  // sends the newest document instead of whatever its closure captured.
  const resumeRef = useRef(resume);
  const variantRef = useRef(variant);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  /** A save was requested while one was already in flight. */
  const pendingRef = useRef(false);
  /** The save in flight, so a second caller can await the same one. */
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  /**
   * The variant the user last asked for, which is not yet `variantRef` while a
   * load is in flight. Selecting the same variant twice in a row is a no-op
   * against this, not against the variant currently on screen.
   */
  const requestedRef = useRef(variant);
  /** Identifies the newest load, so an earlier response is ignored. */
  const loadRef = useRef(0);

  /** Single writer for the document, so the refs can never drift. */
  const commit = useCallback((next: Resume, isDirty: boolean) => {
    resumeRef.current = next;
    dirtyRef.current = isDirty;
    setResume(next);
    setDirty(isDirty);
  }, []);

  /** Runs one resume-ops helper. A no-op op leaves the document untouched. */
  const apply = useCallback(
    (op: (current: Resume) => Resume) => {
      const next = op(resumeRef.current);
      if (next === resumeRef.current) return;
      commit(next, true);
    },
    [commit],
  );

  const reportError = useCallback((message: string) => setError(message), []);
  const dismissError = useCallback(() => setError(null), []);

  /* ---------------------------------------------------------------------- */
  /* Saving                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Asks for one more save attempt. Stopping at the last delay leaves the
   * state unchanged, which React treats as no update, so the retry effect does
   * not re-run and the loop ends on its own with the error still on screen.
   */
  const scheduleRetry = useCallback(() => {
    if (!dirtyRef.current) return;
    setRetryAttempt((attempt) =>
      attempt >= SAVE_RETRY_DELAYS_MS.length ? attempt : attempt + 1,
    );
  }, []);

  const runSave = useCallback(async (): Promise<boolean> => {
    savingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      // Loops when changes arrived while the previous request was in flight.
      do {
        pendingRef.current = false;
        const snapshot = resumeRef.current;
        const name = variantRef.current;

        await repository.write(name, snapshot);

        setLastSavedAt(Date.now());
        setRetryAttempt(0);
        // Only clear the dot when what was saved is still what is on screen.
        if (resumeRef.current === snapshot && variantRef.current === name) {
          dirtyRef.current = false;
          setDirty(false);
        }
      } while (pendingRef.current);

      return true;
    } catch (cause) {
      setError(describeError(cause, "Could not save"));
      scheduleRetry();
      return false;
    } finally {
      savingRef.current = false;
      inFlightRef.current = null;
      setSaving(false);
    }
  }, [repository, scheduleRetry]);

  /**
   * Writes the document. Resolves to whether it is now on disk, so switching
   * variants can refuse to discard edits that failed to save.
   *
   * A save already in flight is never interrupted: the request is flagged as
   * pending, which makes that save loop once more with the newest document, and
   * the caller awaits the very same save.
   */
  const save = useCallback((): Promise<boolean> => {
    if (savingRef.current) {
      pendingRef.current = true;
      return inFlightRef.current ?? Promise.resolve(false);
    }

    const run = runSave();
    inFlightRef.current = run;
    return run;
  }, [runSave]);

  /** Writes pending edits before switching or duplicating a variant. */
  const flush = useCallback(
    (): Promise<boolean> => (dirtyRef.current ? save() : Promise.resolve(true)),
    [save],
  );

  // Autosave: debounced after the last change. Never fires on the initial load
  // because the document only becomes dirty through `commit`.
  useEffect(() => {
    if (!dirty) return;

    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [resume, dirty, save]);

  // Bounded retry after a failed save. The debounced effect above only re-arms
  // on a new edit, so without this a save that failed on a lock that cleared
  // two seconds later would never be attempted again.
  useEffect(() => {
    if (retryAttempt === 0) return;

    const timer = setTimeout(
      () => void save(),
      SAVE_RETRY_DELAYS_MS[retryAttempt - 1],
    );
    return () => clearTimeout(timer);
  }, [retryAttempt, save]);

  // Closing the tab inside the debounce window, or while a save keeps failing,
  // would lose the edit with no warning at all.
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---------------------------------------------------------------------- */
  /* Variants                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Opens another variant.
   *
   * Three things have to hold at once. Pending edits go to disk first, and a
   * failed write cancels the switch instead of discarding them. Two quick
   * selections must end on the variant chosen last, not on whichever response
   * happens to arrive last, which is what the load id is for. And edits typed
   * while the response was on its way still belong to the variant being left,
   * so they are written there before the document is replaced.
   */
  const loadVariant = useCallback(
    async (name: string) => {
      if (name === requestedRef.current) return;
      requestedRef.current = name;
      const load = (loadRef.current += 1);
      const stale = () => load !== loadRef.current;
      /** Puts the request back where it was, so a retry is not a no-op. */
      const abort = () => {
        if (!stale()) requestedRef.current = variantRef.current;
      };

      setError(null);
      setLoading(true);
      try {
        // Refuses to switch on a failed save rather than discarding the edits.
        if (!(await flush())) return abort();
        if (stale()) return;

        const loaded = await repository.read(name);
        if (stale()) return;

        // Anything typed while the response was in flight was typed into the
        // old variant, so it is written there before the switch.
        if (dirtyRef.current && !(await flush())) return abort();
        if (stale()) return;

        variantRef.current = name;
        setVariant(name);
        setLastSavedAt(null);
        commit(loaded, false);
      } catch (cause) {
        if (stale()) return;
        setError(describeError(cause, `Could not open "${name}"`));
        abort();
      } finally {
        if (!stale()) setLoading(false);
      }
    },
    [commit, flush, repository],
  );

  /** Puts a variant that was just stored on screen, saved and listed. */
  const adopt = useCallback(
    (name: string, document: Resume) => {
      setVariants((current) =>
        current.includes(name)
          ? current
          : [...current, name].sort((a, b) => a.localeCompare(b)),
      );
      // A load started before this point must not overwrite the new variant.
      loadRef.current += 1;
      requestedRef.current = name;
      variantRef.current = name;
      setVariant(name);
      setLastSavedAt(null);
      commit(document, false);
    },
    [commit],
  );

  const duplicate = useCallback(
    async (to: string) => {
      setError(null);
      setLoading(true);
      try {
        // The copy is made from the stored variant, so pending edits go first.
        if (!(await flush())) return;

        adopt(to, await repository.duplicate(variantRef.current, to));
      } catch (cause) {
        setError(describeError(cause, `Could not create "${to}"`));
      } finally {
        setLoading(false);
      }
    },
    [adopt, flush, repository],
  );

  /**
   * Opens the bundled placeholder resume (John Doe) as its own variant,
   * `example`, creating it the first time. An existing `example` is opened as
   * it is, so the user's edits to it are never overwritten, and the variant on
   * screen is untouched either way: its pending edits are written first, and
   * again after the example is stored, for anything typed in the meantime.
   */
  const loadExample = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (!(await flush())) return;

      const example = await createOrOpen(
        repository,
        EXAMPLE_VARIANT,
        loadExampleResume,
      );
      // Anything typed while the example was being stored was typed into the
      // variant on screen, so it is written there before the switch.
      if (dirtyRef.current && !(await flush())) return;

      adopt(EXAMPLE_VARIANT, example);
    } catch (cause) {
      setError(describeError(cause, "Could not open the example"));
    } finally {
      setLoading(false);
    }
  }, [adopt, flush, repository]);

  /* ---------------------------------------------------------------------- */
  /* Import / export                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Replaces the whole document with a file from disk.
   *
   * Autosave writes the result to the current variant's file about a second
   * later, so this is a destructive action on a file the user cannot get back.
   * Anything already typed is written first, and replacing a document that has
   * content in it is confirmed.
   */
  const importJson = useCallback(
    async (file: File) => {
      setError(null);

      const imported = await readResumeFile(file);
      if (!imported.ok) {
        setError(imported.error);
        return;
      }

      if (!confirmReplace(resumeRef.current, dirtyRef.current, file.name)) {
        return;
      }
      // Pending edits belong to this variant's file, not to the imported
      // document, and autosave is about to overwrite that file.
      if (!(await flush())) return;

      // Imported as an unsaved change, so the dot and autosave both apply.
      commit(imported.resume, true);
    },
    [commit, flush],
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([`${JSON.stringify(resumeRef.current, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${variantRef.current}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Document actions: every resume-ops helper, bound to this document       */
  /* ---------------------------------------------------------------------- */

  const actions = useMemo(
    () => ({
      updateSettings: (patch: Partial<ResumeSettings>) =>
        apply((current) => ops.updateSettings(current, patch)),

      updateHeader: (patch: ops.HeaderPatch) =>
        apply((current) => ops.updateHeader(current, patch)),
      addLink: () => apply(ops.addLink),
      updateLink: (index: number, patch: Partial<ResumeLink>) =>
        apply((current) => ops.updateLink(current, index, patch)),
      removeLink: (index: number) =>
        apply((current) => ops.removeLink(current, index)),
      moveLink: (from: number, to: number) =>
        apply((current) => ops.moveLink(current, from, to)),

      addSection: (type: SectionType) =>
        apply((current) => ops.addSection(current, type)),
      updateSection: (sectionId: string, patch: ops.SectionPatch) =>
        apply((current) => ops.updateSection(current, sectionId, patch)),
      removeSection: (sectionId: string) =>
        apply((current) => ops.removeSection(current, sectionId)),
      moveSection: (from: number, to: number) =>
        apply((current) => ops.moveSection(current, from, to)),
      toggleSectionVisible: (sectionId: string) =>
        apply((current) => ops.toggleSectionVisible(current, sectionId)),

      addEntry: (sectionId: string) =>
        apply((current) => ops.addEntry(current, sectionId)),
      updateEntry: (sectionId: string, entryId: string, patch: ops.EntryPatch) =>
        apply((current) => ops.updateEntry(current, sectionId, entryId, patch)),
      removeEntry: (sectionId: string, entryId: string) =>
        apply((current) => ops.removeEntry(current, sectionId, entryId)),
      moveEntry: (sectionId: string, from: number, to: number) =>
        apply((current) => ops.moveEntry(current, sectionId, from, to)),
      toggleEntryVisible: (sectionId: string, entryId: string) =>
        apply((current) => ops.toggleEntryVisible(current, sectionId, entryId)),

      addBullet: (sectionId: string, entryId: string) =>
        apply((current) => ops.addBullet(current, sectionId, entryId)),
      updateBullet: (
        sectionId: string,
        entryId: string,
        index: number,
        value: string,
      ) =>
        apply((current) =>
          ops.updateBullet(current, sectionId, entryId, index, value),
        ),
      removeBullet: (sectionId: string, entryId: string, index: number) =>
        apply((current) => ops.removeBullet(current, sectionId, entryId, index)),
      moveBullet: (
        sectionId: string,
        entryId: string,
        from: number,
        to: number,
      ) =>
        apply((current) =>
          ops.moveBullet(current, sectionId, entryId, from, to),
        ),

      splitBullet: (
        sectionId: string,
        entryId: string,
        index: number,
        caret: number,
      ) =>
        apply((current) =>
          ops.splitBullet(current, sectionId, entryId, index, caret),
        ),
      mergeBulletBackward: (
        sectionId: string,
        entryId: string,
        index: number,
      ) =>
        apply((current) =>
          ops.mergeBulletBackward(current, sectionId, entryId, index),
        ),
      insertEntryAfter: (sectionId: string, entryId: string) =>
        apply((current) => ops.insertEntryAfter(current, sectionId, entryId)),
    }),
    [apply],
  );

  return {
    resume,
    variant,
    variants,
    dirty,
    saving,
    loading,
    lastSavedAt,
    error,
    reportError,
    dismissError,
    save,
    loadVariant,
    duplicate,
    loadExample,
    importJson,
    exportJson,
    ...actions,
  };
}

/**
 * One line for a failure. A repository error already says what went wrong in
 * the user's terms; anything else (a request that never reached the server)
 * is prefixed with what was being attempted.
 */
function describeError(cause: unknown, attempt: string): string {
  return isRepositoryError(cause)
    ? cause.message
    : `${attempt}: ${messageOf(cause)}`;
}

/** Whether the document has anything in it worth asking about. */
function hasContent(resume: Resume): boolean {
  return (
    resume.sections.length > 0 ||
    Object.values(resume.header).some((value) =>
      Array.isArray(value) ? value.length > 0 : value !== "",
    )
  );
}

/**
 * Asks before an import throws away work. A blank, saved document has nothing
 * to lose, so the common first import is not interrupted.
 */
function confirmReplace(
  resume: Resume,
  dirty: boolean,
  fileName: string,
): boolean {
  if (!dirty && !hasContent(resume)) return true;
  return window.confirm(
    `Replace the whole document with ${fileName}?${
      dirty ? " Unsaved changes are written to the current variant first." : ""
    } This cannot be undone from the app.`,
  );
}

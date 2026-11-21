"use client";

import { useCallback, useMemo, useState } from "react";

import {
  targetKey,
  type CaretPosition,
  type EditTarget,
  type InlineEditApi,
} from "@/components/resume/inline-edit";
import * as ops from "@/lib/resume-ops";
import type { ResumeLink } from "@/lib/schema";
import { parseItems } from "@/lib/skills-items";

import type { ResumeEditor } from "./useResumeEditor";

/**
 * Turns the editor into the api the rendered page talks to.
 *
 * Every field edit lands on the same action the left-hand panel calls, so the
 * two ways of editing the document are indistinguishable downstream: one
 * resume-ops call, one commit, the same debounced autosave. The only state this
 * hook owns is the pending focus request, because moving the caret across a
 * structural change is the one thing a pure op cannot do.
 */
export function useInlineEditApi(
  editor: ResumeEditor,
  enabled: boolean,
): InlineEditApi {
  const [pendingFocus, setPendingFocus] = useState<{
    key: string;
    caret: CaretPosition;
  } | null>(null);

  const clearFocus = useCallback(() => setPendingFocus(null), []);

  const {
    resume,
    updateHeader,
    updateLink,
    updateSection,
    updateEntry,
    updateBullet,
    splitBullet: splitBulletAction,
    mergeBulletBackward: mergeBulletBackwardAction,
    insertEntryAfter,
    removeEntry,
    moveEntry,
    toggleEntryVisible,
  } = editor;

  const commit = useCallback(
    (target: EditTarget, value: string) => {
      switch (target.kind) {
        case "header": {
          // Written through a typed local rather than a computed property, so
          // the field name stays checked against the header's own shape.
          const patch: ops.HeaderPatch = {};
          patch[target.field] = value;
          updateHeader(patch);
          return;
        }
        case "link": {
          const patch: Partial<ResumeLink> = {};
          patch[target.field] = value;
          updateLink(target.index, patch);
          return;
        }
        case "sectionTitle":
          updateSection(target.sectionId, { title: value });
          return;
        case "entryField":
          // `field` is a plain string because the four entry types share no
          // field set. The block that rendered this target picked a field of
          // its own entry type, which is the assumption `updateEntry` already
          // documents for its own cast.
          updateEntry(target.sectionId, target.entryId, {
            [target.field]: value,
          } as ops.EntryPatch);
          return;
        case "bullet":
          updateBullet(target.sectionId, target.entryId, target.index, value);
          return;
        case "skillsItems":
          // The line is one field on screen and an array in the document.
          updateEntry(target.sectionId, target.entryId, {
            items: parseItems(value),
          });
          return;
      }
    },
    [updateHeader, updateLink, updateSection, updateEntry, updateBullet],
  );

  const splitBullet = useCallback(
    (sectionId: string, entryId: string, index: number, caret: number) => {
      // A path that does not resolve is a no-op in resume-ops, and asking for
      // focus on a bullet that was never created would leave the request
      // hanging until some unrelated field happened to match it.
      if (ops.bulletAt(resume, sectionId, entryId, index) === null) return;

      splitBulletAction(sectionId, entryId, index, caret);
      setPendingFocus({
        key: targetKey({ kind: "bullet", sectionId, entryId, index: index + 1 }),
        caret: "start",
      });
    },
    [resume, splitBulletAction],
  );

  const mergeBulletBackward = useCallback(
    (sectionId: string, entryId: string, index: number) => {
      // Read before the op: the caret has to land exactly where the two
      // bullets were joined, which is the length the one above had.
      const previous = ops.bulletAt(resume, sectionId, entryId, index - 1);
      if (previous === null) return;

      mergeBulletBackwardAction(sectionId, entryId, index);
      setPendingFocus({
        key: targetKey({ kind: "bullet", sectionId, entryId, index: index - 1 }),
        caret: previous.length,
      });
    },
    [resume, mergeBulletBackwardAction],
  );

  return useMemo(
    () => ({
      enabled,
      commit,
      splitBullet,
      mergeBulletBackward,
      // The new entry is blank and every one of its fields is already visible
      // and clickable, so there is nothing to hand the caret to.
      addEntryAfter: insertEntryAfter,
      removeEntry,
      moveEntry,
      toggleEntryVisible,
      pendingFocus,
      clearFocus,
    }),
    [
      enabled,
      commit,
      splitBullet,
      mergeBulletBackward,
      insertEntryAfter,
      removeEntry,
      moveEntry,
      toggleEntryVisible,
      pendingFocus,
      clearFocus,
    ],
  );
}

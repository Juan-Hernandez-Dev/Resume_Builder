"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The contract between the rendered resume and the editor that owns the
 * document, so the page itself can be edited in place.
 *
 * The resume components stay dumb: they describe *which field* a piece of text
 * is with an `EditTarget` and hand the typed string back. Nothing here knows
 * about resume-ops, autosave or React state — that is the editor's side of the
 * wire (components/editor/useInlineEditApi.ts). A page rendered without a
 * provider gets `null` from `useInlineEdit` and renders as plain text, which is
 * what keeps the document printable, testable and server-renderable.
 */

export type EditTarget =
  | { kind: "header"; field: "name" | "location" | "phone" | "email" }
  | { kind: "link"; index: number; field: "label" | "url" }
  | { kind: "sectionTitle"; sectionId: string }
  | { kind: "entryField"; sectionId: string; entryId: string; field: string }
  | { kind: "bullet"; sectionId: string; entryId: string; index: number }
  | { kind: "skillsItems"; sectionId: string; entryId: string };

/** Stable identity for a field, used to match a pending focus request. */
export function targetKey(target: EditTarget): string {
  switch (target.kind) {
    case "header":
      return `header:${target.field}`;
    case "link":
      return `link:${target.index}:${target.field}`;
    case "sectionTitle":
      return `sectionTitle:${target.sectionId}`;
    case "entryField":
      return `entryField:${target.sectionId}:${target.entryId}:${target.field}`;
    case "bullet":
      return `bullet:${target.sectionId}:${target.entryId}:${target.index}`;
    case "skillsItems":
      return `skillsItems:${target.sectionId}:${target.entryId}`;
  }
}

/** Where to put the caret: either end of the text, or a character offset. */
export type CaretPosition = "start" | "end" | number;

export type InlineEditApi = {
  enabled: boolean;
  commit: (target: EditTarget, value: string) => void;
  splitBullet: (
    sectionId: string,
    entryId: string,
    index: number,
    caret: number,
  ) => void;
  mergeBulletBackward: (
    sectionId: string,
    entryId: string,
    index: number,
  ) => void;
  addEntryAfter: (sectionId: string, entryId: string) => void;
  removeEntry: (sectionId: string, entryId: string) => void;
  moveEntry: (sectionId: string, from: number, to: number) => void;
  toggleEntryVisible: (sectionId: string, entryId: string) => void;
  /** Set by a structural op, consumed once by the field that matches. */
  pendingFocus: { key: string; caret: CaretPosition } | null;
  clearFocus: () => void;
};

const InlineEditContext = createContext<InlineEditApi | null>(null);

export function InlineEditProvider({
  value,
  children,
}: {
  value: InlineEditApi;
  children: ReactNode;
}) {
  return (
    <InlineEditContext.Provider value={value}>
      {children}
    </InlineEditContext.Provider>
  );
}

/**
 * The api, or `null` when the page is rendered outside an editor. Every caller
 * has to handle `null`: that is the mode in which the resume is just a
 * document, with no editing affordances in its DOM at all.
 */
export function useInlineEdit(): InlineEditApi | null {
  return useContext(InlineEditContext);
}

/** Whether this subtree is being edited in place. Convenience for the blocks. */
export function useInlineEditing(): boolean {
  return useInlineEdit()?.enabled === true;
}

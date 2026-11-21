"use client";

import type { ReactNode } from "react";

import type { ResumeEntry } from "@/lib/schema";

import { EntryCard } from "./EntryCard";
import { SortableItem, SortableList } from "./ui/SortableList";
import type { ResumeEditor } from "./useResumeEditor";

/**
 * The sortable list of entry cards inside one section.
 *
 * Generic over the entry type so the section's own entry shape flows through to
 * `summary` and to the form rendered by `children`: SectionCard narrows the
 * section once, and nothing below it needs a cast.
 */
export function EntryCardList<E extends ResumeEntry>({
  sectionId,
  entries,
  editor,
  noun,
  summary,
  children,
}: {
  sectionId: string;
  entries: E[];
  editor: ResumeEditor;
  noun: { singular: string; plural: string };
  summary: (entry: E) => string;
  children: (entry: E) => ReactNode;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-neutral-500">No {noun.plural} yet.</p>;
  }

  const ids = entries.map((entry) => entry.id);

  return (
    <SortableList
      id={`entries-${sectionId}`}
      ids={ids}
      onMove={(from, to) => editor.moveEntry(sectionId, from, to)}
    >
      <div className="space-y-2">
        {entries.map((entry) => (
          <SortableItem key={entry.id} id={entry.id}>
            {(handle) => (
              <EntryCard
                handle={handle}
                noun={noun.singular}
                summary={summary(entry).trim()}
                visible={entry.visible}
                onToggleVisible={() =>
                  editor.toggleEntryVisible(sectionId, entry.id)
                }
                onRemove={() => editor.removeEntry(sectionId, entry.id)}
              >
                {children(entry)}
              </EntryCard>
            )}
          </SortableItem>
        ))}
      </div>
    </SortableList>
  );
}

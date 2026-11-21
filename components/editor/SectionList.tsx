"use client";

import type { Section } from "@/lib/schema";

import { SectionCard } from "./SectionCard";
import { SortableItem, SortableList } from "./ui/SortableList";
import type { ResumeEditor } from "./useResumeEditor";

/** The sortable list of sections. */
export function SectionList({
  sections,
  editor,
}: {
  sections: Section[];
  editor: ResumeEditor;
}) {
  if (sections.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500">
        No sections yet. Add one below.
      </p>
    );
  }

  const ids = sections.map((section) => section.id);

  return (
    <SortableList id="sections" ids={ids} onMove={editor.moveSection}>
      <div className="space-y-2.5">
        {sections.map((section) => (
          <SortableItem key={section.id} id={section.id}>
            {(handle) => (
              <SectionCard section={section} editor={editor} handle={handle} />
            )}
          </SortableItem>
        ))}
      </div>
    </SortableList>
  );
}

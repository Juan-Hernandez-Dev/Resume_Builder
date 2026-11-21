"use client";

import { useState } from "react";

import type { Section } from "@/lib/schema";
import { formatItems } from "@/lib/skills-items";

import { AchievementEditor } from "./AchievementEditor";
import { CertificationEditor } from "./CertificationEditor";
import { EntryCardList } from "./EntryCardList";
import { EntryEditor } from "./EntryEditor";
import { ENTRY_NOUNS } from "./section-types";
import { SkillsEditor } from "./SkillsEditor";
import { Button } from "./ui/Button";
import { CollapsibleCard } from "./ui/CollapsibleCard";
import { DragHandle } from "./ui/DragHandle";
import { IconButton } from "./ui/IconButton";
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "./ui/Icons";
import type { SortableHandle } from "./ui/SortableList";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/**
 * One section: an editable title, hide and delete, and the list of entry cards
 * for its type. `SectionEntries` below narrows the section union so the entry
 * forms receive a fully typed entry.
 *
 * It is not the only place that switches on `section.type`. Adding a section
 * type means touching all of these:
 *
 * - lib/schema.ts            the entry and section schemas, and the union
 * - lib/resume-ops.ts        createEntry, and mapBullets if it has bullets
 * - lib/plain-text.ts        sectionGroups, for the ATS plain-text view
 * - components/resume/Section.tsx   the rendered block for the page
 * - app/resume.css           the block's own grid and classes
 * - this file                the entry form to show in the editor
 * - components/editor/section-types.ts   its label and entry noun
 *
 * The README repeats this list; keep both in step.
 */
export function SectionCard({
  section,
  editor,
  handle,
}: {
  section: Section;
  editor: ResumeEditor;
  handle: SortableHandle;
}) {
  const [open, setOpen] = useState(true);
  const noun = ENTRY_NOUNS[section.type];

  function handleRemove() {
    const name = section.title.trim() || "this section";
    if (
      section.entries.length > 0 &&
      !window.confirm(
        `Delete ${name} and its ${section.entries.length} ${
          section.entries.length === 1 ? noun.singular : noun.plural
        }?`,
      )
    ) {
      return;
    }
    editor.removeSection(section.id);
  }

  return (
    <CollapsibleCard
      open={open}
      onOpenChange={setOpen}
      dimmed={!section.visible}
      handle={<DragHandle handle={handle} label="Reorder section" />}
      title={
        <div className="flex min-w-0 items-center gap-2">
          <TextInput
            value={section.title}
            aria-label="Section title"
            placeholder="Section title"
            className="font-medium"
            onChange={(event) =>
              editor.updateSection(section.id, { title: event.target.value })
            }
          />
          <span className="shrink-0 text-[10px] tracking-wide text-neutral-400 uppercase">
            {section.type}
          </span>
        </div>
      }
      actions={
        <>
          <IconButton
            label={section.visible ? "Hide section" : "Show section"}
            pressed={!section.visible}
            onClick={() => editor.toggleSectionVisible(section.id)}
          >
            {section.visible ? <EyeIcon /> : <EyeOffIcon />}
          </IconButton>
          <IconButton label="Delete section" danger onClick={handleRemove}>
            <TrashIcon />
          </IconButton>
        </>
      }
    >
      <div className="space-y-2">
        <SectionEntries section={section} editor={editor} />
        <Button onClick={() => editor.addEntry(section.id)}>
          <PlusIcon />
          Add {noun.singular}
        </Button>
      </div>
    </CollapsibleCard>
  );
}

/** Dispatches to the entry form that matches the section type. */
function SectionEntries({
  section,
  editor,
}: {
  section: Section;
  editor: ResumeEditor;
}) {
  const noun = ENTRY_NOUNS[section.type];

  switch (section.type) {
    case "entries":
      return (
        <EntryCardList
          sectionId={section.id}
          entries={section.entries}
          editor={editor}
          noun={noun}
          summary={(entry) =>
            [entry.org, entry.role].filter(Boolean).join(" — ")
          }
        >
          {(entry) => (
            <EntryEditor
              sectionId={section.id}
              entry={entry}
              editor={editor}
            />
          )}
        </EntryCardList>
      );

    case "achievements":
      return (
        <EntryCardList
          sectionId={section.id}
          entries={section.entries}
          editor={editor}
          noun={noun}
          summary={(entry) => entry.title}
        >
          {(entry) => (
            <AchievementEditor
              sectionId={section.id}
              entry={entry}
              editor={editor}
            />
          )}
        </EntryCardList>
      );

    case "skills":
      return (
        <EntryCardList
          sectionId={section.id}
          entries={section.entries}
          editor={editor}
          noun={noun}
          summary={(entry) => entry.label || formatItems(entry.items)}
        >
          {(entry) => (
            <SkillsEditor
              sectionId={section.id}
              entry={entry}
              editor={editor}
            />
          )}
        </EntryCardList>
      );

    case "certifications":
      return (
        <EntryCardList
          sectionId={section.id}
          entries={section.entries}
          editor={editor}
          noun={noun}
          summary={(entry) => entry.name}
        >
          {(entry) => (
            <CertificationEditor
              sectionId={section.id}
              entry={entry}
              editor={editor}
            />
          )}
        </EntryCardList>
      );
  }
}

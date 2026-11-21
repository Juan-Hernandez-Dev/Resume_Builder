"use client";

import type { ExperienceEntry } from "@/lib/schema";

import { BulletList } from "./BulletList";
import { Field, FieldRow } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/** Form for one "entries" entry: experience, education, projects. */
export function EntryEditor({
  sectionId,
  entry,
  editor,
}: {
  sectionId: string;
  entry: ExperienceEntry;
  editor: ResumeEditor;
}) {
  const update = (patch: Partial<Omit<ExperienceEntry, "id">>) =>
    editor.updateEntry(sectionId, entry.id, patch);

  return (
    <div className="space-y-3">
      <FieldRow>
        <Field label="Organization">
          <TextInput
            value={entry.org}
            placeholder="Company or school"
            onChange={(event) => update({ org: event.target.value })}
          />
        </Field>
        <Field label="Location">
          <TextInput
            value={entry.location}
            placeholder="City, Country"
            onChange={(event) => update({ location: event.target.value })}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Role">
          <TextInput
            value={entry.role}
            placeholder="Title or degree"
            onChange={(event) => update({ role: event.target.value })}
          />
        </Field>
        <Field
          label="Period"
          hint="The separator follows the Dates setting in the toolbar."
        >
          <TextInput
            value={entry.period}
            placeholder="2024 - Present"
            onChange={(event) => update({ period: event.target.value })}
          />
        </Field>
      </FieldRow>

      <BulletList sectionId={sectionId} entry={entry} editor={editor} />
    </div>
  );
}

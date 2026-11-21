"use client";

import type { AchievementEntry } from "@/lib/schema";

import { Field, FieldRow } from "./ui/Field";
import { TextArea } from "./ui/TextArea";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/** Form for one "achievements" entry. */
export function AchievementEditor({
  sectionId,
  entry,
  editor,
}: {
  sectionId: string;
  entry: AchievementEntry;
  editor: ResumeEditor;
}) {
  const update = (patch: Partial<Omit<AchievementEntry, "id">>) =>
    editor.updateEntry(sectionId, entry.id, patch);

  return (
    <div className="space-y-3">
      <FieldRow>
        <Field label="Title">
          <TextInput
            value={entry.title}
            placeholder="Award or contest"
            onChange={(event) => update({ title: event.target.value })}
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

      <Field label="Description">
        <TextArea
          value={entry.description}
          placeholder="What you achieved, in one line."
          onChange={(event) => update({ description: event.target.value })}
        />
      </Field>

      <Field label="Year">
        <TextInput
          value={entry.year}
          placeholder="2023"
          onChange={(event) => update({ year: event.target.value })}
        />
      </Field>
    </div>
  );
}

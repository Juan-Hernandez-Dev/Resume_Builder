"use client";

import { useState } from "react";

import type { SkillsEntry } from "@/lib/schema";
import { formatItems, parseItems } from "@/lib/skills-items";

import { Field } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/**
 * Form for one skills line. Items are stored as an array but edited as one
 * comma separated input.
 *
 * While the input has focus the raw text is kept in local state, so a trailing
 * comma is not deleted from under the cursor; the parsed array is still written
 * on every keystroke, so the preview stays live. Blurring drops the draft and
 * shows the normalized value.
 */
export function SkillsEditor({
  sectionId,
  entry,
  editor,
}: {
  sectionId: string;
  entry: SkillsEntry;
  editor: ResumeEditor;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const update = (patch: Partial<Omit<SkillsEntry, "id">>) =>
    editor.updateEntry(sectionId, entry.id, patch);

  return (
    <div className="space-y-3">
      <Field label="Label">
        <TextInput
          value={entry.label}
          placeholder="Backend & Cloud"
          onChange={(event) => update({ label: event.target.value })}
        />
      </Field>

      <Field label="Items" hint="Comma separated.">
        <TextInput
          value={draft ?? formatItems(entry.items)}
          placeholder="Node.js, Express.js, SQL"
          onChange={(event) => {
            setDraft(event.target.value);
            update({ items: parseItems(event.target.value) });
          }}
          onBlur={() => setDraft(null)}
        />
      </Field>
    </div>
  );
}

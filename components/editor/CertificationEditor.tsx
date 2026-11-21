"use client";

import type { CertificationEntry } from "@/lib/schema";

import { Field, FieldRow } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/** Form for one "certifications" entry. */
export function CertificationEditor({
  sectionId,
  entry,
  editor,
}: {
  sectionId: string;
  entry: CertificationEntry;
  editor: ResumeEditor;
}) {
  const update = (patch: Partial<Omit<CertificationEntry, "id">>) =>
    editor.updateEntry(sectionId, entry.id, patch);

  return (
    <div className="space-y-3">
      <FieldRow>
        <Field label="Name">
          <TextInput
            value={entry.name}
            placeholder="AWS Certified Solutions Architect, Associate"
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>
        <Field label="Issuer">
          <TextInput
            value={entry.issuer}
            placeholder="Issued by Amazon Web Services"
            onChange={(event) => update({ issuer: event.target.value })}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Detail">
          <TextInput
            value={entry.detail}
            placeholder="Credential ID EXAMPLE-0000"
            onChange={(event) => update({ detail: event.target.value })}
          />
        </Field>
        <Field label="Date">
          <TextInput
            value={entry.date}
            placeholder="Mar. 14, 2023"
            onChange={(event) => update({ date: event.target.value })}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Link label">
          <TextInput
            value={entry.linkLabel}
            placeholder="Digital Certificate"
            onChange={(event) => update({ linkLabel: event.target.value })}
          />
        </Field>
        <Field label="URL">
          <TextInput
            value={entry.url}
            placeholder="https://example.com/certificate"
            onChange={(event) => update({ url: event.target.value })}
          />
        </Field>
      </FieldRow>
    </div>
  );
}

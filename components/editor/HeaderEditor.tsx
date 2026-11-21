"use client";

import { useState } from "react";

import type { ResumeHeader } from "@/lib/schema";

import { LinkList } from "./LinkList";
import { CollapsibleCard } from "./ui/CollapsibleCard";
import { Field, FieldRow } from "./ui/Field";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/** The document header: name, location, contact details and the links list. */
export function HeaderEditor({
  header,
  editor,
}: {
  header: ResumeHeader;
  editor: ResumeEditor;
}) {
  const [open, setOpen] = useState(true);

  const update = (patch: Partial<Omit<ResumeHeader, "links">>) =>
    editor.updateHeader(patch);

  return (
    <CollapsibleCard
      open={open}
      onOpenChange={setOpen}
      title={
        <span className="px-1 text-sm font-medium text-neutral-800">Header</span>
      }
    >
      <div className="space-y-3">
        <FieldRow>
          <Field label="Name">
            <TextInput
              value={header.name}
              placeholder="Your name"
              onChange={(event) => update({ name: event.target.value })}
            />
          </Field>
          <Field label="Location">
            <TextInput
              value={header.location}
              placeholder="City, Country"
              onChange={(event) => update({ location: event.target.value })}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Phone">
            <TextInput
              value={header.phone}
              placeholder="+1 555 010 0000"
              onChange={(event) => update({ phone: event.target.value })}
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={header.email}
              placeholder="you@example.com"
              onChange={(event) => update({ email: event.target.value })}
            />
          </Field>
        </FieldRow>

        <LinkList links={header.links} editor={editor} />
      </div>
    </CollapsibleCard>
  );
}

"use client";

import { useState } from "react";

import type { SectionType } from "@/lib/schema";

import { HeaderEditor } from "./HeaderEditor";
import {
  SECTION_TYPE_LABELS,
  SECTION_TYPES,
  toSectionType,
} from "./section-types";
import { SectionList } from "./SectionList";
import { Button } from "./ui/Button";
import { PlusIcon } from "./ui/Icons";
import { INPUT_CLASS } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/** The left pane: the header form, the sections, and the section picker. */
export function EditorPanel({ editor }: { editor: ResumeEditor }) {
  const [type, setType] = useState<SectionType>("entries");

  return (
    <div className="space-y-3">
      <HeaderEditor header={editor.resume.header} editor={editor} />
      <SectionList sections={editor.resume.sections} editor={editor} />

      <div className="flex items-end gap-2 rounded-md border border-neutral-300 bg-white p-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
            New section
          </span>
          <select
            value={type}
            onChange={(event) => {
              const next = toSectionType(event.target.value);
              if (next) setType(next);
            }}
            className={INPUT_CLASS}
          >
            {SECTION_TYPES.map((option) => (
              <option key={option} value={option}>
                {SECTION_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => editor.addSection(type)}>
          <PlusIcon />
          Add section
        </Button>
      </div>
    </div>
  );
}

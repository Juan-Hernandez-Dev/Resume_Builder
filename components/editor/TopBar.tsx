"use client";

import { useRef, type ChangeEvent } from "react";

import { formatOverflow, type Overflow } from "@/lib/overflow";
import type { DateSeparator, PageSize } from "@/lib/schema";
import { sanitizeVariantName, VARIANT_NAME_RULE } from "@/lib/variant-name";

import { PdfExport } from "./PdfExport";
import { Button } from "./ui/Button";
import { SegmentedControl } from "./ui/SegmentedControl";
import { INPUT_CLASS } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

const PAGE_SIZES = [
  { value: "letter", label: "Letter", title: "8.5in x 11in" },
  { value: "a4", label: "A4", title: "210mm x 297mm" },
] as const satisfies readonly { value: PageSize; label: string; title: string }[];

const DATE_SEPARATORS = [
  { value: "hyphen", label: "2024 - 2025", title: "Plain hyphen (ATS safe)" },
  { value: "endash", label: "2024 – 2025", title: "En dash" },
] as const satisfies readonly {
  value: DateSeparator;
  label: string;
  title: string;
}[];

/** Variant, saving, page size, dates, export and the overflow indicator. */
export function TopBar({
  editor,
  overflow,
}: {
  editor: ResumeEditor;
  overflow: Overflow;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDuplicate() {
    const input = window.prompt(
      "Name for the new variant",
      `${editor.variant}-copy`,
    );
    if (input === null) return;

    const name = sanitizeVariantName(input);
    if (name === "") {
      editor.reportError(
        `"${input}" cannot be used as a variant name: use ${VARIANT_NAME_RULE}.`,
      );
      return;
    }
    if (name !== input.trim() && !window.confirm(`Create "${name}" instead?`)) {
      return;
    }

    void editor.duplicate(name);
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice fires change again.
    event.target.value = "";
    if (file) void editor.importJson(file);
  }

  return (
    <header className="no-print flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-400/60 bg-neutral-200 px-4 py-2">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
            Variant
          </span>
          {/* Disabled while a variant is being opened or copied: the document
              on screen is about to be replaced, and a second selection in the
              middle of that is how edits get written to the wrong file. */}
          <select
            value={editor.variant}
            disabled={editor.loading}
            onChange={(event) => void editor.loadVariant(event.target.value)}
            className={`${INPUT_CLASS} w-auto py-1 text-xs disabled:opacity-50`}
          >
            {editor.variants.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={editor.loading} onClick={handleDuplicate}>
          Duplicate variant
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          primary
          onClick={() => void editor.save()}
          disabled={editor.saving || !editor.dirty}
        >
          {editor.saving ? "Saving…" : "Save"}
        </Button>
        <SaveStatus editor={editor} />
      </div>

      <SegmentedControl
        label="Page size"
        value={editor.resume.settings.pageSize}
        options={PAGE_SIZES}
        onChange={(pageSize) => editor.updateSettings({ pageSize })}
      />

      <SegmentedControl
        label="Dates"
        value={editor.resume.settings.dateSeparator}
        options={DATE_SEPARATORS}
        onChange={(dateSeparator) => editor.updateSettings({ dateSeparator })}
      />

      <PdfExport resume={editor.resume} variant={editor.variant} />

      <div className="flex items-center gap-2">
        <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
        <Button onClick={editor.exportJson}>Export JSON</Button>
      </div>

      <span
        role="status"
        className={`ml-auto rounded px-2 py-1 text-[11px] whitespace-nowrap ${
          overflow.overflows
            ? "bg-amber-100 text-amber-900"
            : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {formatOverflow(overflow)}
      </span>
    </header>
  );
}

/** The unsaved-changes dot, or when the last save happened. */
function SaveStatus({ editor }: { editor: ResumeEditor }) {
  if (editor.dirty) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-amber-800">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full bg-amber-500"
        />
        Unsaved changes
      </span>
    );
  }

  return (
    <span className="text-[11px] whitespace-nowrap text-neutral-500">
      {editor.lastSavedAt === null
        ? "Saved"
        : `Saved ${new Date(editor.lastSavedAt).toLocaleTimeString()}`}
    </span>
  );
}

"use client";

import { BlockTools } from "./BlockTools";
import { Editable } from "./Editable";
import { useInlineEditing } from "./inline-edit";

import { formatItems } from "@/lib/skills-items";
import type { SkillsEntry } from "@/lib/schema";

/**
 * "skills" block: one line per entry, "<b>Label</b>: item, item, item", with
 * no vertical gap between lines. Rendered as paragraphs rather than a list so
 * an ATS does not read the labels as bullet points.
 *
 * The items are one field on screen and an array in the document, exactly as
 * in the left-hand panel: the line shows `formatItems` and a commit runs the
 * typed string back through `parseItems`. The comma the user just typed is
 * therefore safe — the field is uncontrolled, so nothing is written back into
 * it while the caret is inside, and `parseItems` drops the blank item behind
 * the comma before it is ever stored.
 */
export function SkillsBlock({
  entries,
  sectionId,
  count,
}: {
  /** The visible entries, each with its index in the stored array. */
  entries: { entry: SkillsEntry; index: number }[];
  sectionId: string;
  count: number;
}) {
  const editing = useInlineEditing();

  return (
    <div className="resume-skills">
      {entries.map(({ entry, index }) => {
        const filled = entry.items.filter((item) => item.trim() !== "");
        // Today's glue condition, kept verbatim so print does not depend on
        // whether editing was on.
        const glue = entry.label !== "" && filled.length > 0;

        return (
          <p className="resume-skills__line" key={entry.id}>
            {editing || entry.label ? (
              <Editable
                className="resume-skills__label"
                target={{
                  kind: "entryField",
                  sectionId,
                  entryId: entry.id,
                  field: "label",
                }}
                value={entry.label}
                placeholder="Label"
              />
            ) : null}
            {editing ? (
              <span data-inline-empty={glue ? undefined : "true"}>{": "}</span>
            ) : glue ? (
              ": "
            ) : null}
            {editing ? (
              <Editable
                target={{ kind: "skillsItems", sectionId, entryId: entry.id }}
                // The *filtered* list, the same string the non-editing render
                // prints. It costs nothing while typing: the field is
                // uncontrolled, so this is not written back into the element
                // until the caret has left it, and it is `parseItems` — which
                // already drops blanks — that decides what gets stored.
                value={formatItems(filled)}
                placeholder="Items, comma separated"
                empty={filled.length === 0}
              />
            ) : (
              formatItems(filled)
            )}
            {/* Last in the DOM so Tab walks the text before the controls;
                painted in the left margin regardless, because it is positioned
                absolutely. */}
            <BlockTools
              sectionId={sectionId}
              entryId={entry.id}
              index={index}
              count={count}
              visible={entry.visible}
            />
          </p>
        );
      })}
    </div>
  );
}

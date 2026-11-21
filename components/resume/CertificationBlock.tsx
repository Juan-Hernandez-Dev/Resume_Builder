"use client";

import { BlockTools } from "./BlockTools";
import { Editable } from "./Editable";
import { useInlineEditing } from "./inline-edit";

import type { CertificationEntry } from "@/lib/schema";

/**
 * "certifications" block. Rows: name/issuer, detail/date, and a third row with
 * the clickable link spanning both columns.
 *
 * The link row is the one composed line here: a label, the literal ": ", and
 * the address. Each of the two values is its own field and the glue in between
 * is plain text, so nothing on this row is generated content.
 */
export function CertificationBlock({
  entry,
  sectionId,
  index,
  count,
}: {
  entry: CertificationEntry;
  sectionId: string;
  index: number;
  count: number;
}) {
  const editing = useInlineEditing();
  // While editing, the row is always there so an empty link can be filled in;
  // print drops the whole row again when both of its fields are empty, which
  // is the row the non-editing render would not have emitted at all.
  const hasLink = editing || entry.url !== "" || entry.linkLabel !== "";

  return (
    <div className="resume-block resume-certification">
      <div className="resume-grid">
        <Editable
          className="resume-certification__name"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "name",
          }}
          value={entry.name}
          placeholder="Name"
        />
        <Editable
          className="resume-certification__issuer"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "issuer",
          }}
          value={entry.issuer}
          placeholder="Issuer"
        />
        <Editable
          className="resume-certification__detail"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "detail",
          }}
          value={entry.detail}
          placeholder="Detail"
        />
        <Editable
          className="resume-certification__date"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "date",
          }}
          value={entry.date}
          placeholder="Date"
        />
        {hasLink ? (
          <span
            className="resume-certification__link"
            data-inline-empty={
              editing && entry.linkLabel === "" && entry.url === ""
                ? "true"
                : undefined
            }
          >
            <Editable
              target={{
                kind: "entryField",
                sectionId,
                entryId: entry.id,
                field: "linkLabel",
              }}
              value={entry.linkLabel}
              placeholder="Link label"
            />
            {editing ? (
              // The glue has to vanish with the label it follows, or a printed
              // page would keep a colon with nothing in front of it.
              <span
                data-inline-empty={entry.linkLabel === "" ? "true" : undefined}
              >
                {": "}
              </span>
            ) : entry.linkLabel ? (
              ": "
            ) : null}
            {editing || entry.url ? (
              <Editable
                as="a"
                href={entry.url === "" ? undefined : entry.url}
                target={{
                  kind: "entryField",
                  sectionId,
                  entryId: entry.id,
                  field: "url",
                }}
                value={entry.url}
                placeholder="Link URL"
              />
            ) : null}
          </span>
        ) : null}
      </div>
      {/* Last in the DOM so Tab walks the text before the controls; painted in
          the left margin regardless, because it is positioned absolutely. */}
      <BlockTools
        sectionId={sectionId}
        entryId={entry.id}
        index={index}
        count={count}
        visible={entry.visible}
      />
    </div>
  );
}

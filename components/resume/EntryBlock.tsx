"use client";

import { BlockTools } from "./BlockTools";
import { Editable } from "./Editable";
import { useInlineEdit } from "./inline-edit";

import { formatPeriod } from "@/lib/date-separator";
import type { DateSeparator, ExperienceEntry } from "@/lib/schema";

/**
 * "entries" block (experience, education).
 *
 * DOM order is org, location, role, period, bullets — the exact reading order
 * an ATS needs. The two columns come from a CSS grid in normal flow.
 *
 * The bullet list is rendered unfiltered while editing, and only then. Every
 * bullet operation addresses a position in the *stored* array, so dropping the
 * empty ones from the render would make on-screen bullet 2 edit stored bullet
 * 5. Print drops the empty ones again (app/print.css), which is what keeps the
 * document identical with editing on or off.
 */
export function EntryBlock({
  entry,
  sectionId,
  index,
  count,
  dateSeparator,
}: {
  entry: ExperienceEntry;
  sectionId: string;
  index: number;
  count: number;
  dateSeparator: DateSeparator;
}) {
  const api = useInlineEdit();
  const editing = api !== null && api.enabled;

  const bullets = editing
    ? entry.bullets
    : entry.bullets.filter((bullet) => bullet.trim() !== "");
  // While editing, the role row is always there: a role and a period that are
  // both empty still have to be clickable to be filled in.
  const hasRoleRow = editing || entry.role !== "" || entry.period !== "";

  return (
    <div className="resume-block resume-entry">
      <div className="resume-grid">
        <Editable
          className="resume-entry__org"
          target={{ kind: "entryField", sectionId, entryId: entry.id, field: "org" }}
          value={entry.org}
          placeholder="Organization"
        />
        <Editable
          className="resume-entry__location"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "location",
          }}
          value={entry.location}
          placeholder="Location"
        />
        {hasRoleRow ? (
          <>
            <Editable
              className="resume-entry__role"
              target={{
                kind: "entryField",
                sectionId,
                entryId: entry.id,
                field: "role",
              }}
              value={entry.role}
              placeholder="Role"
            />
            <Editable
              className="resume-entry__period"
              target={{
                kind: "entryField",
                sectionId,
                entryId: entry.id,
                field: "period",
              }}
              // The separator setting rewrites what is shown, never what is
              // stored; Editable commits the raw string and this formatter
              // reapplies on the next render.
              value={formatPeriod(entry.period, dateSeparator)}
              placeholder="Period"
            />
          </>
        ) : null}
      </div>
      {bullets.length > 0 ? (
        <ul
          className="resume-bullets"
          // A list of nothing but empty bullets is not a list: the non-editing
          // render would have dropped it entirely, and its top margin would
          // otherwise still print.
          data-inline-empty={
            editing && bullets.every((bullet) => bullet.trim() === "")
              ? "true"
              : undefined
          }
        >
          {bullets.map((bullet, position) => (
            <Editable
              as="li"
              className="resume-bullets__item"
              key={position}
              target={{ kind: "bullet", sectionId, entryId: entry.id, index: position }}
              value={bullet}
              placeholder="Bullet"
              // The filter above drops whitespace-only bullets, so print has to
              // drop them too, not just the strictly empty ones.
              empty={bullet.trim() === ""}
              onEnter={(caret) =>
                api?.splitBullet(sectionId, entry.id, position, caret)
              }
              onBackspaceAtStart={() =>
                api?.mergeBulletBackward(sectionId, entry.id, position)
              }
            />
          ))}
        </ul>
      ) : null}
      {/* Last in the DOM, though it is painted in the left margin: Tab should
          walk the text of the block first and reach the structural controls
          after it, not before a single word has been edited. Its position is
          absolute, so document order costs it nothing. */}
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

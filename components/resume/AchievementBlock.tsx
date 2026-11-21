import { BlockTools } from "./BlockTools";
import { Editable } from "./Editable";

import type { AchievementEntry } from "@/lib/schema";

/**
 * "achievements" block. Same two-column grid as EntryBlock: title/location on
 * the first row, description/year on the second. The year is bottom aligned so
 * it lands on the last line of a wrapping description.
 *
 * Every field is unconditional here, so nothing extra is needed to keep an
 * empty one clickable while the page is being edited.
 */
export function AchievementBlock({
  entry,
  sectionId,
  index,
  count,
}: {
  entry: AchievementEntry;
  sectionId: string;
  index: number;
  count: number;
}) {
  return (
    <div className="resume-block resume-achievement">
      <div className="resume-grid">
        <Editable
          className="resume-achievement__title"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "title",
          }}
          value={entry.title}
          placeholder="Title"
        />
        <Editable
          className="resume-achievement__location"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "location",
          }}
          value={entry.location}
          placeholder="Location"
        />
        <Editable
          className="resume-achievement__description"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "description",
          }}
          value={entry.description}
          placeholder="Description"
        />
        <Editable
          className="resume-achievement__year"
          target={{
            kind: "entryField",
            sectionId,
            entryId: entry.id,
            field: "year",
          }}
          value={entry.year}
          placeholder="Year"
        />
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

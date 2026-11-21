import { AchievementBlock } from "./AchievementBlock";
import { CertificationBlock } from "./CertificationBlock";
import { Editable } from "./Editable";
import { EntryBlock } from "./EntryBlock";
import { SkillsBlock } from "./SkillsBlock";

import type { Section as ResumeSection, ResumeSettings } from "@/lib/schema";

/**
 * One resume section: a semantic <section> with an <h2> ruled heading, then the
 * block that matches the section type. Hidden entries are not rendered.
 *
 * Hiding an entry stays a deliberate choice made in the left-hand panel, so the
 * visibility filter applies while editing too. What the filter must not do is
 * renumber anything: every block is told the index its entry has in the
 * *stored* array, because that is what `moveEntry` addresses.
 */
export function Section({
  section,
  settings,
}: {
  section: ResumeSection;
  settings: ResumeSettings;
}) {
  return (
    <section className="resume-section">
      <Editable
        as="h2"
        className="resume-section__title"
        target={{ kind: "sectionTitle", sectionId: section.id }}
        value={section.title}
        placeholder="Section title"
      />
      {renderEntries(section, settings)}
    </section>
  );
}

/** The visible entries, each paired with its index in the stored array. */
function visible<T extends { visible: boolean }>(entries: T[]) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter((item) => item.entry.visible);
}

function renderEntries(section: ResumeSection, settings: ResumeSettings) {
  // The stored length, not the visible one: it is the range `moveEntry` works
  // in, so it is what decides when "move down" has nowhere to go.
  const count = section.entries.length;

  switch (section.type) {
    case "entries":
      return visible(section.entries).map(({ entry, index }) => (
        <EntryBlock
          key={entry.id}
          entry={entry}
          sectionId={section.id}
          index={index}
          count={count}
          dateSeparator={settings.dateSeparator}
        />
      ));
    case "achievements":
      return visible(section.entries).map(({ entry, index }) => (
        <AchievementBlock
          key={entry.id}
          entry={entry}
          sectionId={section.id}
          index={index}
          count={count}
        />
      ));
    case "skills":
      return (
        <SkillsBlock
          entries={visible(section.entries)}
          sectionId={section.id}
          count={count}
        />
      );
    case "certifications":
      return visible(section.entries).map(({ entry, index }) => (
        <CertificationBlock
          key={entry.id}
          entry={entry}
          sectionId={section.id}
          index={index}
          count={count}
        />
      ));
  }
}

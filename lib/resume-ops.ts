import {
  newId,
  type AchievementEntry,
  type CertificationEntry,
  type ExperienceEntry,
  type Resume,
  type ResumeEntry,
  type ResumeHeader,
  type ResumeLink,
  type ResumeSettings,
  type Section,
  type SectionType,
  type SkillsEntry,
} from "./schema";

/**
 * Every editor action is one pure function from a Resume to a new Resume. No
 * function here mutates its input, and each one returns the *same* resume when
 * the action changes nothing (an unknown id, an out-of-range move), so React
 * can skip the re-render and autosave does not fire on a no-op.
 */

/** A patch for the scalar header fields. The links have their own operations. */
export type HeaderPatch = Partial<Omit<ResumeHeader, "links">>;

/** A patch for the section fields the editor owns. `type` is never patched. */
export type SectionPatch = { title?: string; visible?: boolean };

/** Distributes over the entry union so each variant keeps its own fields. */
type EntryFieldsPatch<T> = T extends ResumeEntry ? Partial<Omit<T, "id">> : never;
export type EntryPatch = EntryFieldsPatch<ResumeEntry>;

/* -------------------------------------------------------------------------- */
/* Array helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether applying `changes` to `current` would leave every field as it is.
 *
 * This is what makes the no-op contract hold for the patch operations. It is
 * not only about a skipped re-render: the editor marks the document dirty from
 * any new object it gets back, so without this, re-selecting the page size
 * already in use would write the variant file.
 *
 * A key whose value is `undefined` counts as absent, which is how the editor's
 * optional patch fields are meant to read.
 */
function isNoOpPatch(current: object, changes: object): boolean {
  const fields = current as Record<string, unknown>;
  return Object.entries(changes).every(
    ([key, value]) => value === undefined || value === fields[key],
  );
}

/**
 * Moves one item inside a list. Returns the original list for a no-op or for
 * indexes outside the list, which is what a cancelled drag produces.
 *
 * `to` is guarded against negatives on purpose: `splice(-1, 0, item)` counts
 * from the end rather than failing, so a cancelled drag would silently reorder
 * the list instead of leaving it alone.
 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list;
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }

  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* -------------------------------------------------------------------------- */
/* Factories                                                                   */
/* -------------------------------------------------------------------------- */

/** A blank entry for the given section type: every field empty, visible. */
export function createEntry(type: "entries"): ExperienceEntry;
export function createEntry(type: "achievements"): AchievementEntry;
export function createEntry(type: "skills"): SkillsEntry;
export function createEntry(type: "certifications"): CertificationEntry;
export function createEntry(type: SectionType): ResumeEntry;
export function createEntry(type: SectionType): ResumeEntry {
  const base = { id: newId(), visible: true };

  switch (type) {
    case "entries":
      return { ...base, org: "", location: "", role: "", period: "", bullets: [] };
    case "achievements":
      return { ...base, title: "", location: "", description: "", year: "" };
    case "skills":
      return { ...base, label: "", items: [] };
    case "certifications":
      return {
        ...base,
        name: "",
        issuer: "",
        detail: "",
        date: "",
        linkLabel: "",
        url: "",
      };
  }
}

/** A blank section of the given type, with no entries yet. */
export function createSection(type: SectionType): Section {
  return { id: newId(), title: "", visible: true, type, entries: [] };
}

/* -------------------------------------------------------------------------- */
/* Internal plumbing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Replaces one section by id. `map` returning the section it was given means
 * "nothing changed", which propagates up as the original resume.
 */
function mapSection(
  resume: Resume,
  sectionId: string,
  map: (section: Section) => Section,
): Resume {
  const index = resume.sections.findIndex((section) => section.id === sectionId);
  if (index === -1) return resume;

  const current = resume.sections[index];
  const next = map(current);
  if (next === current) return resume;

  const sections = resume.sections.slice();
  sections[index] = next;
  return { ...resume, sections };
}

/**
 * Rebuilds a section around a new entry array.
 *
 * The cast is the one place the discriminated union has to be re-asserted: a
 * section's entry type is bound to its `type` literal, which no generic helper
 * can express. Every caller maps the section's own entries to entries of the
 * same shape, so the assertion holds.
 */
function withEntries(section: Section, entries: ResumeEntry[]): Section {
  return { ...section, entries } as Section;
}

/** Replaces the entries of one section. `null` means "nothing changed". */
function mapEntries(
  resume: Resume,
  sectionId: string,
  map: (entries: ResumeEntry[]) => ResumeEntry[] | null,
): Resume {
  return mapSection(resume, sectionId, (section) => {
    const next = map(section.entries);
    if (next === null || next === section.entries) return section;
    return withEntries(section, next);
  });
}

/** Replaces one entry of one section. `null` means "nothing changed". */
function mapEntry(
  resume: Resume,
  sectionId: string,
  entryId: string,
  map: (entry: ResumeEntry) => ResumeEntry | null,
): Resume {
  return mapEntries(resume, sectionId, (entries) => {
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) return null;

    const next = map(entries[index]);
    if (next === null || next === entries[index]) return null;

    const copy = entries.slice();
    copy[index] = next;
    return copy;
  });
}

/**
 * Replaces the bullets of one experience entry. Only "entries" sections have
 * bullets; every other section type is left untouched.
 */
function mapBullets(
  resume: Resume,
  sectionId: string,
  entryId: string,
  map: (bullets: string[]) => string[] | null,
): Resume {
  return mapSection(resume, sectionId, (section) => {
    if (section.type !== "entries") return section;

    const index = section.entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) return section;

    const entry = section.entries[index];
    const bullets = map(entry.bullets);
    if (bullets === null || bullets === entry.bullets) return section;

    const entries = section.entries.slice();
    entries[index] = { ...entry, bullets };
    return { ...section, entries };
  });
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export function updateSettings(
  resume: Resume,
  patch: Partial<ResumeSettings>,
): Resume {
  if (isNoOpPatch(resume.settings, patch)) return resume;
  return { ...resume, settings: { ...resume.settings, ...patch } };
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

export function updateHeader(resume: Resume, patch: HeaderPatch): Resume {
  if (isNoOpPatch(resume.header, patch)) return resume;
  return { ...resume, header: { ...resume.header, ...patch } };
}

function mapLinks(
  resume: Resume,
  map: (links: ResumeLink[]) => ResumeLink[] | null,
): Resume {
  const links = map(resume.header.links);
  if (links === null || links === resume.header.links) return resume;
  return { ...resume, header: { ...resume.header, links } };
}

export function addLink(resume: Resume): Resume {
  return mapLinks(resume, (links) => [...links, { label: "", url: "" }]);
}

export function updateLink(
  resume: Resume,
  index: number,
  patch: Partial<ResumeLink>,
): Resume {
  return mapLinks(resume, (links) => {
    if (index < 0 || index >= links.length) return null;
    if (isNoOpPatch(links[index], patch)) return null;
    const next = links.slice();
    next[index] = { ...next[index], ...patch };
    return next;
  });
}

export function removeLink(resume: Resume, index: number): Resume {
  return mapLinks(resume, (links) => {
    if (index < 0 || index >= links.length) return null;
    return links.filter((_, position) => position !== index);
  });
}

export function moveLink(resume: Resume, from: number, to: number): Resume {
  return mapLinks(resume, (links) => moveItem(links, from, to));
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

export function addSection(resume: Resume, type: SectionType): Resume {
  return { ...resume, sections: [...resume.sections, createSection(type)] };
}

export function updateSection(
  resume: Resume,
  sectionId: string,
  patch: SectionPatch,
): Resume {
  return mapSection(resume, sectionId, (section) =>
    isNoOpPatch(section, patch) ? section : { ...section, ...patch },
  );
}

export function toggleSectionVisible(resume: Resume, sectionId: string): Resume {
  return mapSection(resume, sectionId, (section) => ({
    ...section,
    visible: !section.visible,
  }));
}

export function removeSection(resume: Resume, sectionId: string): Resume {
  const sections = resume.sections.filter((section) => section.id !== sectionId);
  if (sections.length === resume.sections.length) return resume;
  return { ...resume, sections };
}

export function moveSection(resume: Resume, from: number, to: number): Resume {
  const sections = moveItem(resume.sections, from, to);
  if (sections === resume.sections) return resume;
  return { ...resume, sections };
}

/* -------------------------------------------------------------------------- */
/* Entries                                                                     */
/* -------------------------------------------------------------------------- */

export function addEntry(resume: Resume, sectionId: string): Resume {
  return mapSection(resume, sectionId, (section) =>
    withEntries(section, [...section.entries, createEntry(section.type)]),
  );
}

export function updateEntry(
  resume: Resume,
  sectionId: string,
  entryId: string,
  patch: EntryPatch,
): Resume {
  return mapEntry(resume, sectionId, entryId, (entry) =>
    isNoOpPatch(entry, patch)
      ? entry
      : {
          ...entry,
          // Safe for the same reason as withEntries: the caller patches fields
          // of the entry type that this section holds.
          ...(patch as Partial<ResumeEntry>),
        },
  );
}

export function toggleEntryVisible(
  resume: Resume,
  sectionId: string,
  entryId: string,
): Resume {
  return mapEntry(resume, sectionId, entryId, (entry) => ({
    ...entry,
    visible: !entry.visible,
  }));
}

export function removeEntry(
  resume: Resume,
  sectionId: string,
  entryId: string,
): Resume {
  return mapEntries(resume, sectionId, (entries) => {
    const next = entries.filter((entry) => entry.id !== entryId);
    return next.length === entries.length ? null : next;
  });
}

export function moveEntry(
  resume: Resume,
  sectionId: string,
  from: number,
  to: number,
): Resume {
  return mapEntries(resume, sectionId, (entries) => moveItem(entries, from, to));
}

/* -------------------------------------------------------------------------- */
/* Bullets                                                                     */
/* -------------------------------------------------------------------------- */

export function addBullet(
  resume: Resume,
  sectionId: string,
  entryId: string,
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) => [...bullets, ""]);
}

export function updateBullet(
  resume: Resume,
  sectionId: string,
  entryId: string,
  index: number,
  value: string,
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) => {
    if (index < 0 || index >= bullets.length) return null;
    const next = bullets.slice();
    next[index] = value;
    return next;
  });
}

export function removeBullet(
  resume: Resume,
  sectionId: string,
  entryId: string,
  index: number,
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) => {
    if (index < 0 || index >= bullets.length) return null;
    return bullets.filter((_, position) => position !== index);
  });
}

export function moveBullet(
  resume: Resume,
  sectionId: string,
  entryId: string,
  from: number,
  to: number,
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) =>
    moveItem(bullets, from, to),
  );
}

/* -------------------------------------------------------------------------- */
/* Inline editing on the page                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The operations behind editing the rendered page directly, where a keystroke
 * has to change the document's *structure* rather than one field.
 *
 * They live here, as pure functions with the same no-op contract as everything
 * above, because that is what keeps the inline layer honest: pressing Enter in
 * a bullet is one commit against one Resume, indistinguishable to autosave
 * from typing in the left panel.
 */

/** Reads one bullet, or `null` when the path does not resolve. */
export function bulletAt(
  resume: Resume,
  sectionId: string,
  entryId: string,
  index: number,
): string | null {
  const section = resume.sections.find((item) => item.id === sectionId);
  if (section === undefined || section.type !== "entries") return null;

  const entry = section.entries.find((item) => item.id === entryId);
  if (entry === undefined) return null;

  return index < 0 || index >= entry.bullets.length ? null : entry.bullets[index];
}

/** Inserts a bullet at `index`, pushing the rest down. */
export function insertBullet(
  resume: Resume,
  sectionId: string,
  entryId: string,
  index: number,
  value = "",
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) => {
    // `index === bullets.length` appends, which is what Enter on the last
    // bullet asks for; anything past that is not a position in this list.
    if (index < 0 || index > bullets.length) return null;
    const next = bullets.slice();
    next.splice(index, 0, value);
    return next;
  });
}

/**
 * Enter inside a bullet: everything from `caret` onwards moves to a new bullet
 * below. Pressing Enter at the end therefore opens an empty bullet, and in the
 * middle of a sentence it breaks the line in two, which is what every document
 * editor does.
 */
export function splitBullet(
  resume: Resume,
  sectionId: string,
  entryId: string,
  index: number,
  caret: number,
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) => {
    if (index < 0 || index >= bullets.length) return null;

    const text = bullets[index];
    // A caret the browser reports outside the text is clamped rather than
    // refused: losing the keystroke would be worse than splitting at the end.
    const at = Math.min(Math.max(caret, 0), text.length);

    const next = bullets.slice();
    next[index] = text.slice(0, at);
    next.splice(index + 1, 0, text.slice(at));
    return next;
  });
}

/**
 * Backspace at the start of a bullet: it joins the end of the one above, and
 * the two become one. The first bullet has nothing to merge into, so it is a
 * no-op there and the browser's own Backspace handling is left alone.
 */
export function mergeBulletBackward(
  resume: Resume,
  sectionId: string,
  entryId: string,
  index: number,
): Resume {
  return mapBullets(resume, sectionId, entryId, (bullets) => {
    if (index <= 0 || index >= bullets.length) return null;

    const next = bullets.slice();
    next[index - 1] = next[index - 1] + next[index];
    next.splice(index, 1);
    return next;
  });
}

/**
 * Adds a blank entry directly below `entryId` instead of at the end of the
 * section, so the "add" control on a block puts the new entry where the user
 * is looking.
 */
export function insertEntryAfter(
  resume: Resume,
  sectionId: string,
  entryId: string,
): Resume {
  return mapSection(resume, sectionId, (section) => {
    const index = section.entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) return section;

    // Widened on the way out of the union: `section.entries` is one of four
    // array types, and `splice` cannot be called on that union with an entry
    // of the section's own type. Same assumption as `withEntries` below.
    const entries: ResumeEntry[] = section.entries.slice();
    entries.splice(index + 1, 0, createEntry(section.type));
    return withEntries(section, entries);
  });
}

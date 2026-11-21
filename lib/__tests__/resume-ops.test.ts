import { describe, expect, it } from "vitest";

import {
  addBullet,
  addEntry,
  addLink,
  addSection,
  bulletAt,
  createEntry,
  createSection,
  insertBullet,
  insertEntryAfter,
  mergeBulletBackward,
  moveBullet,
  moveEntry,
  moveItem,
  moveLink,
  moveSection,
  removeBullet,
  removeEntry,
  removeLink,
  removeSection,
  splitBullet,
  toggleEntryVisible,
  toggleSectionVisible,
  updateBullet,
  updateEntry,
  updateHeader,
  updateLink,
  updateSection,
  updateSettings,
} from "@/lib/resume-ops";
import type { EntrySection, Resume, SkillsSection } from "@/lib/schema";

/** A small but complete document: one "entries" section and one "skills". */
function fixture(): Resume {
  return {
    header: {
      name: "Ada Lovelace",
      location: "London",
      links: [
        { label: "LinkedIn", url: "https://example.com/ada" },
        { label: "GitHub", url: "https://example.com/gh" },
      ],
      phone: "+44 000",
      email: "ada@example.com",
    },
    sections: [
      {
        id: "s1",
        title: "Experience",
        visible: true,
        type: "entries",
        entries: [
          {
            id: "e1",
            visible: true,
            org: "Analytical Engine",
            location: "London",
            role: "Mathematician",
            period: "1842 - 1843",
            bullets: ["First bullet", "Second bullet", "Third bullet"],
          },
          {
            id: "e2",
            visible: true,
            org: "Notes",
            location: "",
            role: "",
            period: "",
            bullets: [],
          },
        ],
      },
      {
        id: "s2",
        title: "Skills",
        visible: true,
        type: "skills",
        entries: [{ id: "e3", visible: true, label: "Math", items: ["Logic"] }],
      },
    ],
    settings: { pageSize: "letter", dateSeparator: "hyphen" },
  };
}

/** Deep snapshot used to prove the input document was never mutated. */
function snapshot(resume: Resume): string {
  return JSON.stringify(resume);
}

function entriesSection(resume: Resume, id = "s1"): EntrySection {
  const section = resume.sections.find((candidate) => candidate.id === id);
  if (section?.type !== "entries") throw new Error(`${id} is not an entries section`);
  return section;
}

function skillsSection(resume: Resume, id = "s2"): SkillsSection {
  const section = resume.sections.find((candidate) => candidate.id === id);
  if (section?.type !== "skills") throw new Error(`${id} is not a skills section`);
  return section;
}

describe("moveItem", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item forward", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    expect(moveItem(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("moves the first item to the last position", () => {
    expect(moveItem(list, 0, 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("moves the last item to the first position", () => {
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the same array reference when the indexes match", () => {
    expect(moveItem(list, 2, 2)).toBe(list);
  });

  it("returns the same array reference when an index is out of range", () => {
    expect(moveItem(list, -1, 2)).toBe(list);
    expect(moveItem(list, 0, 4)).toBe(list);
    expect(moveItem(list, 4, 0)).toBe(list);
    expect(moveItem([], 0, 0)).toEqual([]);
  });

  /**
   * `splice(-1, 0, item)` inserts before the last element instead of failing,
   * so without the `to < 0` guard a cancelled drag silently reorders the list.
   */
  it("refuses a negative destination instead of counting from the end", () => {
    expect(moveItem(list, 2, -1)).toBe(list);
    expect(moveItem(list, 0, -4)).toBe(list);
    expect(moveItem(list, -1, -1)).toBe(list);
  });

  it("never mutates the input array", () => {
    moveItem(list, 0, 3);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
});

describe("createEntry", () => {
  it("builds an experience entry with empty fields", () => {
    const entry = createEntry("entries");
    expect(entry).toEqual({
      id: expect.any(String),
      visible: true,
      org: "",
      location: "",
      role: "",
      period: "",
      bullets: [],
    });
  });

  it("builds an achievement entry with empty fields", () => {
    expect(createEntry("achievements")).toEqual({
      id: expect.any(String),
      visible: true,
      title: "",
      location: "",
      description: "",
      year: "",
    });
  });

  it("builds a skills entry with empty fields", () => {
    expect(createEntry("skills")).toEqual({
      id: expect.any(String),
      visible: true,
      label: "",
      items: [],
    });
  });

  it("builds a certification entry with empty fields", () => {
    expect(createEntry("certifications")).toEqual({
      id: expect.any(String),
      visible: true,
      name: "",
      issuer: "",
      detail: "",
      date: "",
      linkLabel: "",
      url: "",
    });
  });

  it("gives every entry its own id", () => {
    expect(createEntry("skills").id).not.toBe(createEntry("skills").id);
  });
});

describe("createSection", () => {
  it("builds an empty, visible section of the requested type", () => {
    expect(createSection("certifications")).toEqual({
      id: expect.any(String),
      title: "",
      visible: true,
      type: "certifications",
      entries: [],
    });
  });
});

describe("updateSettings", () => {
  it("patches only the given settings", () => {
    const resume = fixture();
    const next = updateSettings(resume, { pageSize: "a4" });
    expect(next.settings).toEqual({ pageSize: "a4", dateSeparator: "hyphen" });
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    updateSettings(resume, { dateSeparator: "endash" });
    expect(snapshot(resume)).toBe(before);
  });
});

describe("updateHeader", () => {
  it("patches only the given fields and keeps the links", () => {
    const resume = fixture();
    const next = updateHeader(resume, { name: "A. Lovelace", email: "" });
    expect(next.header.name).toBe("A. Lovelace");
    expect(next.header.email).toBe("");
    expect(next.header.location).toBe("London");
    expect(next.header.links).toEqual(resume.header.links);
  });

  it("returns a new resume and a new header object", () => {
    const resume = fixture();
    const next = updateHeader(resume, { name: "X" });
    expect(next).not.toBe(resume);
    expect(next.header).not.toBe(resume.header);
    expect(next.sections).toBe(resume.sections);
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    updateHeader(resume, { name: "X" });
    expect(snapshot(resume)).toBe(before);
  });
});

describe("header links", () => {
  it("appends an empty link", () => {
    const next = addLink(fixture());
    expect(next.header.links).toHaveLength(3);
    expect(next.header.links[2]).toEqual({ label: "", url: "" });
  });

  it("patches one link by index", () => {
    const next = updateLink(fixture(), 1, { url: "https://example.com/new" });
    expect(next.header.links[1]).toEqual({
      label: "GitHub",
      url: "https://example.com/new",
    });
    expect(next.header.links[0].label).toBe("LinkedIn");
  });

  it("ignores a patch for an index that does not exist", () => {
    const resume = fixture();
    expect(updateLink(resume, 9, { label: "Nope" })).toBe(resume);
  });

  it("removes one link by index", () => {
    const next = removeLink(fixture(), 0);
    expect(next.header.links.map((link) => link.label)).toEqual(["GitHub"]);
  });

  it("ignores a removal for an index that does not exist", () => {
    const resume = fixture();
    expect(removeLink(resume, 5)).toBe(resume);
  });

  it("reorders links", () => {
    const next = moveLink(fixture(), 0, 1);
    expect(next.header.links.map((link) => link.label)).toEqual([
      "GitHub",
      "LinkedIn",
    ]);
  });

  it("returns the same resume when the reorder is a no-op", () => {
    const resume = fixture();
    expect(moveLink(resume, 1, 1)).toBe(resume);
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    addLink(resume);
    updateLink(resume, 0, { label: "X" });
    removeLink(resume, 0);
    moveLink(resume, 0, 1);
    expect(snapshot(resume)).toBe(before);
  });
});

describe("addSection", () => {
  it("appends an empty section of the requested type", () => {
    const next = addSection(fixture(), "achievements");
    expect(next.sections).toHaveLength(3);
    expect(next.sections[2]).toEqual({
      id: expect.any(String),
      title: "",
      visible: true,
      type: "achievements",
      entries: [],
    });
  });

  it("keeps the existing sections untouched", () => {
    const resume = fixture();
    const next = addSection(resume, "skills");
    expect(next.sections[0]).toBe(resume.sections[0]);
    expect(snapshot(resume)).toBe(snapshot(fixture()));
  });
});

describe("updateSection", () => {
  it("patches the title", () => {
    const next = updateSection(fixture(), "s1", { title: "Work" });
    expect(next.sections[0].title).toBe("Work");
    expect(next.sections[0].entries).toEqual(fixture().sections[0].entries);
  });

  it("patches the visibility", () => {
    expect(updateSection(fixture(), "s2", { visible: false }).sections[1].visible).toBe(
      false,
    );
  });

  it("returns the same resume for an unknown section id", () => {
    const resume = fixture();
    expect(updateSection(resume, "nope", { title: "X" })).toBe(resume);
  });

  it("keeps the other sections by reference", () => {
    const resume = fixture();
    const next = updateSection(resume, "s1", { title: "Work" });
    expect(next.sections[1]).toBe(resume.sections[1]);
    expect(next.sections[0]).not.toBe(resume.sections[0]);
  });
});

describe("toggleSectionVisible", () => {
  it("flips the flag", () => {
    const hidden = toggleSectionVisible(fixture(), "s1");
    expect(hidden.sections[0].visible).toBe(false);
    expect(toggleSectionVisible(hidden, "s1").sections[0].visible).toBe(true);
  });

  it("returns the same resume for an unknown section id", () => {
    const resume = fixture();
    expect(toggleSectionVisible(resume, "nope")).toBe(resume);
  });
});

describe("removeSection", () => {
  it("drops the section", () => {
    const next = removeSection(fixture(), "s1");
    expect(next.sections.map((section) => section.id)).toEqual(["s2"]);
  });

  it("returns the same resume for an unknown section id", () => {
    const resume = fixture();
    expect(removeSection(resume, "nope")).toBe(resume);
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    removeSection(resume, "s1");
    expect(snapshot(resume)).toBe(before);
  });
});

describe("moveSection", () => {
  it("reorders sections", () => {
    const next = moveSection(fixture(), 0, 1);
    expect(next.sections.map((section) => section.id)).toEqual(["s2", "s1"]);
  });

  it("returns the same resume when the indexes match", () => {
    const resume = fixture();
    expect(moveSection(resume, 1, 1)).toBe(resume);
  });

  it("returns the same resume when an index is out of range", () => {
    const resume = fixture();
    expect(moveSection(resume, 0, 2)).toBe(resume);
    expect(moveSection(resume, -1, 0)).toBe(resume);
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    moveSection(resume, 0, 1);
    expect(snapshot(resume)).toBe(before);
  });
});

describe("addEntry", () => {
  it("appends an entry shaped like its section type", () => {
    const next = addEntry(fixture(), "s1");
    const section = entriesSection(next);
    expect(section.entries).toHaveLength(3);
    expect(section.entries[2]).toEqual({
      id: expect.any(String),
      visible: true,
      org: "",
      location: "",
      role: "",
      period: "",
      bullets: [],
    });
  });

  it("appends a skills entry to a skills section", () => {
    const next = addEntry(fixture(), "s2");
    expect(skillsSection(next).entries[1]).toEqual({
      id: expect.any(String),
      visible: true,
      label: "",
      items: [],
    });
  });

  it("returns the same resume for an unknown section id", () => {
    const resume = fixture();
    expect(addEntry(resume, "nope")).toBe(resume);
  });
});

describe("updateEntry", () => {
  it("patches one field of one entry", () => {
    const next = updateEntry(fixture(), "s1", "e1", { role: "Analyst" });
    const [first, second] = entriesSection(next).entries;
    expect(first.role).toBe("Analyst");
    expect(first.org).toBe("Analytical Engine");
    expect(second.org).toBe("Notes");
  });

  it("patches array fields such as skills items", () => {
    const next = updateEntry(fixture(), "s2", "e3", { items: ["Logic", "Proofs"] });
    expect(skillsSection(next).entries[0].items).toEqual(["Logic", "Proofs"]);
  });

  it("returns the same resume for an unknown entry id", () => {
    const resume = fixture();
    expect(updateEntry(resume, "s1", "nope", { role: "X" })).toBe(resume);
  });

  it("returns the same resume for an unknown section id", () => {
    const resume = fixture();
    expect(updateEntry(resume, "nope", "e1", { role: "X" })).toBe(resume);
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    updateEntry(resume, "s1", "e1", { role: "X" });
    expect(snapshot(resume)).toBe(before);
  });
});

describe("toggleEntryVisible", () => {
  it("flips the flag on one entry only", () => {
    const next = toggleEntryVisible(fixture(), "s1", "e1");
    const entries = entriesSection(next).entries;
    expect(entries[0].visible).toBe(false);
    expect(entries[1].visible).toBe(true);
  });

  it("returns the same resume for an unknown entry id", () => {
    const resume = fixture();
    expect(toggleEntryVisible(resume, "s1", "nope")).toBe(resume);
  });
});

describe("removeEntry", () => {
  it("drops the entry", () => {
    const next = removeEntry(fixture(), "s1", "e1");
    expect(entriesSection(next).entries.map((entry) => entry.id)).toEqual(["e2"]);
  });

  it("returns the same resume for an unknown entry id", () => {
    const resume = fixture();
    expect(removeEntry(resume, "s1", "nope")).toBe(resume);
  });
});

describe("moveEntry", () => {
  it("reorders entries inside one section", () => {
    const next = moveEntry(fixture(), "s1", 0, 1);
    expect(entriesSection(next).entries.map((entry) => entry.id)).toEqual([
      "e2",
      "e1",
    ]);
  });

  it("returns the same resume when the indexes match", () => {
    const resume = fixture();
    expect(moveEntry(resume, "s1", 0, 0)).toBe(resume);
  });

  it("returns the same resume when an index is out of range", () => {
    const resume = fixture();
    expect(moveEntry(resume, "s1", 0, 7)).toBe(resume);
  });

  it("returns the same resume for an unknown section id", () => {
    const resume = fixture();
    expect(moveEntry(resume, "nope", 0, 1)).toBe(resume);
  });
});

describe("bullets", () => {
  it("appends an empty bullet", () => {
    const next = addBullet(fixture(), "s1", "e1");
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bullet",
      "Second bullet",
      "Third bullet",
      "",
    ]);
  });

  it("appends the first bullet to an entry that has none", () => {
    const next = addBullet(fixture(), "s1", "e2");
    expect(entriesSection(next).entries[1].bullets).toEqual([""]);
  });

  it("replaces one bullet by index", () => {
    const next = updateBullet(fixture(), "s1", "e1", 1, "Rewritten");
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bullet",
      "Rewritten",
      "Third bullet",
    ]);
  });

  it("ignores a bullet update for an index that does not exist", () => {
    const resume = fixture();
    expect(updateBullet(resume, "s1", "e1", 9, "Nope")).toBe(resume);
  });

  it("removes one bullet by index", () => {
    const next = removeBullet(fixture(), "s1", "e1", 0);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "Second bullet",
      "Third bullet",
    ]);
  });

  it("ignores a bullet removal for an index that does not exist", () => {
    const resume = fixture();
    expect(removeBullet(resume, "s1", "e1", -1)).toBe(resume);
  });

  it("reorders bullets", () => {
    const next = moveBullet(fixture(), "s1", "e1", 2, 0);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "Third bullet",
      "First bullet",
      "Second bullet",
    ]);
  });

  it("returns the same resume when the bullet reorder is a no-op", () => {
    const resume = fixture();
    expect(moveBullet(resume, "s1", "e1", 1, 1)).toBe(resume);
    expect(moveBullet(resume, "s1", "e1", 0, 3)).toBe(resume);
  });

  it("leaves sections that have no bullets alone", () => {
    const resume = fixture();
    expect(addBullet(resume, "s2", "e3")).toBe(resume);
    expect(updateBullet(resume, "s2", "e3", 0, "X")).toBe(resume);
    expect(removeBullet(resume, "s2", "e3", 0)).toBe(resume);
    expect(moveBullet(resume, "s2", "e3", 0, 1)).toBe(resume);
  });

  it("does not mutate the input", () => {
    const resume = fixture();
    const before = snapshot(resume);
    addBullet(resume, "s1", "e1");
    updateBullet(resume, "s1", "e1", 0, "X");
    removeBullet(resume, "s1", "e1", 0);
    moveBullet(resume, "s1", "e1", 0, 2);
    expect(snapshot(resume)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* Inline editing on the page                                                 */
/* -------------------------------------------------------------------------- */

/**
 * These back the keystrokes that change structure rather than one field, so the
 * cases that matter are the boundaries a caret actually reaches: the very start
 * of a bullet, the very end, and the first bullet of a list, which has nothing
 * above it to merge into.
 */
describe("bulletAt", () => {
  it("reads a bullet by index", () => {
    expect(bulletAt(fixture(), "s1", "e1", 1)).toBe("Second bullet");
  });

  it("returns null outside the list", () => {
    const resume = fixture();
    expect(bulletAt(resume, "s1", "e1", 3)).toBeNull();
    expect(bulletAt(resume, "s1", "e1", -1)).toBeNull();
  });

  it("returns null for an unknown path or a section without bullets", () => {
    const resume = fixture();
    expect(bulletAt(resume, "nope", "e1", 0)).toBeNull();
    expect(bulletAt(resume, "s1", "nope", 0)).toBeNull();
    expect(bulletAt(resume, "s2", "e3", 0)).toBeNull();
  });

  it("distinguishes an empty bullet from a missing one", () => {
    const resume = updateBullet(fixture(), "s1", "e1", 0, "");
    expect(bulletAt(resume, "s1", "e1", 0)).toBe("");
  });
});

describe("insertBullet", () => {
  it("inserts at an index, pushing the rest down", () => {
    const next = insertBullet(fixture(), "s1", "e1", 1, "Wedged");
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bullet",
      "Wedged",
      "Second bullet",
      "Third bullet",
    ]);
  });

  it("appends when the index is the length of the list", () => {
    const next = insertBullet(fixture(), "s1", "e1", 3, "Last");
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bullet",
      "Second bullet",
      "Third bullet",
      "Last",
    ]);
  });

  it("defaults to an empty bullet", () => {
    const next = insertBullet(fixture(), "s1", "e1", 0);
    expect(entriesSection(next).entries[0].bullets[0]).toBe("");
  });

  it("returns the same resume past the end of the list", () => {
    const resume = fixture();
    expect(insertBullet(resume, "s1", "e1", 4, "X")).toBe(resume);
    expect(insertBullet(resume, "s1", "e1", -1, "X")).toBe(resume);
  });
});

describe("splitBullet", () => {
  it("breaks one bullet in two at the caret", () => {
    const next = splitBullet(fixture(), "s1", "e1", 0, 5);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First",
      " bullet",
      "Second bullet",
      "Third bullet",
    ]);
  });

  it("opens an empty bullet below when the caret is at the end", () => {
    const next = splitBullet(fixture(), "s1", "e1", 2, "Third bullet".length);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bullet",
      "Second bullet",
      "Third bullet",
      "",
    ]);
  });

  it("pushes the whole text down when the caret is at the start", () => {
    const next = splitBullet(fixture(), "s1", "e1", 0, 0);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "",
      "First bullet",
      "Second bullet",
      "Third bullet",
    ]);
  });

  it("clamps a caret the browser reports outside the text", () => {
    const high = splitBullet(fixture(), "s1", "e1", 0, 999);
    expect(entriesSection(high).entries[0].bullets.slice(0, 2)).toEqual([
      "First bullet",
      "",
    ]);

    const low = splitBullet(fixture(), "s1", "e1", 0, -5);
    expect(entriesSection(low).entries[0].bullets.slice(0, 2)).toEqual([
      "",
      "First bullet",
    ]);
  });

  it("returns the same resume for an index that does not exist", () => {
    const resume = fixture();
    expect(splitBullet(resume, "s1", "e1", 9, 0)).toBe(resume);
    expect(splitBullet(resume, "s1", "e2", 0, 0)).toBe(resume);
  });
});

describe("mergeBulletBackward", () => {
  it("joins a bullet onto the end of the one above", () => {
    const next = mergeBulletBackward(fixture(), "s1", "e1", 1);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bulletSecond bullet",
      "Third bullet",
    ]);
  });

  it("deletes an empty bullet, leaving the one above untouched", () => {
    const resume = updateBullet(fixture(), "s1", "e1", 1, "");
    const next = mergeBulletBackward(resume, "s1", "e1", 1);
    expect(entriesSection(next).entries[0].bullets).toEqual([
      "First bullet",
      "Third bullet",
    ]);
  });

  it("is a no-op on the first bullet, which has nothing above it", () => {
    const resume = fixture();
    expect(mergeBulletBackward(resume, "s1", "e1", 0)).toBe(resume);
  });

  it("returns the same resume for an index that does not exist", () => {
    const resume = fixture();
    expect(mergeBulletBackward(resume, "s1", "e1", 3)).toBe(resume);
  });

  it("leaves the join offset readable from the document before the merge", () => {
    // What the caret lands on after a merge is the length of the bullet above,
    // which the caller reads before applying the op.
    const resume = fixture();
    const join = bulletAt(resume, "s1", "e1", 0)?.length;
    const next = mergeBulletBackward(resume, "s1", "e1", 1);
    expect(entriesSection(next).entries[0].bullets[0].slice(0, join)).toBe(
      "First bullet",
    );
  });
});

describe("insertEntryAfter", () => {
  it("puts a blank entry directly below the one named", () => {
    const next = insertEntryAfter(fixture(), "s1", "e1");
    const entries = entriesSection(next).entries;
    expect(entries).toHaveLength(3);
    expect(entries[0].id).toBe("e1");
    expect(entries[2].id).toBe("e2");
    expect(entries[1].org).toBe("");
    expect(entries[1].visible).toBe(true);
  });

  it("creates an entry of the section's own type", () => {
    const next = insertEntryAfter(fixture(), "s2", "e3");
    const entries = skillsSection(next).entries;
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ label: "", items: [] });
  });

  it("returns the same resume for an unknown entry or section", () => {
    const resume = fixture();
    expect(insertEntryAfter(resume, "s1", "nope")).toBe(resume);
    expect(insertEntryAfter(resume, "nope", "e1")).toBe(resume);
  });
});

describe("the inline editing operations do not mutate the input", () => {
  it("leaves the document it was given untouched", () => {
    const resume = fixture();
    const before = snapshot(resume);
    insertBullet(resume, "s1", "e1", 1, "X");
    splitBullet(resume, "s1", "e1", 0, 3);
    mergeBulletBackward(resume, "s1", "e1", 2);
    insertEntryAfter(resume, "s1", "e1");
    bulletAt(resume, "s1", "e1", 0);
    expect(snapshot(resume)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* The documented no-op contract                                              */
/* -------------------------------------------------------------------------- */

/**
 * The module promises that an operation that changes nothing returns the *same*
 * resume. The editor relies on it for more than a skipped re-render: a patch
 * that returns a new object marks the document dirty and fires a PUT, so
 * re-selecting the page size already in use would write the file.
 */
describe("a patch that changes nothing", () => {
  it("returns the same resume from updateSettings", () => {
    const resume = fixture();
    expect(updateSettings(resume, { pageSize: "letter" })).toBe(resume);
    expect(updateSettings(resume, { dateSeparator: "hyphen" })).toBe(resume);
    expect(
      updateSettings(resume, { pageSize: "letter", dateSeparator: "hyphen" }),
    ).toBe(resume);
    expect(updateSettings(resume, {})).toBe(resume);
  });

  it("returns the same resume from updateHeader", () => {
    const resume = fixture();
    expect(updateHeader(resume, { name: "Ada Lovelace" })).toBe(resume);
    expect(
      updateHeader(resume, { name: "Ada Lovelace", location: "London" }),
    ).toBe(resume);
    expect(updateHeader(resume, {})).toBe(resume);
  });

  it("returns the same resume from updateSection", () => {
    const resume = fixture();
    expect(updateSection(resume, "s1", { title: "Experience" })).toBe(resume);
    expect(updateSection(resume, "s1", { visible: true })).toBe(resume);
    expect(
      updateSection(resume, "s1", { title: "Experience", visible: true }),
    ).toBe(resume);
    expect(updateSection(resume, "s1", {})).toBe(resume);
  });

  it("returns the same resume from updateEntry and updateLink", () => {
    const resume = fixture();
    expect(updateEntry(resume, "s1", "e1", { org: "Analytical Engine" })).toBe(
      resume,
    );
    expect(updateLink(resume, 0, { label: "LinkedIn" })).toBe(resume);
  });

  it("still applies a patch where one of several fields differs", () => {
    const resume = fixture();
    const next = updateSettings(resume, {
      pageSize: "letter",
      dateSeparator: "endash",
    });
    expect(next).not.toBe(resume);
    expect(next.settings).toEqual({
      pageSize: "letter",
      dateSeparator: "endash",
    });
  });

  it("still applies a patch that clears a field to the empty string", () => {
    const resume = fixture();
    const next = updateHeader(resume, { phone: "" });
    expect(next).not.toBe(resume);
    expect(next.header.phone).toBe("");
  });

  /**
   * A toggle has no same-value case: `visible` always ends up different, so a
   * new object here is the correct answer, not a missed no-op.
   */
  it("does not apply to a toggle, which always changes the value", () => {
    const resume = fixture();
    expect(toggleSectionVisible(resume, "s1")).not.toBe(resume);
    expect(toggleEntryVisible(resume, "s1", "e1")).not.toBe(resume);
  });
});

describe("non-mutation, across every section and entry operation", () => {
  it("leaves the input document untouched", () => {
    const resume = fixture();
    const before = snapshot(resume);

    updateSection(resume, "s1", { title: "Work", visible: false });
    toggleSectionVisible(resume, "s1");
    addSection(resume, "certifications");
    moveSection(resume, 0, 1);
    removeSection(resume, "s1");

    addEntry(resume, "s1");
    updateEntry(resume, "s1", "e1", { org: "Changed" });
    toggleEntryVisible(resume, "s1", "e1");
    moveEntry(resume, "s1", 0, 1);
    removeEntry(resume, "s1", "e1");

    expect(snapshot(resume)).toBe(before);
  });

  it("leaves the arrays it did not touch by reference", () => {
    const resume = fixture();

    const moved = moveEntry(resume, "s1", 0, 1);
    expect(moved.sections[1]).toBe(resume.sections[1]);
    expect(moved.header).toBe(resume.header);

    const removed = removeEntry(resume, "s1", "e1");
    expect(removed.sections[1]).toBe(resume.sections[1]);

    const added = addEntry(resume, "s1");
    expect(added.sections[1]).toBe(resume.sections[1]);

    const toggled = toggleSectionVisible(resume, "s1");
    expect(toggled.sections[1]).toBe(resume.sections[1]);
    expect(entriesSection(toggled).entries).toBe(entriesSection(resume).entries);
  });

  it("does not share the entry array it rebuilt with the input", () => {
    const resume = fixture();
    const next = addEntry(resume, "s1");
    expect(entriesSection(next).entries).not.toBe(
      entriesSection(resume).entries,
    );
    expect(entriesSection(resume).entries).toHaveLength(2);
    expect(entriesSection(next).entries).toHaveLength(3);
  });
});

import type { SectionType } from "@/lib/schema";

/** The section types, in the order the "Add section" picker offers them. */
export const SECTION_TYPES = [
  "entries",
  "achievements",
  "skills",
  "certifications",
] as const satisfies readonly SectionType[];

/** What each type is called in the picker. */
export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  entries: "Entries (experience, education)",
  achievements: "Achievements",
  skills: "Skills",
  certifications: "Certifications",
};

/** What one item of each type is called in buttons and labels. */
export const ENTRY_NOUNS: Record<
  SectionType,
  { singular: string; plural: string }
> = {
  entries: { singular: "entry", plural: "entries" },
  achievements: { singular: "achievement", plural: "achievements" },
  skills: { singular: "skill line", plural: "skill lines" },
  certifications: { singular: "certification", plural: "certifications" },
};

/** Narrows a <select> value back to a section type, with no cast. */
export function toSectionType(value: string): SectionType | null {
  return SECTION_TYPES.find((type) => type === value) ?? null;
}

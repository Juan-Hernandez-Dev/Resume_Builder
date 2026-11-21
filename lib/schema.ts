import { z } from "zod";

/**
 * Single source of truth for the resume document. Every optional field has a
 * default so that a partially written JSON file still parses, which keeps the
 * editor forgiving while the user types.
 */

const id = z.string().min(1);
const text = z.string().default("");

export const linkSchema = z.object({
  label: text,
  // Kept as a plain string on purpose: the editor must accept half-typed URLs.
  url: text,
});

export const headerSchema = z.object({
  name: text,
  location: text,
  links: z.array(linkSchema).default([]),
  phone: text,
  email: text,
});

/** Fields shared by every entry, whatever the section type is. */
const entryBase = {
  id,
  visible: z.boolean().default(true),
};

export const experienceEntrySchema = z.object({
  ...entryBase,
  org: text,
  location: text,
  role: text,
  period: text,
  bullets: z.array(z.string()).default([]),
});

export const achievementEntrySchema = z.object({
  ...entryBase,
  title: text,
  location: text,
  description: text,
  year: text,
});

export const skillsEntrySchema = z.object({
  ...entryBase,
  label: text,
  items: z.array(z.string()).default([]),
});

export const certificationEntrySchema = z.object({
  ...entryBase,
  name: text,
  issuer: text,
  detail: text,
  date: text,
  linkLabel: text,
  // Same reason as linkSchema.url above: not `.url()`, because autosave
  // validates on every keystroke and would reject a half-typed address.
  url: text,
});

/** Fields shared by every section, whatever the section type is. */
const sectionBase = {
  id,
  title: text,
  visible: z.boolean().default(true),
};

export const entriesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("entries"),
  entries: z.array(experienceEntrySchema).default([]),
});

export const achievementsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("achievements"),
  entries: z.array(achievementEntrySchema).default([]),
});

export const skillsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("skills"),
  entries: z.array(skillsEntrySchema).default([]),
});

export const certificationsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("certifications"),
  entries: z.array(certificationEntrySchema).default([]),
});

export const sectionSchema = z.discriminatedUnion("type", [
  entriesSectionSchema,
  achievementsSectionSchema,
  skillsSectionSchema,
  certificationsSectionSchema,
]);

export const pageSizeSchema = z.enum(["letter", "a4"]);
export const dateSeparatorSchema = z.enum(["hyphen", "endash"]);

export const DEFAULT_SETTINGS = {
  pageSize: "letter",
  dateSeparator: "hyphen",
} as const;

export const settingsSchema = z
  .object({
    pageSize: pageSizeSchema.default(DEFAULT_SETTINGS.pageSize),
    dateSeparator: dateSeparatorSchema.default(DEFAULT_SETTINGS.dateSeparator),
  })
  .default(DEFAULT_SETTINGS);

export const resumeSchema = z.object({
  header: headerSchema,
  sections: z.array(sectionSchema),
  settings: settingsSchema,
});

export type ResumeLink = z.output<typeof linkSchema>;
export type ResumeHeader = z.output<typeof headerSchema>;

export type ExperienceEntry = z.output<typeof experienceEntrySchema>;
export type AchievementEntry = z.output<typeof achievementEntrySchema>;
export type SkillsEntry = z.output<typeof skillsEntrySchema>;
export type CertificationEntry = z.output<typeof certificationEntrySchema>;
export type ResumeEntry =
  | ExperienceEntry
  | AchievementEntry
  | SkillsEntry
  | CertificationEntry;

export type EntrySection = z.output<typeof entriesSectionSchema>;
export type AchievementsSection = z.output<typeof achievementsSectionSchema>;
export type SkillsSection = z.output<typeof skillsSectionSchema>;
export type CertificationsSection = z.output<typeof certificationsSectionSchema>;
export type Section = z.output<typeof sectionSchema>;
export type SectionType = Section["type"];

export type PageSize = z.output<typeof pageSizeSchema>;
export type DateSeparator = z.output<typeof dateSeparatorSchema>;
export type ResumeSettings = z.output<typeof settingsSchema>;
export type Resume = z.output<typeof resumeSchema>;

/** Every id in the document is an opaque string. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function emptyResume(): Resume {
  return {
    header: { name: "", location: "", links: [], phone: "", email: "" },
    sections: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

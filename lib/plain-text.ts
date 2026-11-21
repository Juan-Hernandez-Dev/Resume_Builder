import { formatPeriod } from "./date-separator";
import type {
  AchievementEntry,
  CertificationEntry,
  ExperienceEntry,
  Resume,
  ResumeHeader,
  ResumeSettings,
  Section,
  SkillsEntry,
} from "./schema";

/**
 * Renders the resume the way an ATS parser reads it: plain text, no markup,
 * reading order identical to the DOM order of the rendered page. Hidden
 * sections and hidden entries are left out, exactly as they are on the page.
 */
export function toPlainText(resume: Resume): string {
  const groups: string[][] = [headerLines(resume.header)];

  for (const section of resume.sections) {
    if (!section.visible) continue;
    groups.push(...sectionGroups(section, resume.settings));
  }

  return groups
    .map((lines) => lines.filter((line) => line !== "").join("\n"))
    .filter((block) => block !== "")
    .join("\n\n");
}

/** Joins the parts of one visual row, dropping the ones the user left empty. */
function row(parts: readonly string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(" | ");
}

function labelled(label: string, value: string): string {
  const cleanLabel = label.trim();
  const cleanValue = value.trim();
  if (cleanLabel && cleanValue) return `${cleanLabel}: ${cleanValue}`;
  return cleanValue || cleanLabel;
}

function headerLines(header: ResumeHeader): string[] {
  const contact = row([
    ...header.links.map((link) => labelled(link.label, link.url)),
    header.phone,
    header.email,
  ]);

  return [header.name.trim(), header.location.trim(), contact];
}

/**
 * One group per visual block, so the blank lines in the output land where the
 * rendered page has vertical gaps. The section title starts the first group.
 * Skills render as contiguous lines, so the whole section is a single group.
 */
function sectionGroups(section: Section, settings: ResumeSettings): string[][] {
  const title = section.title.trim();

  switch (section.type) {
    case "skills":
      return [
        [title, ...visibleEntries(section.entries).flatMap(skillsLines)],
      ];
    case "entries":
      return withTitle(
        title,
        visibleEntries(section.entries).map((entry) =>
          experienceLines(entry, settings),
        ),
      );
    case "achievements":
      return withTitle(
        title,
        visibleEntries(section.entries).map(achievementLines),
      );
    case "certifications":
      return withTitle(
        title,
        visibleEntries(section.entries).map(certificationLines),
      );
  }
}

function visibleEntries<T extends { visible: boolean }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.visible);
}

/** The title opens the first entry block; later blocks stand on their own. */
function withTitle(title: string, blocks: string[][]): string[][] {
  const [first, ...rest] = blocks;
  return [[title, ...(first ?? [])], ...rest];
}

function experienceLines(
  entry: ExperienceEntry,
  settings: ResumeSettings,
): string[] {
  return [
    row([entry.org, entry.location]),
    row([entry.role, formatPeriod(entry.period, settings.dateSeparator)]),
    ...entry.bullets
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .map((bullet) => `- ${bullet}`),
  ];
}

function achievementLines(entry: AchievementEntry): string[] {
  return [
    row([entry.title, entry.location]),
    row([entry.description, entry.year]),
  ];
}

function skillsLines(entry: SkillsEntry): string[] {
  const items = entry.items.map((item) => item.trim()).filter(Boolean);
  return [labelled(entry.label, items.join(", "))];
}

function certificationLines(entry: CertificationEntry): string[] {
  return [
    row([entry.name, entry.issuer]),
    row([entry.detail, entry.date]),
    labelled(entry.linkLabel, entry.url),
  ];
}

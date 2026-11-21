import type { DateSeparator } from "./schema";

/** The literal glue inserted between the two ends of a date range. */
export const DATE_SEPARATORS: Record<DateSeparator, string> = {
  hyphen: " - ",
  endash: " – ",
};

/** A separator that already has whitespace on at least one side. */
const SPACED_SEPARATOR = /\s*[-–]\s+|\s+[-–]\s*/g;

/**
 * A tight range separator, as in "2024-2025" or "2023-Present".
 *
 * Deliberately narrow. The only thing a hyphen between two dates and a hyphen
 * inside a date have in common is the character, so this matches exactly the
 * two shapes that are unambiguously a range:
 *
 * - four digits, the separator, four digits  ("2024-2025")
 * - four digits, the separator, a word       ("2023-Present")
 *
 * Everything else keeps its hyphens: "01-2020" (month and year), "2020-01-15"
 * (an ISO date), "Part-time" (a compound word), and "2024-25" (a two-digit
 * year abbreviation, which is ambiguous enough that rewriting it would be a
 * guess). The digit boundaries on both sides stop a longer run of digits, such
 * as "12345-6789", from being read as two years.
 */
const TIGHT_RANGE = /(?<!\d)(\d{4})[-–](\d{4}(?!\d)|[A-Za-z]+)/g;

/**
 * Normalizes every date range inside `period` to the separator the resume
 * settings ask for, so switching the setting rewrites existing values instead
 * of only affecting newly typed ones.
 */
export function formatPeriod(period: string, separator: DateSeparator): string {
  const glue = DATE_SEPARATORS[separator];
  return period
    .replace(SPACED_SEPARATOR, glue)
    .replace(TIGHT_RANGE, (_match, from: string, to: string) =>
      `${from}${glue}${to}`,
    )
    .trim();
}

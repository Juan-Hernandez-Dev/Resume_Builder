/**
 * Variant names become file names under /data, so they are deliberately
 * restricted to a tiny character set. Validation and sanitization live in this
 * pure module so they can be unit tested and reused on the client.
 */

export const VARIANT_NAME_PATTERN = /^[a-z0-9-_]+$/;

/** Human readable description of the allowed characters, reused in errors. */
export const VARIANT_NAME_RULE = "only the characters [a-z0-9-_]";

export class InvalidVariantNameError extends Error {
  constructor(name: unknown) {
    super(
      `Invalid variant name ${JSON.stringify(name)}: a variant name must use ${VARIANT_NAME_RULE} and may not be empty.`,
    );
    this.name = "InvalidVariantNameError";
  }
}

export function isValidVariantName(name: unknown): name is string {
  return typeof name === "string" && VARIANT_NAME_PATTERN.test(name);
}

export function assertValidVariantName(name: unknown): string {
  if (!isValidVariantName(name)) {
    throw new InvalidVariantNameError(name);
  }
  return name;
}

const JSON_EXTENSION = /\.json$/i;
const DIACRITICS = /[\u0300-\u036f]/g;
const UNSUPPORTED = /[^a-z0-9-_]+/g;
const SEPARATOR_RUN = /[-_]{2,}/g;
const EDGE_SEPARATORS = /^[-_]+|[-_]+$/g;

/**
 * Turns free-form user input (for example a "Duplicate variant" prompt) into a
 * name that satisfies {@link isValidVariantName}. Returns an empty string when
 * nothing usable is left, which callers must treat as invalid input.
 */
export function sanitizeVariantName(input: string): string {
  return input
    .replace(JSON_EXTENSION, "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(UNSUPPORTED, "-")
    .replace(SEPARATOR_RUN, "-")
    .replace(EDGE_SEPARATORS, "");
}

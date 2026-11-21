import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { createFileExclusive, writeFileAtomic } from "./atomic-write";
import { emptyResume, resumeSchema, type Resume } from "./schema";
import { assertValidVariantName, isValidVariantName } from "./variant-name";

export {
  InvalidVariantNameError,
  isValidVariantName,
  sanitizeVariantName,
} from "./variant-name";

/**
 * Every resume variant is a JSON file inside this directory. Nothing outside it
 * is ever read or written: names are validated against a strict pattern and the
 * resolved path is checked again before any filesystem call.
 *
 * Only `*.json` is a variant, so the `.bak` and `.tmp` files that atomic writes
 * put next to a variant are never mistaken for one.
 */
export const DATA_DIR = path.resolve(process.cwd(), "data");

export class VariantNotFoundError extends Error {
  constructor(readonly variant: string) {
    super(`Variant "${variant}" does not exist.`);
    this.name = "VariantNotFoundError";
  }
}

export class VariantExistsError extends Error {
  constructor(readonly variant: string) {
    super(`Variant "${variant}" already exists.`);
    this.name = "VariantExistsError";
  }
}

export class InvalidVariantDataError extends Error {
  constructor(
    readonly variant: string,
    readonly issues: readonly { path: string; message: string }[],
  ) {
    super(`Variant "${variant}" does not match the resume schema.`);
    this.name = "InvalidVariantDataError";
  }
}

export class VariantPathError extends Error {
  constructor(readonly variant: string) {
    super(`Variant "${variant}" resolves outside the data directory.`);
    this.name = "VariantPathError";
  }
}

/** Resolves a variant name to its file path, refusing to escape DATA_DIR. */
function variantPath(name: string): string {
  const safeName = assertValidVariantName(name);
  const resolved = path.resolve(DATA_DIR, `${safeName}.json`);
  if (path.dirname(resolved) !== DATA_DIR) {
    throw new VariantPathError(name);
  }
  return resolved;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "ENOENT"
  );
}

export async function listVariants(): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(DATA_DIR);
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }

  return names
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .filter(isValidVariantName)
    .sort((a, b) => a.localeCompare(b));
}

export async function variantExists(name: string): Promise<boolean> {
  try {
    await fs.access(variantPath(name));
    return true;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

export async function readVariant(name: string): Promise<Resume> {
  const file = variantPath(name);

  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if (isMissingFile(error)) throw new VariantNotFoundError(name);
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new InvalidVariantDataError(name, [
      { path: "", message: `Malformed JSON: ${(error as Error).message}` },
    ]);
  }

  const result = resumeSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidVariantDataError(name, flattenIssues(result.error.issues));
  }
  return result.data;
}

/** The on-disk form: pretty-printed with two spaces and a trailing newline. */
function serialize(resume: Resume): string {
  return `${JSON.stringify(resume, null, 2)}\n`;
}

/**
 * Overwrites the variant file. The write is atomic and keeps a rolling `.bak`
 * of the previous content (see lib/atomic-write.ts), because this is the call
 * autosave makes on every edit burst and a torn write here would destroy the
 * only copy of the user's resume.
 */
export async function writeVariant(
  name: string,
  resume: Resume,
): Promise<Resume> {
  const file = variantPath(name);
  const parsed = resumeSchema.parse(resume);

  await fs.mkdir(DATA_DIR, { recursive: true });
  await writeFileAtomic(file, serialize(parsed));
  return parsed;
}

/**
 * Creates a variant that does not exist yet. Unlike {@link writeVariant} this
 * refuses to replace an existing file, and the refusal is decided by the
 * filesystem rather than by a separate existence check, so two callers racing
 * cannot both win.
 */
export async function createVariant(
  name: string,
  resume: Resume,
): Promise<Resume> {
  const file = variantPath(name);
  const parsed = resumeSchema.parse(resume);

  await fs.mkdir(DATA_DIR, { recursive: true });
  if (!(await createFileExclusive(file, serialize(parsed)))) {
    throw new VariantExistsError(name);
  }
  return parsed;
}

export async function duplicateVariant(
  from: string,
  to: string,
): Promise<Resume> {
  const source = await readVariant(from);
  return createVariant(to, source);
}

/**
 * Guarantees the editor has a variant file to save into, and returns the
 * variant list to use.
 *
 * On a fresh clone `/data` is missing or empty: without this the editor would
 * open on a blank document whose every save failed with a 404, because `PUT`
 * deliberately refuses to create files. Seeding one empty variant is the whole
 * bootstrap. An existing variant is never touched, and the seed is an
 * exclusive create, so a file that appears in between is kept as it is.
 */
export async function ensureFirstVariant(name: string): Promise<string[]> {
  const existing = await listVariants();
  if (existing.length > 0) return existing;

  try {
    await createVariant(name, emptyResume());
  } catch (error) {
    // Someone else got there first: that file is the first variant.
    if (!(error instanceof VariantExistsError)) throw error;
  }
  return [name];
}

function flattenIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): { path: string; message: string }[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

import { resumeSchema, type Resume } from "../schema";
import { assertValidVariantName } from "../variant-name";

import {
  InvalidVariantDataError,
  VariantExistsError,
  VariantNotFoundError,
  flattenIssues,
} from "./errors";
import type { ResumeRepository } from "./port";

/**
 * Variants in a Map, gone when the page closes. Used by tests, and by the web
 * build as a last resort when the browser has no usable IndexedDB, so the
 * editor still works for the length of the visit.
 *
 * `initial` is taken as it is, unvalidated, so a test can seed a document the
 * schema rejects and see it reported the way stored data would be.
 */
export function createMemoryRepository(
  initial: Record<string, unknown> = {},
): ResumeRepository {
  const store = new Map<string, unknown>(
    Object.entries(initial).map(([name, resume]) => [
      assertValidVariantName(name),
      structuredClone(resume),
    ]),
  );

  function load(name: string): Resume {
    if (!store.has(name)) throw new VariantNotFoundError(name);
    return validated(name, store.get(name));
  }

  function save(name: string, resume: Resume): Resume {
    const parsed = validated(name, resume);
    store.set(name, structuredClone(parsed));
    return parsed;
  }

  return {
    async list() {
      return [...store.keys()].sort((a, b) => a.localeCompare(b));
    },

    async read(name) {
      return load(assertValidVariantName(name));
    },

    async write(name, resume) {
      assertValidVariantName(name);
      if (!store.has(name)) throw new VariantNotFoundError(name);
      return save(name, resume);
    },

    async create(name, resume) {
      assertValidVariantName(name);
      if (store.has(name)) throw new VariantExistsError(name);
      return save(name, resume);
    },

    async duplicate(from, to) {
      assertValidVariantName(from);
      assertValidVariantName(to);
      const source = load(from);
      if (store.has(to)) throw new VariantExistsError(to);
      return save(to, source);
    },
  };
}

/** A fresh, schema-checked copy: zod builds new objects as it parses. */
function validated(name: string, value: unknown): Resume {
  const result = resumeSchema.safeParse(structuredClone(value));
  if (!result.success) {
    throw new InvalidVariantDataError(name, flattenIssues(result.error.issues));
  }
  return result.data;
}

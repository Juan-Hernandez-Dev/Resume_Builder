import type { Resume } from "../schema";

/**
 * Where resume variants live. The editor and the start-up use cases only ever
 * talk to this interface, so the same UI runs on files under data/ (local
 * mode, through the API routes) and on IndexedDB (the web build), and tests
 * can run it on memory.
 *
 * Every adapter keeps the same contract, pinned by
 * lib/storage/__tests__/repository.contract.ts:
 *
 * - Names are checked with lib/variant-name.ts first; a bad one rejects with
 *   InvalidVariantNameError before storage is touched.
 * - A document is validated against the resume schema on the way in and on
 *   the way out; a stored one that no longer matches is InvalidVariantDataError.
 * - Returned documents are copies: changing one never changes what is stored,
 *   and changing a document after handing it in does not either.
 * - The storage itself failing is a StorageError, never a raw platform error.
 */
export interface ResumeRepository {
  /** Every variant name, sorted. */
  list(): Promise<string[]>;
  /** The variant, or VariantNotFoundError. */
  read(name: string): Promise<Resume>;
  /**
   * Replaces an existing variant. Never creates one: a missing variant is
   * VariantNotFoundError, so autosave cannot resurrect a variant under a name
   * nobody chose.
   */
  write(name: string, resume: Resume): Promise<Resume>;
  /** Creates a variant that does not exist yet, else VariantExistsError. */
  create(name: string, resume: Resume): Promise<Resume>;
  /** Copies `from` into a new variant `to`, with the errors of read and create. */
  duplicate(from: string, to: string): Promise<Resume>;
}

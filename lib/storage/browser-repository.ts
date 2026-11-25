import type { Resume } from "../schema";
import { assertValidVariantName, isValidVariantName } from "../variant-name";

import {
  StorageError,
  VariantExistsError,
  VariantNotFoundError,
  isRepositoryError,
} from "./errors";
import type { ResumeRepository } from "./port";
import { validatedResume } from "./validate";

/**
 * Variants in this browser's IndexedDB: the storage of the web build, where
 * there is no server to write files and every visitor's resumes stay on their
 * own machine.
 *
 * One object store, `variants`, keyed by name, holding
 * `{ name, resume, updatedAt }`. Each operation is one transaction, so a
 * duplicate cannot copy into a name that appeared halfway through, and a
 * create is refused by the store's own key constraint rather than by a check
 * that a second tab could race.
 *
 * Nothing is opened when the module loads or when the repository is made: the
 * database is opened by the first call, so the static build can render this
 * module on the server, and a browser that refuses IndexedDB reports it as a
 * StorageError the caller can act on instead of a crash at import.
 */

export const DEFAULT_DB_NAME = "resume-builder";
const STORE = "variants";
const VERSION = 1;

type VariantRecord = { name: string; resume: unknown; updatedAt: number };

const UNAVAILABLE =
  "This browser's storage is not available, so nothing can be saved. Private windows and blocked site data can cause this.";
const QUOTA =
  "This browser's storage is full, so nothing was saved. Export JSON to keep a copy, then free some space for this site.";

export function createBrowserRepository({
  idb = globalThis.indexedDB,
  dbName = DEFAULT_DB_NAME,
  persist = requestPersistentStorage,
}: {
  idb?: IDBFactory;
  dbName?: string;
  /** Asks the browser not to evict the data; called after the first save. */
  persist?: () => unknown;
} = {}): ResumeRepository {
  let opening: Promise<IDBDatabase> | null = null;
  let persistRequested = false;

  /** Drops the cached connection, unless a newer one already replaced it. */
  function forget(attempt: Promise<IDBDatabase>): void {
    if (opening === attempt) opening = null;
  }

  function open(): Promise<IDBDatabase> {
    if (opening !== null) return opening;
    const attempt: Promise<IDBDatabase> = openDatabase(idb, dbName).then(
      (db) => {
        // Another tab upgrading the schema must not be blocked by this one.
        db.onversionchange = () => {
          db.close();
          forget(attempt);
        };
        // Closed by the browser rather than by this code (site data cleared,
        // storage evicted): the next call opens a new connection.
        db.onclose = () => forget(attempt);
        return db;
      },
      (cause: unknown) => {
        // A failed open is not cached: the next call tries again.
        forget(attempt);
        throw cause;
      },
    );
    opening = attempt;
    return attempt;
  }

  /**
   * Runs `work` in one transaction and settles once the transaction has
   * committed, so a resolved promise means the data is stored. `work` gets the
   * store and a `fail` that aborts the transaction with a domain error.
   */
  async function transact<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore, fail: (error: Error) => void) => () => T,
    conflict?: () => Error,
  ): Promise<T> {
    const attempt = open();
    const db = await attempt;
    return new Promise<T>((resolve, reject) => {
      let failure: Error | null = null;
      let result: (() => T) | null = null;
      let tx: IDBTransaction;

      const fail = (error: Error) => {
        failure ??= error;
        try {
          tx.abort();
        } catch {
          // Already finished or aborting; the failure is recorded either way.
        }
      };

      try {
        tx = db.transaction(STORE, mode);
      } catch (cause) {
        // The connection closed without a `close` event: this call fails as
        // retryable, and the next one opens a new connection.
        if (errorName(cause) === "InvalidStateError") forget(attempt);
        reject(storageFailure(cause));
        return;
      }

      tx.oncomplete = () => {
        if (failure !== null) reject(failure);
        else if (result === null) reject(storageFailure(null));
        else {
          try {
            resolve(result());
          } catch (error) {
            reject(error);
          }
        }
      };
      tx.onabort = () => {
        if (failure !== null) return reject(failure);
        const name = tx.error?.name;
        reject(
          name === "ConstraintError" && conflict
            ? conflict()
            : storageFailure(tx.error),
        );
      };

      try {
        result = work(tx.objectStore(STORE), fail);
      } catch (cause) {
        fail(isRepositoryError(cause) ? cause : storageFailure(cause));
      }
    });
  }

  /** Reads one record inside a transaction, then hands it to `next`. */
  function get(
    store: IDBObjectStore,
    name: string,
    fail: (error: Error) => void,
    next: (record: VariantRecord | undefined) => void,
  ): void {
    const request = store.get(name);
    request.onsuccess = () => {
      try {
        next(request.result as VariantRecord | undefined);
      } catch (cause) {
        fail(isRepositoryError(cause) ? cause : storageFailure(cause));
      }
    };
  }

  return {
    async list() {
      return transact("readonly", (store) => {
        const request = store.getAllKeys();
        return () =>
          (request.result as IDBValidKey[])
            .filter(isValidVariantName)
            .sort((a, b) => a.localeCompare(b));
      });
    },

    async read(name) {
      assertValidVariantName(name);
      return transact("readonly", (store, fail) => {
        let resume: Resume | null = null;
        get(store, name, fail, (record) => {
          if (record === undefined) return fail(new VariantNotFoundError(name));
          resume = validatedResume(name, record.resume);
        });
        return () => resume as Resume;
      });
    },

    async write(name, resume) {
      assertValidVariantName(name);
      const parsed = validatedResume(name, resume);
      const written = await transact("readwrite", (store, fail) => {
        get(store, name, fail, (record) => {
          if (record === undefined) return fail(new VariantNotFoundError(name));
          store.put(toRecord(name, parsed));
        });
        return () => parsed;
      });

      if (!persistRequested) {
        persistRequested = true;
        try {
          void Promise.resolve(persist()).catch(() => {});
        } catch {
          // Persistence is a request, never a requirement for saving.
        }
      }
      return written;
    },

    async create(name, resume) {
      assertValidVariantName(name);
      const parsed = validatedResume(name, resume);
      return transact(
        "readwrite",
        (store) => {
          store.add(toRecord(name, parsed));
          return () => parsed;
        },
        () => new VariantExistsError(name),
      );
    },

    async duplicate(from, to) {
      assertValidVariantName(from);
      assertValidVariantName(to);
      return transact(
        "readwrite",
        (store, fail) => {
          let copy: Resume | null = null;
          get(store, from, fail, (record) => {
            if (record === undefined) {
              return fail(new VariantNotFoundError(from));
            }
            copy = validatedResume(from, record.resume);
            store.add(toRecord(to, copy));
          });
          return () => structuredClone(copy as Resume);
        },
        () => new VariantExistsError(to),
      );
    },
  };
}

function openDatabase(
  idb: IDBFactory | undefined,
  dbName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idb) {
      reject(new StorageError(UNAVAILABLE, { reason: "unavailable", retryable: false }));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = idb.open(dbName, VERSION);
    } catch (cause) {
      reject(unavailable(cause));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(unavailable(request.error));
  });
}

function toRecord(name: string, resume: Resume): VariantRecord {
  return { name, resume, updatedAt: Date.now() };
}

function unavailable(cause: unknown): StorageError {
  return new StorageError(UNAVAILABLE, {
    reason: "unavailable",
    retryable: false,
    cause,
  });
}

/** A platform failure as a StorageError: quota is told apart, the rest is io. */
function storageFailure(cause: unknown): StorageError {
  const name = errorName(cause);
  if (name === "QuotaExceededError") {
    return new StorageError(QUOTA, { reason: "quota", retryable: false, cause });
  }
  return new StorageError(
    `This browser's storage failed${typeof name === "string" ? ` (${name})` : ""}. Try again in a moment.`,
    { reason: "io", retryable: true, cause },
  );
}

function errorName(cause: unknown): unknown {
  return typeof cause === "object" && cause !== null
    ? (cause as { name?: unknown }).name
    : undefined;
}

/** `navigator.storage.persist()`, where the browser has it. */
function requestPersistentStorage(): unknown {
  if (typeof navigator === "undefined") return undefined;
  return navigator.storage?.persist?.();
}

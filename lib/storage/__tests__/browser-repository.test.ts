import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import { emptyResume } from "@/lib/schema";

import { createBrowserRepository } from "../browser-repository";
import { InvalidVariantDataError, StorageError } from "../errors";

import { describeRepositoryContract, seedResume } from "./repository.contract";

/**
 * IndexedDB through fake-indexeddb, a fresh factory per test so no database
 * outlives the test that made it.
 */

describeRepositoryContract("browser (IndexedDB)", () =>
  createBrowserRepository({ idb: new IDBFactory() }),
);

/** Writes a raw record, bypassing the repository's validation. */
async function putRaw(
  idb: IDBFactory,
  dbName: string,
  record: unknown,
): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("variants", "readwrite");
    tx.objectStore("variants").put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

describe("createBrowserRepository", () => {
  it("touches nothing until the first call", () => {
    const open = vi.fn();
    createBrowserRepository({ idb: { open } as unknown as IDBFactory });
    expect(open).not.toHaveBeenCalled();
  });

  it("does not read indexedDB when the module is imported", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    const getter = vi.fn(() => undefined);
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get: getter,
    });
    try {
      vi.resetModules();
      await import("../browser-repository");
      expect(getter).not.toHaveBeenCalled();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
      else delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  });

  it("opens the database once, however many calls are made", async () => {
    const idb = new IDBFactory();
    const open = vi.spyOn(idb, "open");
    const repo = createBrowserRepository({ idb });

    await Promise.all([repo.list(), repo.list()]);
    await repo.create("default", seedResume());
    await repo.read("default");

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("keeps the variants across repository instances on the same database", async () => {
    const idb = new IDBFactory();
    await createBrowserRepository({ idb }).create("default", seedResume("Ada"));

    const again = createBrowserRepository({ idb });
    expect(await again.list()).toEqual(["default"]);
    expect(await again.read("default")).toEqual(seedResume("Ada"));
  });

  it("stores each variant as { name, resume, updatedAt }", async () => {
    const idb = new IDBFactory();
    await createBrowserRepository({ idb, dbName: "probe" }).create(
      "default",
      seedResume(),
    );

    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = idb.open("probe");
      request.onsuccess = () => resolve(request.result);
    });
    const record = await new Promise<unknown>((resolve) => {
      const request = db
        .transaction("variants")
        .objectStore("variants")
        .get("default");
      request.onsuccess = () => resolve(request.result);
    });
    db.close();

    expect(record).toEqual({
      name: "default",
      resume: seedResume(),
      updatedAt: expect.any(Number),
    });
  });

  it("reports a stored document the schema rejects, with the issues", async () => {
    const idb = new IDBFactory();
    const repo = createBrowserRepository({ idb, dbName: "resumes" });
    await repo.list(); // creates the database and its store
    await putRaw(idb, "resumes", {
      name: "broken",
      resume: { header: { name: 42 } },
      updatedAt: 0,
    });

    const failure = repo.read("broken");
    await expect(failure).rejects.toBeInstanceOf(InvalidVariantDataError);
    await expect(failure).rejects.toMatchObject({
      variant: "broken",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "header.name" }),
      ]),
    });
    // Still listed, so the recovery screen can name it and replace it.
    expect(await repo.list()).toEqual(["broken"]);
    await repo.write("broken", emptyResume());
    expect(await repo.read("broken")).toEqual(emptyResume());
  });

  it("refuses to duplicate a stored document the schema rejects", async () => {
    const idb = new IDBFactory();
    const repo = createBrowserRepository({ idb, dbName: "resumes" });
    await repo.list();
    await putRaw(idb, "resumes", { name: "broken", resume: null, updatedAt: 0 });

    await expect(repo.duplicate("broken", "copy")).rejects.toBeInstanceOf(
      InvalidVariantDataError,
    );
    expect(await repo.list()).toEqual(["broken"]);
  });

  it("is unavailable, not broken, when the browser has no IndexedDB", async () => {
    const repo = createBrowserRepository({ idb: undefined });

    const failure = repo.list();
    await expect(failure).rejects.toBeInstanceOf(StorageError);
    await expect(failure).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("is unavailable when opening the database fails, and tries again on the next call", async () => {
    const idb = new IDBFactory();
    const open = vi
      .spyOn(idb, "open")
      .mockImplementationOnce(() => {
        throw new DOMException("denied", "SecurityError");
      });
    const repo = createBrowserRepository({ idb });

    await expect(repo.list()).rejects.toMatchObject({
      name: "StorageError",
      reason: "unavailable",
    });
    expect(await repo.list()).toEqual([]);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("reports a full storage as quota, not as a generic failure", async () => {
    const idb = new IDBFactory();
    const repo = createBrowserRepository({ idb });
    await repo.create("default", seedResume());
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    const failure = repo.write("default", seedResume("Grace"));
    await expect(failure).rejects.toBeInstanceOf(StorageError);
    await expect(failure).rejects.toMatchObject({
      reason: "quota",
      retryable: false,
    });
    vi.restoreAllMocks();
    expect(await repo.read("default")).toEqual(seedResume());
  });

  it("asks the browser to keep its storage after the first save, once", async () => {
    const persist = vi.fn();
    const repo = createBrowserRepository({ idb: new IDBFactory(), persist });
    await repo.create("default", seedResume());
    expect(persist).not.toHaveBeenCalled();

    await repo.write("default", seedResume("Grace"));
    await repo.write("default", seedResume("Ada"));

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("saves even when asking to keep the storage fails", async () => {
    const persist = vi.fn(() => Promise.reject(new Error("no")));
    const repo = createBrowserRepository({ idb: new IDBFactory(), persist });
    await repo.create("default", seedResume());

    await expect(repo.write("default", seedResume("Grace"))).resolves.toEqual(
      seedResume("Grace"),
    );
  });
});

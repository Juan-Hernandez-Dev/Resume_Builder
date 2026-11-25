import { describe, expect, it, vi } from "vitest";

import { emptyResume } from "@/lib/schema";

import {
  createOrOpen,
  ensureFirstVariant,
  openInitial,
  selectRepository,
} from "../bootstrap";
import { StorageError, VariantExistsError } from "../errors";
import { createMemoryRepository } from "../memory-repository";
import type { ResumeRepository } from "../port";

import { seedResume } from "./repository.contract";

/**
 * What the app opens on: the start-up use cases both pages share, the local
 * one on files and the web one on IndexedDB.
 */

describe("ensureFirstVariant", () => {
  it("seeds an empty variant when there is none", async () => {
    const repo = createMemoryRepository();

    expect(await ensureFirstVariant(repo, "default")).toEqual(["default"]);
    expect(await repo.read("default")).toEqual(emptyResume());
  });

  it("leaves existing variants alone", async () => {
    const repo = createMemoryRepository({ frontend: seedResume() });
    const create = vi.spyOn(repo, "create");

    expect(await ensureFirstVariant(repo, "default")).toEqual(["frontend"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps a variant someone else seeded in between", async () => {
    const repo = createMemoryRepository();
    vi.spyOn(repo, "create").mockRejectedValue(new VariantExistsError("default"));

    expect(await ensureFirstVariant(repo, "default")).toEqual(["default"]);
  });

  it("passes on any other failure", async () => {
    const repo = createMemoryRepository();
    const failure = new StorageError("full", { reason: "quota", retryable: false });
    vi.spyOn(repo, "create").mockRejectedValue(failure);

    await expect(ensureFirstVariant(repo, "default")).rejects.toBe(failure);
  });
});

describe("openInitial", () => {
  it("opens the seeded variant on a first visit", async () => {
    const repo = createMemoryRepository();

    expect(await openInitial(repo, undefined)).toEqual({
      kind: "editor",
      variant: "default",
      resume: emptyResume(),
      variants: ["default"],
    });
  });

  it("opens the requested variant when it exists", async () => {
    const repo = createMemoryRepository({
      default: seedResume("Ada"),
      frontend: seedResume("Grace"),
    });

    expect(await openInitial(repo, "frontend")).toMatchObject({
      kind: "editor",
      variant: "frontend",
      resume: seedResume("Grace"),
      variants: ["default", "frontend"],
    });
  });

  it("falls back to default for an unknown or repeated request", async () => {
    const repo = createMemoryRepository({
      default: seedResume("Ada"),
      frontend: seedResume("Grace"),
    });

    expect(await openInitial(repo, "ghost")).toMatchObject({ variant: "default" });
    expect(await openInitial(repo, ["frontend", "x"])).toMatchObject({
      variant: "default",
    });
    expect(await openInitial(repo, null)).toMatchObject({ variant: "default" });
  });

  it("falls back to the first variant when there is no default", async () => {
    const repo = createMemoryRepository({
      frontend: seedResume(),
      backend: seedResume(),
    });

    expect(await openInitial(repo, undefined)).toMatchObject({
      variant: "backend",
    });
  });

  it("shows recovery, with the issues, for a variant the schema rejects", async () => {
    const repo = createMemoryRepository({
      default: { header: { name: 42 } },
      frontend: seedResume(),
    });

    const view = await openInitial(repo, undefined);
    expect(view).toMatchObject({
      kind: "recovery",
      variant: "default",
      variants: ["default", "frontend"],
      reason: 'Variant "default" does not match the resume schema.',
    });
    expect(view.kind === "recovery" && view.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "header.name" }),
      ]),
    );
  });

  it("shows recovery with the storage's own message when a read fails", async () => {
    const repo = createMemoryRepository({ default: seedResume() });
    vi.spyOn(repo, "read").mockRejectedValue(
      new StorageError("The file is locked.", { reason: "io", retryable: true }),
    );

    expect(await openInitial(repo, undefined)).toEqual({
      kind: "recovery",
      variant: "default",
      variants: ["default"],
      reason: "The file is locked.",
      issues: [],
    });
  });

  it("names the variant when a read fails for an unknown reason", async () => {
    const repo = createMemoryRepository({ default: seedResume() });
    vi.spyOn(repo, "read").mockRejectedValue(new Error("bug"));

    expect(await openInitial(repo, undefined)).toMatchObject({
      kind: "recovery",
      reason: '"default" could not be read.',
    });
  });

  it("shows recovery with no variants when the list cannot be read", async () => {
    const repo: ResumeRepository = {
      ...createMemoryRepository(),
      list: () =>
        Promise.reject(
          new StorageError("The storage is gone.", {
            reason: "unavailable",
            retryable: false,
          }),
        ),
    };

    expect(await openInitial(repo, "frontend")).toEqual({
      kind: "recovery",
      variant: "default",
      variants: [],
      reason: "The storage is gone.",
      issues: [],
    });
  });

  it("still says something when listing fails for an unknown reason", async () => {
    const repo: ResumeRepository = {
      ...createMemoryRepository(),
      list: () => Promise.reject(new Error("bug")),
    };

    expect(await openInitial(repo, undefined)).toMatchObject({
      kind: "recovery",
      reason: "The saved variants could not be read.",
    });
  });
});

describe("createOrOpen", () => {
  it("creates the variant from the loaded document when it is missing", async () => {
    const repo = createMemoryRepository();
    const load = vi.fn(async () => seedResume("John Doe"));

    expect(await createOrOpen(repo, "example", load)).toEqual(
      seedResume("John Doe"),
    );
    expect(await repo.read("example")).toEqual(seedResume("John Doe"));
  });

  it("opens the variant as it is when it already exists", async () => {
    const repo = createMemoryRepository({ example: seedResume("Edited") });
    const load = vi.fn(async () => seedResume("John Doe"));

    expect(await createOrOpen(repo, "example", load)).toEqual(
      seedResume("Edited"),
    );
    expect(await repo.read("example")).toEqual(seedResume("Edited"));
    expect(load).not.toHaveBeenCalled();
  });

  it("opens the variant when it appears between the check and the create", async () => {
    const repo = createMemoryRepository();
    const load = async () => {
      await repo.create("example", seedResume("Other tab"));
      return seedResume("John Doe");
    };

    expect(await createOrOpen(repo, "example", load)).toEqual(
      seedResume("Other tab"),
    );
  });

  it("passes on a failure to store it", async () => {
    const repo = createMemoryRepository();
    const failure = new StorageError("full", { reason: "quota", retryable: false });
    vi.spyOn(repo, "create").mockRejectedValue(failure);

    await expect(
      createOrOpen(repo, "example", async () => seedResume()),
    ).rejects.toBe(failure);
  });
});

describe("selectRepository", () => {
  it("keeps the primary repository when it works", async () => {
    const primary = createMemoryRepository();
    const fallback = vi.fn(() => createMemoryRepository());

    expect(await selectRepository(primary, fallback)).toEqual({
      repository: primary,
      degraded: false,
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back when the primary storage is unavailable", async () => {
    const primary: ResumeRepository = {
      ...createMemoryRepository(),
      list: () =>
        Promise.reject(
          new StorageError("gone", { reason: "unavailable", retryable: false }),
        ),
    };
    const fallback = createMemoryRepository();

    expect(await selectRepository(primary, () => fallback)).toEqual({
      repository: fallback,
      degraded: true,
    });
  });

  it("keeps the primary for any other failure, so recovery can report it", async () => {
    const primary: ResumeRepository = {
      ...createMemoryRepository(),
      list: () =>
        Promise.reject(new StorageError("full", { reason: "quota", retryable: false })),
    };
    const fallback = vi.fn(() => createMemoryRepository());

    expect(await selectRepository(primary, fallback)).toEqual({
      repository: primary,
      degraded: false,
    });
    expect(fallback).not.toHaveBeenCalled();
  });
});

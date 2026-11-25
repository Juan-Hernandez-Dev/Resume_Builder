import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { StorageError } from "../errors";
import type { ResumeRepository } from "../port";

import { describeRepositoryContract, seedResume } from "./repository.contract";

/**
 * The repository the local page opens the editor with: lib/variants.ts behind
 * the port, run against the real filesystem.
 *
 * DATA_DIR is resolved from `process.cwd()` when lib/variants.ts loads, so the
 * module is loaded once with the working directory pointed at a temp root, and
 * data/ is wiped before every test. Loading it once (rather than once per
 * test, as bootstrap-fs.test.ts does) keeps one copy of the error classes,
 * which the shared contract checks with `instanceof`.
 */

let root: string;
let repository: ResumeRepository;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fs-repository-test-"));
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
  repository = (await import("../fs-repository")).fsRepository;
  cwd.mockRestore();
});

beforeEach(async () => {
  await fs.rm(path.join(root, "data"), { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function load() {
  return repository;
}

describeRepositoryContract("filesystem", load);

describe("fsRepository", () => {
  it("writes variants as files under data/", async () => {
    const repo = await load();
    await repo.create("default", seedResume("Ada"));

    const raw = await fs.readFile(path.join(root, "data", "default.json"), "utf8");
    expect(JSON.parse(raw)).toEqual(seedResume("Ada"));
  });

  it("turns a filesystem failure into a StorageError that says what to do", async () => {
    const repo = await load();
    vi.spyOn(fs, "readdir").mockRejectedValue(
      Object.assign(new Error("EACCES: /secret/path"), { code: "EACCES" }),
    );

    const failure = repo.list();
    await expect(failure).rejects.toBeInstanceOf(StorageError);
    const error = (await failure.catch((e: unknown) => e)) as StorageError;
    expect(error.message).toMatch(/^The data directory could not be read: /);
    expect(error.message).toContain("(EACCES)");
    expect(error.message).not.toContain("/secret/path");
    expect(error.retryable).toBe(false);
  });

  it("marks a lock as retryable", async () => {
    const repo = await load();
    await repo.create("default", seedResume());
    vi.spyOn(fs, "readFile").mockRejectedValue(
      Object.assign(new Error("busy"), { code: "EBUSY" }),
    );

    await expect(repo.read("default")).rejects.toMatchObject({
      name: "StorageError",
      retryable: true,
      message: expect.stringMatching(/^"default" could not be read: .*\(EBUSY\)$/),
    });
  });

  it("still names the failure when the code is not one it knows", async () => {
    const repo = await load();
    vi.spyOn(fs, "readdir").mockRejectedValue(new Error("weird"));

    await expect(repo.list()).rejects.toMatchObject({
      name: "StorageError",
      message: "The data directory could not be read.",
    });
  });
});

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyResume } from "@/lib/schema";

/**
 * The first-run seed (lib/storage/bootstrap.ts) on the files under data/,
 * through the fs repository the local page opens the editor with.
 *
 * `DATA_DIR` is resolved from `process.cwd()` when lib/variants.ts loads, so
 * each test points the working directory at a fresh temp directory and loads
 * the modules again. This runs against the real filesystem: what matters here
 * is what a fresh clone has on disk, which a mocked fs would not prove.
 */

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "bootstrap-fs-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

async function load() {
  const { ensureFirstVariant } = await import("@/lib/storage/bootstrap");
  const { fsRepository } = await import("@/lib/storage/fs-repository");
  return { ensureFirstVariant, repository: fsRepository };
}

describe("ensureFirstVariant on the files", () => {
  it("creates data/ and seeds an empty `default` when there is no data directory", async () => {
    const { ensureFirstVariant, repository } = await load();

    expect(await ensureFirstVariant(repository, "default")).toEqual(["default"]);
    expect(await repository.list()).toEqual(["default"]);
    expect(await repository.read("default")).toEqual(emptyResume());
    expect(await fs.readdir(path.join(root, "data"))).toEqual([
      "default.json",
    ]);
  });

  it("seeds `default` when data/ exists but holds no variant", async () => {
    // Only *.json is a variant: write artifacts left behind do not count.
    await fs.mkdir(path.join(root, "data"));
    await fs.writeFile(path.join(root, "data", "old.json.bak"), "{}");
    const { ensureFirstVariant, repository } = await load();

    expect(await ensureFirstVariant(repository, "default")).toEqual(["default"]);
    expect(await repository.read("default")).toEqual(emptyResume());
  });

  it("leaves an existing variant alone and seeds nothing", async () => {
    const { ensureFirstVariant, repository } = await load();
    const mine = { ...emptyResume(), header: { ...emptyResume().header, name: "Mine" } };
    await repository.create("frontend", mine);

    expect(await ensureFirstVariant(repository, "default")).toEqual(["frontend"]);
    expect((await repository.read("frontend")).header.name).toBe("Mine");
    expect(await fs.readdir(path.join(root, "data"))).toEqual([
      "frontend.json",
    ]);
  });
});

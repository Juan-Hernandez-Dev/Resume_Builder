import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyResume } from "@/lib/schema";

/**
 * `DATA_DIR` is resolved from `process.cwd()` when lib/variants.ts loads, so
 * each test points the working directory at a fresh temp directory and loads
 * the module again. This runs against the real filesystem: what matters here
 * is what a fresh clone has on disk, which a mocked fs would not prove.
 */

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "variants-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

async function loadVariants() {
  return import("@/lib/variants");
}

describe("ensureFirstVariant", () => {
  it("creates data/ and seeds an empty `default` when there is no data directory", async () => {
    const { ensureFirstVariant, listVariants, readVariant } =
      await loadVariants();

    expect(await ensureFirstVariant("default")).toEqual(["default"]);
    expect(await listVariants()).toEqual(["default"]);
    expect(await readVariant("default")).toEqual(emptyResume());
    expect(await fs.readdir(path.join(root, "data"))).toEqual([
      "default.json",
    ]);
  });

  it("seeds `default` when data/ exists but holds no variant", async () => {
    // Only *.json is a variant: write artifacts left behind do not count.
    await fs.mkdir(path.join(root, "data"));
    await fs.writeFile(path.join(root, "data", "old.json.bak"), "{}");
    const { ensureFirstVariant, readVariant } = await loadVariants();

    expect(await ensureFirstVariant("default")).toEqual(["default"]);
    expect(await readVariant("default")).toEqual(emptyResume());
  });

  it("leaves an existing variant alone and seeds nothing", async () => {
    const { createVariant, ensureFirstVariant, readVariant } =
      await loadVariants();
    const mine = { ...emptyResume(), header: { ...emptyResume().header, name: "Mine" } };
    await createVariant("frontend", mine);

    expect(await ensureFirstVariant("default")).toEqual(["frontend"]);
    expect((await readVariant("frontend")).header.name).toBe("Mine");
    expect(await fs.readdir(path.join(root, "data"))).toEqual([
      "frontend.json",
    ]);
  });
});

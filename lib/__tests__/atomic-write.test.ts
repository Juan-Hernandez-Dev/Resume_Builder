import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BACKUP_SUFFIX,
  backupPathFor,
  createFileExclusive,
  writeFileAtomic,
} from "@/lib/atomic-write";

/**
 * These run against the real filesystem on purpose: the whole point of the
 * module is the behaviour of rename and the open flags on this platform, which
 * a mocked fs would not prove.
 */

let dir: string;
let target: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-write-test-"));
  target = path.join(dir, "default.json");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function read(file: string): Promise<string> {
  return fs.readFile(file, "utf8");
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Every entry left in the directory, so a stray temp file cannot hide. */
async function listing(): Promise<string[]> {
  return (await fs.readdir(dir)).sort();
}

describe("writeFileAtomic", () => {
  it("creates the file when it does not exist yet", async () => {
    await writeFileAtomic(target, "first\n");
    expect(await read(target)).toBe("first\n");
  });

  it("replaces existing content", async () => {
    await writeFileAtomic(target, "old\n");
    await writeFileAtomic(target, "new\n");
    expect(await read(target)).toBe("new\n");
  });

  it("leaves no temp file behind on success", async () => {
    await writeFileAtomic(target, "first\n");
    await writeFileAtomic(target, "second\n");
    expect(await listing()).toEqual(["default.json", "default.json.bak"]);
  });

  it("keeps the previous good content as a single rolling .bak", async () => {
    await writeFileAtomic(target, "one\n");
    // Nothing to back up on the very first write: there was no previous file.
    expect(await exists(backupPathFor(target))).toBe(false);

    await writeFileAtomic(target, "two\n");
    expect(await read(backupPathFor(target))).toBe("one\n");

    await writeFileAtomic(target, "three\n");
    expect(await read(backupPathFor(target))).toBe("two\n");
    expect(await read(target)).toBe("three\n");
  });

  it("names the backup after the target plus the suffix", () => {
    expect(backupPathFor(target)).toBe(`${target}${BACKUP_SUFFIX}`);
    expect(BACKUP_SUFFIX).toBe(".bak");
  });

  it("never truncates the target: a failed write leaves it intact", async () => {
    await writeFileAtomic(target, "good\n");

    // The temp file is written next to the target, so a target the filesystem
    // refuses (its parent does not exist) fails before anything is replaced.
    const unwritable = path.join(dir, "gone", "x.json");
    await expect(writeFileAtomic(unwritable, "nope\n")).rejects.toThrow();

    expect(await read(target)).toBe("good\n");
    expect(await listing()).toEqual(["default.json"]);
  });

  it("rejects rather than corrupting the file when the target is a directory", async () => {
    const asDirectory = path.join(dir, "dir.json");
    await fs.mkdir(asDirectory);

    await expect(writeFileAtomic(asDirectory, "nope\n")).rejects.toThrow();

    // The temp file is cleaned up even though the rename could never land.
    expect((await listing()).filter((name) => name.endsWith(".tmp"))).toEqual(
      [],
    );
    expect((await fs.stat(asDirectory)).isDirectory()).toBe(true);
  });

  it("writes bytes verbatim, including a trailing newline", async () => {
    const contents = `${JSON.stringify({ a: 1 }, null, 2)}\n`;
    await writeFileAtomic(target, contents);
    expect(await read(target)).toBe(contents);
    expect(Buffer.byteLength(contents)).toBe(
      (await fs.stat(target)).size,
    );
  });

  it("round-trips non-ASCII content as UTF-8", async () => {
    await writeFileAtomic(target, "Pérez – Ingeniería\n");
    expect(await read(target)).toBe("Pérez – Ingeniería\n");
  });

  it("survives repeated writes without accumulating files", async () => {
    for (let i = 0; i < 10; i += 1) {
      await writeFileAtomic(target, `write ${i}\n`);
    }
    expect(await read(target)).toBe("write 9\n");
    expect(await read(backupPathFor(target))).toBe("write 8\n");
    expect(await listing()).toEqual(["default.json", "default.json.bak"]);
  });

  it("keeps concurrent writes to the same target from colliding", async () => {
    await writeFileAtomic(target, "start\n");
    await Promise.all([
      writeFileAtomic(target, "a\n"),
      writeFileAtomic(target, "b\n"),
      writeFileAtomic(target, "c\n"),
    ]);
    // Whichever rename lands last wins, but the file is always one whole value
    // and every temp file is gone: no write ever sees another's temp name.
    expect(["a\n", "b\n", "c\n"]).toContain(await read(target));
    expect((await listing()).filter((name) => name.endsWith(".tmp"))).toEqual(
      [],
    );
  });
});

describe("createFileExclusive", () => {
  it("creates a file that does not exist", async () => {
    expect(await createFileExclusive(target, "seed\n")).toBe(true);
    expect(await read(target)).toBe("seed\n");
  });

  it("reports false and changes nothing when the file already exists", async () => {
    await fs.writeFile(target, "mine\n", "utf8");
    expect(await createFileExclusive(target, "seed\n")).toBe(false);
    expect(await read(target)).toBe("mine\n");
  });

  it("does not leave a partial file when the parent is missing", async () => {
    const missing = path.join(dir, "gone", "x.json");
    await expect(createFileExclusive(missing, "seed\n")).rejects.toThrow();
    expect(await listing()).toEqual([]);
  });

  it("writes no backup: there is no previous content to keep", async () => {
    await createFileExclusive(target, "seed\n");
    expect(await exists(backupPathFor(target))).toBe(false);
  });
});

describe("platform assumptions", () => {
  /**
   * writeFileAtomic is only atomic because rename replaces an existing file on
   * the same volume. This is the assumption the whole module rests on, so it is
   * asserted rather than assumed.
   */
  it("rename replaces an existing file on this platform", async () => {
    const temp = path.join(dir, "probe.tmp");
    await fs.writeFile(target, "old\n", "utf8");
    await fs.writeFile(temp, "new\n", "utf8");

    await fs.rename(temp, target);

    expect(await read(target)).toBe("new\n");
    expect(await exists(temp)).toBe(false);
  });
});

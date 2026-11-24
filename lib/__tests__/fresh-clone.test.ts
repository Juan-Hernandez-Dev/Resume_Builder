import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resumeSchema } from "@/lib/schema";

/**
 * What a fresh clone gets. `ensureFirstVariant` only seeds `default` when
 * data/ holds no variant, so a variant file shipped in the repository would
 * be opened instead, and autosave would then write the user's real resume
 * into a tracked file. The placeholder therefore lives in examples/, which
 * the app never reads.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const PLACEHOLDER = path.join(ROOT, "examples", "john-doe.json");

function git(...args: string[]): string {
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
}

function isGitCheckout(): boolean {
  try {
    return git("rev-parse", "--is-inside-work-tree").trim() === "true";
  } catch {
    return false;
  }
}

/** True when .gitignore ignores the path, whether or not it is tracked. */
function isIgnored(relative: string): boolean {
  try {
    git("check-ignore", "--quiet", "--no-index", relative);
    return true;
  } catch {
    return false;
  }
}

describe.runIf(isGitCheckout())("the repository", () => {
  it("tracks no variant file in data/", () => {
    const tracked = git("ls-files", "--", "data").split("\n").filter(Boolean);
    expect(tracked.filter((file) => file.endsWith(".json"))).toEqual([]);
  });

  it("ignores every JSON file in data/, with no exception", () => {
    for (const file of [
      "data/default.json",
      "data/example.json",
      "data/frontend.json",
      "data/default.json.bak",
      "data/default.json.tmp",
    ]) {
      expect(isIgnored(file), file).toBe(true);
    }
  });

  it("tracks the placeholder in examples/", () => {
    expect(git("ls-files", "--", "examples/john-doe.json").trim()).toBe(
      "examples/john-doe.json",
    );
  });
});

describe("examples/john-doe.json", () => {
  it("is a valid resume of placeholder content", async () => {
    const parsed = resumeSchema.parse(
      JSON.parse(await fs.readFile(PLACEHOLDER, "utf8")),
    );
    expect(parsed.header.name).toBe("John Doe");
    expect(parsed.header.email).toMatch(/@example\.com$/);
  });
});

describe("runtime code", () => {
  /** Every non-test source file the app is built from. */
  async function sourceFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return entry.name === "__tests__" ? [] : sourceFiles(full);
        }
        return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [full] : [];
      }),
    );
    return files.flat();
  }

  it("never reads from examples/", async () => {
    const files = [
      ...(await sourceFiles(path.join(ROOT, "app"))),
      ...(await sourceFiles(path.join(ROOT, "components"))),
      ...(await sourceFiles(path.join(ROOT, "lib"))),
      path.join(ROOT, "next.config.ts"),
    ];
    expect(files.length).toBeGreaterThan(10);

    const offenders: string[] = [];
    for (const file of files) {
      if (/\bexamples\b|john-doe\.json/.test(await fs.readFile(file, "utf8"))) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

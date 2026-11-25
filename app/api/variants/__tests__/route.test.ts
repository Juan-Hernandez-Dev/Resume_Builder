import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyResume, type Resume } from "@/lib/schema";

/**
 * POST /api/variants on a real temp data/ directory: duplicating with
 * `{ from, to }`, and creating from a document with `{ to, resume }`, which is
 * how "Load example" stores the placeholder in local mode.
 *
 * DATA_DIR is resolved from `process.cwd()` when lib/variants.ts loads, so the
 * route is loaded again for every test, after the working directory moved.
 */

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "variants-route-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

function named(name: string): Resume {
  const resume = emptyResume();
  resume.header.name = name;
  return resume;
}

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("../route.local");
  return POST(
    new Request("http://127.0.0.1/api/variants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function stored(name: string): Promise<unknown> {
  return JSON.parse(
    await fs.readFile(path.join(root, "data", `${name}.json`), "utf8"),
  );
}

async function seed(name: string, resume: Resume): Promise<void> {
  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.writeFile(
    path.join(root, "data", `${name}.json`),
    JSON.stringify(resume),
  );
}

describe("POST /api/variants with { from, to }", () => {
  it("copies the variant", async () => {
    await seed("default", named("Ada"));

    const response = await post({ from: "default", to: "copy" });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ name: "copy", resume: named("Ada") });
    expect(await stored("copy")).toEqual(named("Ada"));
  });

  it("answers 404 for a missing source and 409 for a taken name", async () => {
    await seed("default", named("Ada"));
    await seed("copy", named("Grace"));

    expect((await post({ from: "ghost", to: "new" })).status).toBe(404);
    expect((await post({ from: "default", to: "copy" })).status).toBe(409);
    expect(await stored("copy")).toEqual(named("Grace"));
  });
});

describe("POST /api/variants with { to, resume }", () => {
  it("creates the variant from the document", async () => {
    const response = await post({ to: "example", resume: named("John Doe") });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      name: "example",
      resume: named("John Doe"),
    });
    expect(await stored("example")).toEqual(named("John Doe"));
  });

  it("never replaces an existing variant", async () => {
    await seed("example", named("Mine"));

    const response = await post({ to: "example", resume: named("John Doe") });

    expect(response.status).toBe(409);
    expect(await stored("example")).toEqual(named("Mine"));
  });

  it("refuses a document the schema rejects, with the issues", async () => {
    const response = await post({ to: "example", resume: { header: { name: 1 } } });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { issues?: unknown[] };
    expect(body.issues?.length).toBeGreaterThan(0);
    await expect(fs.access(path.join(root, "data", "example.json"))).rejects.toThrow();
  });

  it("refuses an invalid name", async () => {
    expect((await post({ to: "../evil", resume: named("x") })).status).toBe(400);
  });

  it("refuses a body that is neither shape", async () => {
    expect((await post({ to: "example" })).status).toBe(400);
    expect((await post({ nothing: true })).status).toBe(400);
  });
});

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyResume, type Resume } from "@/lib/schema";

/**
 * GET and PUT /api/variants/:name on a real temp data/ directory, for the
 * guards in front of them: a request not addressed to this machine reads and
 * writes nothing, and a write must be sent as application/json.
 *
 * DATA_DIR is resolved from `process.cwd()` when lib/variants.ts loads, so the
 * route is loaded again for every test, after the working directory moved.
 */

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "variant-route-test-"));
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

async function seed(name: string, resume: Resume): Promise<void> {
  await fs.mkdir(path.join(root, "data"), { recursive: true });
  await fs.writeFile(
    path.join(root, "data", `${name}.json`),
    JSON.stringify(resume),
  );
}

async function stored(name: string): Promise<unknown> {
  return JSON.parse(
    await fs.readFile(path.join(root, "data", `${name}.json`), "utf8"),
  );
}

const params = (name: string) => ({ params: Promise.resolve({ name }) });

async function get(name: string, host = "127.0.0.1:3000"): Promise<Response> {
  const { GET } = await import("../route.local");
  return GET(
    new Request(`http://127.0.0.1:3000/api/variants/${name}`, { headers: { host } }),
    params(name),
  );
}

async function put(
  name: string,
  body: unknown,
  {
    contentType = "application/json",
    host = "127.0.0.1:3000",
  }: { contentType?: string; host?: string } = {},
): Promise<Response> {
  const { PUT } = await import("../route.local");
  return PUT(
    new Request(`http://127.0.0.1:3000/api/variants/${name}`, {
      method: "PUT",
      headers: { "content-type": contentType, host },
      body: JSON.stringify(body),
    }),
    params(name),
  );
}

describe("GET /api/variants/:name", () => {
  it("reads the variant for a request addressed to this machine", async () => {
    await seed("default", named("Ada"));

    const response = await get("default", "[::1]:3000");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "default", resume: named("Ada") });
  });

  it("answers 403 to any other Host, so a DNS-rebinding page cannot read the resume", async () => {
    await seed("default", named("Ada"));

    const response = await get("default", "evil.example.com:3000");

    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty("resume");
  });
});

describe("PUT /api/variants/:name", () => {
  it("writes the variant for a JSON request addressed to this machine", async () => {
    await seed("default", named("Ada"));

    const response = await put("default", named("Grace"));

    expect(response.status).toBe(200);
    expect(await stored("default")).toEqual(named("Grace"));
  });

  it("answers 403 to any other Host and leaves the file alone", async () => {
    await seed("default", named("Ada"));

    const response = await put("default", named("Grace"), {
      host: "evil.example.com:3000",
    });

    expect(response.status).toBe(403);
    expect(await stored("default")).toEqual(named("Ada"));
  });

  it("answers 415 to a body not sent as application/json and leaves the file alone", async () => {
    await seed("default", named("Ada"));

    const response = await put("default", named("Grace"), {
      contentType: "text/plain",
    });

    expect(response.status).toBe(415);
    expect(await stored("default")).toEqual(named("Ada"));
  });
});

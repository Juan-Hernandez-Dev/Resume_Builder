import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { InvalidVariantNameError } from "@/lib/variant-name";

import {
  InvalidVariantDataError,
  StorageError,
  VariantExistsError,
  VariantNotFoundError,
} from "../errors";
import { createHttpRepository } from "../http-repository";

import { seedResume } from "./repository.contract";

/**
 * The /api/variants routes as a repository, from the browser's side: which
 * request each method sends, and how each status comes back as the same errors
 * the other adapters throw, carrying the server's own wording.
 */

let fetchMock: MockInstance;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit?];
  return { url, init: init ?? {} };
}

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const repo = createHttpRepository();

describe("requests", () => {
  it("lists with GET /api/variants, uncached", async () => {
    fetchMock.mockResolvedValue(json(200, { variants: ["a", "b"] }));

    expect(await repo.list()).toEqual(["a", "b"]);
    expect(lastCall().url).toBe("/api/variants");
    expect(lastCall().init.cache).toBe("no-store");
  });

  it("reads with GET /api/variants/:name, uncached", async () => {
    fetchMock.mockResolvedValue(json(200, { name: "frontend", resume: seedResume() }));

    expect(await repo.read("frontend")).toEqual(seedResume());
    expect(lastCall().url).toBe("/api/variants/frontend");
    expect(lastCall().init.method ?? "GET").toBe("GET");
    expect(lastCall().init.cache).toBe("no-store");
  });

  it("writes with PUT /api/variants/:name and the document as JSON", async () => {
    fetchMock.mockResolvedValue(json(200, { name: "default", resume: seedResume("Grace") }));

    expect(await repo.write("default", seedResume("Grace"))).toEqual(
      seedResume("Grace"),
    );
    const { url, init } = lastCall();
    expect(url).toBe("/api/variants/default");
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual(seedResume("Grace"));
  });

  it("creates with POST /api/variants and { to, resume }", async () => {
    fetchMock.mockResolvedValue(json(201, { name: "example", resume: seedResume() }));

    expect(await repo.create("example", seedResume())).toEqual(seedResume());
    const { url, init } = lastCall();
    expect(url).toBe("/api/variants");
    expect(init.method).toBe("POST");
    // The route answers 415 to anything else (see lib/request-guards.ts).
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({
      to: "example",
      resume: seedResume(),
    });
  });

  it("duplicates with POST /api/variants and { from, to }", async () => {
    fetchMock.mockResolvedValue(json(201, { name: "copy", resume: seedResume() }));

    expect(await repo.duplicate("default", "copy")).toEqual(seedResume());
    const { url, init } = lastCall();
    expect(url).toBe("/api/variants");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ from: "default", to: "copy" });
  });

  it("refuses an invalid name without sending anything", async () => {
    await expect(repo.read("../evil")).rejects.toBeInstanceOf(
      InvalidVariantNameError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("failures", () => {
  it("maps 404 to VariantNotFoundError with the server's message", async () => {
    fetchMock.mockResolvedValue(json(404, { error: 'Variant "ghost" does not exist.' }));

    const failure = repo.read("ghost");
    await expect(failure).rejects.toBeInstanceOf(VariantNotFoundError);
    await expect(failure).rejects.toMatchObject({
      variant: "ghost",
      message: 'Variant "ghost" does not exist.',
    });
  });

  it("maps 409 to VariantExistsError", async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'Variant "copy" already exists.' }));

    const failure = repo.duplicate("default", "copy");
    await expect(failure).rejects.toBeInstanceOf(VariantExistsError);
    await expect(failure).rejects.toMatchObject({
      variant: "copy",
      message: 'Variant "copy" already exists.',
    });
  });

  it("maps 422 to InvalidVariantDataError, issues spelled out and kept", async () => {
    const issues = [{ path: "header.name", message: "Expected string" }];
    fetchMock.mockResolvedValue(
      json(422, { error: 'Variant "broken" does not match the resume schema.', issues }),
    );

    const failure = repo.read("broken");
    await expect(failure).rejects.toBeInstanceOf(InvalidVariantDataError);
    await expect(failure).rejects.toMatchObject({
      variant: "broken",
      issues,
      message:
        'Variant "broken" does not match the resume schema. header.name: Expected string',
    });
  });

  it("maps 503 to a StorageError worth retrying", async () => {
    fetchMock.mockResolvedValue(json(503, { error: "The file is locked." }));

    const failure = repo.write("default", seedResume());
    await expect(failure).rejects.toBeInstanceOf(StorageError);
    await expect(failure).rejects.toMatchObject({
      retryable: true,
      message: "The file is locked.",
    });
  });

  it("maps any other status to a StorageError, with the zod issues of a 400", async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        error: "Invalid resume.",
        issues: [{ path: ["header", "name"], message: "Expected string" }],
      }),
    );

    const failure = repo.write("default", seedResume());
    await expect(failure).rejects.toBeInstanceOf(StorageError);
    await expect(failure).rejects.toMatchObject({
      retryable: false,
      message: "Invalid resume. header.name: Expected string",
    });
  });

  it("names the operation and the status when the body says nothing", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 500 }));

    await expect(repo.write("default", seedResume())).rejects.toMatchObject({
      message: 'Could not save "default". (HTTP 500)',
    });
    fetchMock.mockResolvedValue(new Response("<html>", { status: 500 }));
    await expect(repo.read("default")).rejects.toMatchObject({
      message: 'Could not open "default". (HTTP 500)',
    });
    fetchMock.mockResolvedValue(new Response("<html>", { status: 500 }));
    await expect(repo.duplicate("default", "copy")).rejects.toMatchObject({
      message: 'Could not create "copy". (HTTP 500)',
    });
  });

  it("reports a 200 that is not a resume as invalid data", async () => {
    fetchMock.mockResolvedValue(json(200, { name: "default", resume: { nope: 1 } }));

    const failure = repo.read("default");
    await expect(failure).rejects.toBeInstanceOf(InvalidVariantDataError);
    await expect(failure).rejects.toMatchObject({
      message: '"default" did not come back as a valid resume.',
    });
  });

  it("lets a request that never reached the server fail as it is", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(repo.write("default", seedResume())).rejects.toThrow(
      new TypeError("Failed to fetch"),
    );
  });
});

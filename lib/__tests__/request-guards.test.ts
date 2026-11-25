import { describe, expect, it } from "vitest";

import {
  isLoopbackHost,
  requireJsonBody,
  requireLoopbackHost,
} from "@/lib/request-guards";

describe("isLoopbackHost", () => {
  it("accepts a Host header naming this machine, with or without a port", () => {
    for (const host of [
      "127.0.0.1",
      "127.0.0.1:3000",
      "127.0.1.1:3000",
      "localhost:3000",
      "LOCALHOST",
      "[::1]:3000",
      "[::1]",
    ]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
  });

  it("rejects anything else, including look-alikes and garbage", () => {
    for (const host of [
      "192.168.1.10:3000",
      "example.com",
      "localhost.example.com",
      "127.0.0.1.example.com:3000",
      "evil.example.com:3000",
      "a b",
      "",
      null,
    ]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });
});

function request(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1:3000/api/anything", {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("requireJsonBody", () => {
  it("lets application/json through, with or without parameters", () => {
    expect(requireJsonBody(request({ "content-type": "application/json" }))).toBeNull();
    expect(
      requireJsonBody(request({ "content-type": "Application/JSON; charset=utf-8" })),
    ).toBeNull();
  });

  it("answers 415 for any other type, or none", async () => {
    const cases: Record<string, string>[] = [{ "content-type": "text/plain" }, {}];
    for (const headers of cases) {
      const response = requireJsonBody(request(headers));
      expect(response?.status).toBe(415);
      expect(await response?.json()).toEqual({
        error: "Request body must be sent as application/json.",
      });
    }
  });
});

describe("requireLoopbackHost", () => {
  it("lets a request addressed to this machine through", () => {
    expect(requireLoopbackHost(request({ host: "localhost:3000" }), "no")).toBeNull();
  });

  it("answers 403 with the given message otherwise", async () => {
    const response = requireLoopbackHost(
      request({ host: "evil.example.com:3000" }),
      "Not from here.",
    );
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "Not from here." });
  });
});

import { describe, expect, it } from "vitest";

import {
  MAX_ISSUES,
  describeFailure,
  formatIssues,
  messageOf,
  readResume,
} from "@/lib/api-response";
import { emptyResume } from "@/lib/schema";

/** A Response as the route handlers produce one. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("readResume", () => {
  it("returns the resume from a well formed payload", async () => {
    const resume = emptyResume();
    const response = jsonResponse({ name: "default", resume });
    await expect(readResume(response)).resolves.toEqual(resume);
  });

  it("fills schema defaults, so a thin payload still loads", async () => {
    const response = jsonResponse({
      resume: { header: {}, sections: [] },
    });
    const resume = await readResume(response);
    expect(resume).not.toBeNull();
    expect(resume?.settings).toEqual({
      pageSize: "letter",
      dateSeparator: "hyphen",
    });
    expect(resume?.header.links).toEqual([]);
  });

  it("returns null for a payload that is not a resume", async () => {
    await expect(readResume(jsonResponse({ resume: null }))).resolves.toBeNull();
    await expect(readResume(jsonResponse({}))).resolves.toBeNull();
    await expect(readResume(jsonResponse([1, 2, 3]))).resolves.toBeNull();
    await expect(readResume(jsonResponse("nope"))).resolves.toBeNull();
    await expect(readResume(jsonResponse(42))).resolves.toBeNull();
  });

  it("returns null for a resume that fails the schema", async () => {
    const response = jsonResponse({
      resume: { header: {}, sections: [{ type: "unknown" }] },
    });
    await expect(readResume(response)).resolves.toBeNull();
  });

  it("returns null instead of throwing on a body that is not JSON", async () => {
    const response = new Response("<html>oops</html>", { status: 200 });
    await expect(readResume(response)).resolves.toBeNull();
  });
});

describe("describeFailure", () => {
  it("prefers the server's own error message", async () => {
    const response = jsonResponse({ error: 'Variant "cv" does not exist.' }, 404);
    await expect(describeFailure(response, "fallback")).resolves.toBe(
      'Variant "cv" does not exist.',
    );
  });

  it("falls back to the caller's sentence plus the status", async () => {
    const response = jsonResponse({}, 500);
    await expect(describeFailure(response, 'Could not save "cv".')).resolves.toBe(
      'Could not save "cv". (HTTP 500)',
    );
  });

  it("falls back when the body is not JSON at all", async () => {
    const response = new Response("Internal Server Error", { status: 500 });
    await expect(describeFailure(response, "Could not save.")).resolves.toBe(
      "Could not save. (HTTP 500)",
    );
  });

  it("falls back when the body is JSON but not an object", async () => {
    await expect(
      describeFailure(jsonResponse("boom", 500), "Could not save."),
    ).resolves.toBe("Could not save. (HTTP 500)");
    await expect(
      describeFailure(jsonResponse(null, 500), "Could not save."),
    ).resolves.toBe("Could not save. (HTTP 500)");
  });

  it("spells out the zod issues a 400 carries, naming the field at fault", async () => {
    const response = jsonResponse(
      {
        error: "Invalid resume.",
        issues: [
          { path: ["header", "name"], message: "Expected string" },
          { path: ["sections", 0, "title"], message: "Required" },
        ],
      },
      400,
    );
    await expect(describeFailure(response, "fallback")).resolves.toBe(
      "Invalid resume. header.name: Expected string; sections.0.title: Required",
    );
  });

  it("ignores an issues field that is not a non-empty array", async () => {
    await expect(
      describeFailure(jsonResponse({ error: "Nope.", issues: [] }, 400), "f"),
    ).resolves.toBe("Nope.");
    await expect(
      describeFailure(jsonResponse({ error: "Nope.", issues: "x" }, 400), "f"),
    ).resolves.toBe("Nope.");
  });
});

describe("formatIssues", () => {
  it("joins path and message for each issue", () => {
    expect(
      formatIssues([
        { path: ["header", "email"], message: "Expected string" },
        { path: [], message: "Invalid document" },
      ]),
    ).toBe("header.email: Expected string; Invalid document");
  });

  it("accepts a path that is already a string", () => {
    expect(formatIssues([{ path: "settings.pageSize", message: "Bad" }])).toBe(
      "settings.pageSize: Bad",
    );
  });

  it("truncates past the display limit and says how many are hidden", () => {
    const issues = Array.from({ length: MAX_ISSUES + 3 }, (_, index) => ({
      path: [`f${index}`],
      message: "bad",
    }));
    const formatted = formatIssues(issues);
    expect(formatted).toContain("(+3 more)");
    expect(formatted).toContain("f0: bad");
    expect(formatted).not.toContain(`f${MAX_ISSUES}: bad`);
  });

  it("does not mention hidden issues when none are hidden", () => {
    expect(formatIssues([{ path: ["a"], message: "bad" }])).toBe("a: bad");
  });

  it("survives issues that are not shaped like zod issues", () => {
    expect(formatIssues([null])).toBe("null");
    expect(formatIssues(["plain string"])).toBe("plain string");
    expect(formatIssues([{}])).toBe("invalid value");
    expect(formatIssues([{ path: ["a"] }])).toBe("a: invalid value");
    expect(formatIssues([{ message: "lonely" }])).toBe("lonely");
  });

  it("returns an empty string for no issues", () => {
    expect(formatIssues([])).toBe("");
  });
});

describe("messageOf", () => {
  it("uses the message of an Error", () => {
    expect(messageOf(new TypeError("Failed to fetch"))).toBe("Failed to fetch");
  });

  it("stringifies anything that is not an Error", () => {
    expect(messageOf("plain")).toBe("plain");
    expect(messageOf(undefined)).toBe("undefined");
    expect(messageOf(null)).toBe("null");
    expect(messageOf(7)).toBe("7");
  });
});

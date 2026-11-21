import { describe, expect, it } from "vitest";

import { MAX_IMPORT_BYTES, readResumeFile } from "@/lib/import-file";
import { emptyResume } from "@/lib/schema";

function jsonFile(body: string, name = "resume.json"): File {
  return new File([body], name, { type: "application/json" });
}

/**
 * A File whose size is the declared one but whose bytes are never produced, so
 * the size check can be proven to happen *before* the content is read.
 */
function oversizeFile(size: number, name = "huge.json"): File {
  const file = jsonFile("{}", name);
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "text", {
    value: () => {
      throw new Error("text() must not be called for an oversize file");
    },
  });
  return file;
}

describe("readResumeFile", () => {
  it("accepts a valid resume", async () => {
    const resume = emptyResume();
    const result = await readResumeFile(jsonFile(JSON.stringify(resume)));
    expect(result).toEqual({ ok: true, resume });
  });

  it("fills schema defaults the file left out", async () => {
    const result = await readResumeFile(
      jsonFile(JSON.stringify({ header: {}, sections: [] })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resume.settings).toEqual({
      pageSize: "letter",
      dateSeparator: "hyphen",
    });
  });

  it("refuses a file larger than the cap without reading its bytes", async () => {
    const result = await readResumeFile(oversizeFile(MAX_IMPORT_BYTES + 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("huge.json");
    expect(result.error).toMatch(/too large/i);
  });

  it("accepts a file exactly at the cap", async () => {
    // Padding inside a string value keeps the JSON valid at any length.
    const resume = emptyResume();
    resume.header.name = "x".repeat(64);
    const body = JSON.stringify(resume);
    const file = jsonFile(body);
    Object.defineProperty(file, "size", { value: MAX_IMPORT_BYTES });
    await expect(readResumeFile(file)).resolves.toEqual({ ok: true, resume });
  });

  it("caps at a size no hand-written resume can reach but a runaway file can", () => {
    expect(MAX_IMPORT_BYTES).toBeGreaterThan(256 * 1024);
    expect(MAX_IMPORT_BYTES).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("reports unreadable JSON by name", async () => {
    const result = await readResumeFile(jsonFile("{ not json", "broken.json"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("broken.json");
    expect(result.error).toMatch(/not readable JSON/i);
  });

  it("reports a document that is not a resume, naming the fields at fault", async () => {
    const result = await readResumeFile(
      jsonFile(JSON.stringify({ header: {}, sections: [{ type: "nope" }] }), "wrong.json"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("wrong.json");
    expect(result.error).toMatch(/not a valid resume/i);
    expect(result.error).toContain("sections.0");
  });

  it("rejects an empty file rather than loading a blank document", async () => {
    const result = await readResumeFile(jsonFile("", "empty.json"));
    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { EXAMPLE_VARIANT, loadExampleResume } from "@/lib/example-resume";

/**
 * "Load example" in the toolbar: the bundled placeholder, loaded on demand so
 * it is not in the editor's first download.
 */
describe("loadExampleResume", () => {
  it("is the John Doe placeholder, validated", async () => {
    const resume = await loadExampleResume();

    expect(resume.header.name).toBe("John Doe");
    expect(resume.header.email).toMatch(/@example\.com$/);
    expect(resume.sections.length).toBeGreaterThan(0);
  });

  it("hands out a fresh copy each time", async () => {
    const first = await loadExampleResume();
    first.header.name = "Changed";

    expect((await loadExampleResume()).header.name).toBe("John Doe");
  });

  it("goes into a variant called example", () => {
    expect(EXAMPLE_VARIANT).toBe("example");
  });
});

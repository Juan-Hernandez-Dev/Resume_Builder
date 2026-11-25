import { describe, expect, it } from "vitest";

import { emptyResume } from "@/lib/schema";

import { InvalidVariantDataError } from "../errors";
import { validatedResume } from "../validate";

/** The one schema check every adapter runs on what it stores and reads. */
describe("validatedResume", () => {
  it("returns the parsed document", () => {
    expect(validatedResume("default", emptyResume())).toEqual(emptyResume());
  });

  it("throws InvalidVariantDataError naming the variant, with flat issues", () => {
    let thrown: unknown;
    try {
      validatedResume("frontend", { header: { name: 42 } });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidVariantDataError);
    const error = thrown as InvalidVariantDataError;
    expect(error.variant).toBe("frontend");
    expect(error.issues).toContainEqual(
      expect.objectContaining({ path: "header.name" }),
    );
  });
});

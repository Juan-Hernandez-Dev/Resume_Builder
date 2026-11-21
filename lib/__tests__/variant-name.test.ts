import { describe, expect, it } from "vitest";

import {
  InvalidVariantNameError,
  assertValidVariantName,
  isValidVariantName,
  sanitizeVariantName,
} from "@/lib/variant-name";

describe("isValidVariantName", () => {
  it("accepts lowercase letters, digits, hyphens and underscores", () => {
    for (const name of ["default", "frontend", "front-end", "front_end", "v2", "a"]) {
      expect(isValidVariantName(name)).toBe(true);
    }
  });

  it("rejects empty, uppercase, spaced and dotted names", () => {
    for (const name of ["", " ", "Default", "front end", "front.end", "résumé"]) {
      expect(isValidVariantName(name)).toBe(false);
    }
  });

  it("rejects path traversal and separators", () => {
    for (const name of [
      "..",
      "../secrets",
      "..\\secrets",
      "nested/default",
      "nested\\default",
      "/etc/passwd",
      "C:\\Windows",
      "default.json",
      "default\u0000",
    ]) {
      expect(isValidVariantName(name)).toBe(false);
    }
  });

  it("rejects names that are not strings", () => {
    expect(isValidVariantName(undefined)).toBe(false);
    expect(isValidVariantName(null)).toBe(false);
    expect(isValidVariantName(42)).toBe(false);
    expect(isValidVariantName(["default"])).toBe(false);
  });
});

describe("sanitizeVariantName", () => {
  it("lowercases and keeps already valid characters", () => {
    expect(sanitizeVariantName("Frontend")).toBe("frontend");
    expect(sanitizeVariantName("front-end_2")).toBe("front-end_2");
  });

  it("replaces spaces and unsupported characters with hyphens", () => {
    expect(sanitizeVariantName("Front End Resume")).toBe("front-end-resume");
    expect(sanitizeVariantName("resume (copy)")).toBe("resume-copy");
    expect(sanitizeVariantName("a//b")).toBe("a-b");
  });

  it("strips accents instead of dropping the letters", () => {
    expect(sanitizeVariantName("Currículum")).toBe("curriculum");
    expect(sanitizeVariantName("José")).toBe("jose");
  });

  it("drops a trailing .json extension", () => {
    expect(sanitizeVariantName("default.json")).toBe("default");
    expect(sanitizeVariantName("Front End.JSON")).toBe("front-end");
  });

  it("collapses repeated separators and trims them from both ends", () => {
    expect(sanitizeVariantName("--front---end--")).toBe("front-end");
    expect(sanitizeVariantName("  spaced  out  ")).toBe("spaced-out");
    expect(sanitizeVariantName("___x___")).toBe("x");
  });

  it("never produces a traversable name", () => {
    expect(sanitizeVariantName("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeVariantName("..")).toBe("");
    expect(sanitizeVariantName("./.")).toBe("");
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(sanitizeVariantName("")).toBe("");
    expect(sanitizeVariantName("!!!")).toBe("");
    expect(sanitizeVariantName("   ")).toBe("");
  });

  it("produces names that pass validation whenever it returns something", () => {
    for (const input of ["Front End", "Currículum 2025", "resume (copy)", "A_B-c"]) {
      const sanitized = sanitizeVariantName(input);
      expect(sanitized).not.toBe("");
      expect(isValidVariantName(sanitized)).toBe(true);
    }
  });
});

describe("assertValidVariantName", () => {
  it("returns the name when it is valid", () => {
    expect(assertValidVariantName("frontend")).toBe("frontend");
  });

  it("throws InvalidVariantNameError when it is not", () => {
    expect(() => assertValidVariantName("../secrets")).toThrow(
      InvalidVariantNameError,
    );
    expect(() => assertValidVariantName("Default")).toThrow(
      /[a-z0-9-_]/,
    );
  });
});

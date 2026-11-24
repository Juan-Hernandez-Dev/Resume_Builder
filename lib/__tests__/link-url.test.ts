import { describe, expect, it } from "vitest";

import { labelToUrl } from "@/lib/link-url";

describe("labelToUrl", () => {
  it("prefixes https:// to a bare domain and path", () => {
    expect(labelToUrl("linkedin.com/in/johndoe")).toBe(
      "https://linkedin.com/in/johndoe",
    );
    expect(labelToUrl("github.com")).toBe("https://github.com");
  });

  it("keeps a label that is already an https URL", () => {
    expect(labelToUrl("https://github.com/johndoe")).toBe(
      "https://github.com/johndoe",
    );
  });

  it("keeps http instead of upgrading it", () => {
    expect(labelToUrl("http://example.com")).toBe("http://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(labelToUrl("  johndoe.dev  ")).toBe("https://johndoe.dev");
    expect(labelToUrl("\thttps://johndoe.dev\n")).toBe("https://johndoe.dev");
  });

  it("turns an email address into a mailto: link", () => {
    expect(labelToUrl("john.doe@example.com")).toBe(
      "mailto:john.doe@example.com",
    );
    expect(labelToUrl(" mailto:john@example.com ")).toBe(
      "mailto:john@example.com",
    );
  });

  it("treats an @ inside a path as a URL, not an email", () => {
    expect(labelToUrl("medium.com/@johndoe")).toBe(
      "https://medium.com/@johndoe",
    );
  });

  it("does not mistake a port for a scheme", () => {
    expect(labelToUrl("example.com:8080/cv")).toBe(
      "https://example.com:8080/cv",
    );
  });

  it("returns an empty string for an empty or blank label", () => {
    expect(labelToUrl("")).toBe("");
    expect(labelToUrl("   ")).toBe("");
  });
});

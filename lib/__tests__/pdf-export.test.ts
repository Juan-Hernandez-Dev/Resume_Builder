import { describe, expect, it } from "vitest";

import {
  contentDisposition,
  isLoopbackHost,
  parsePdfRequest,
  pdfFileName,
  printPageUrl,
} from "@/lib/pdf-export";
import { emptyResume } from "@/lib/schema";

describe("pdfFileName", () => {
  it("joins the name with hyphens and appends Resume", () => {
    expect(pdfFileName("John Doe", "default")).toBe("John-Doe-Resume.pdf");
  });

  it("adds the variant when it is not the default one", () => {
    expect(pdfFileName("John Doe", "frontend")).toBe(
      "John-Doe-Resume-frontend.pdf",
    );
  });

  it("strips accents and characters a file name cannot hold", () => {
    expect(pdfFileName("José Núñez", "default")).toBe("Jose-Nunez-Resume.pdf");
    expect(pdfFileName('A/B\\C:D*E?"F<G>H|', "")).toBe("A-B-C-D-E-F-G-H-Resume.pdf");
    expect(pdfFileName("  Mary-Jane   O'Neil ", "default")).toBe(
      "Mary-Jane-O-Neil-Resume.pdf",
    );
  });

  it("falls back to Resume when there is no usable name", () => {
    expect(pdfFileName("", "default")).toBe("Resume.pdf");
    expect(pdfFileName("!!!", "")).toBe("Resume.pdf");
    expect(pdfFileName("", "frontend")).toBe("Resume-frontend.pdf");
  });

  it("drops a variant that is not a valid variant name", () => {
    expect(pdfFileName("Ada", "../etc")).toBe("Ada-Resume.pdf");
  });
});

describe("contentDisposition", () => {
  it("marks the response as an attachment with the file name", () => {
    expect(contentDisposition("John-Doe-Resume.pdf")).toBe(
      'attachment; filename="John-Doe-Resume.pdf"',
    );
  });
});

describe("parsePdfRequest", () => {
  it("accepts a resume plus the variant it belongs to", () => {
    const resume = emptyResume();
    resume.header.name = "Ada";
    resume.settings.pageSize = "a4";

    const parsed = parsePdfRequest({ resume, variant: "frontend" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.variant).toBe("frontend");
      expect(parsed.data.resume.header.name).toBe("Ada");
      expect(parsed.data.resume.settings.pageSize).toBe("a4");
    }
  });

  it("defaults the variant to an empty string", () => {
    const parsed = parsePdfRequest({ resume: emptyResume() });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.variant).toBe("");
  });

  it("rejects a body whose resume does not match the schema", () => {
    const parsed = parsePdfRequest({ resume: { header: 42 } });
    expect(parsed.success).toBe(false);
  });

  it("rejects a body that is not an object", () => {
    expect(parsePdfRequest("resume").success).toBe(false);
    expect(parsePdfRequest(null).success).toBe(false);
  });
});

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

describe("printPageUrl", () => {
  it("points at /print on the server's own origin", () => {
    expect(printPageUrl(new URL("http://127.0.0.1:3000/api/pdf"), "abc")).toBe(
      "http://127.0.0.1:3000/print?token=abc",
    );
  });

  it("replaces a wildcard bind address with loopback", () => {
    expect(printPageUrl(new URL("http://0.0.0.0:3000/api/pdf"), "abc")).toBe(
      "http://127.0.0.1:3000/print?token=abc",
    );
    expect(printPageUrl(new URL("http://[::]:3000/api/pdf"), "abc")).toBe(
      "http://[::1]:3000/print?token=abc",
    );
  });

  it("encodes the token", () => {
    expect(
      printPageUrl(new URL("http://localhost:3000/"), "a&b=c"),
    ).toBe("http://localhost:3000/print?token=a%26b%3Dc");
  });
});

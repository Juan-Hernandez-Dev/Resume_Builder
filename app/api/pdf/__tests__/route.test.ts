import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveChrome } from "@/lib/chrome-path";
import { MAX_IMPORT_BYTES } from "@/lib/import-file";
import { BROWSER_NOT_FOUND, isLoopbackHost } from "@/lib/pdf-export";
import { renderPdf } from "@/lib/pdf-render";
import { getPrintJob } from "@/lib/print-store";
import { emptyResume, type Resume } from "@/lib/schema";

import { POST } from "../route";

/**
 * POST /api/pdf with the browser mocked out: the guards, the status codes and
 * the print job's lifetime, without launching Chrome. renderPdf itself is
 * covered in lib/__tests__/pdf-render.test.ts.
 */

vi.mock("@/lib/chrome-path", () => ({ resolveChrome: vi.fn() }));
vi.mock("@/lib/pdf-render", () => ({ renderPdf: vi.fn() }));

const resolveChromeMock = vi.mocked(resolveChrome);
const renderPdfMock = vi.mocked(renderPdf);

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

function seedResume(): Resume {
  const resume = emptyResume();
  resume.header.name = "John Doe";
  return resume;
}

function pdfRequest({
  body = JSON.stringify({ resume: seedResume(), variant: "frontend" }),
  contentType = "application/json",
  host = "127.0.0.1:3000",
}: { body?: string; contentType?: string; host?: string } = {}): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/pdf", {
    method: "POST",
    headers: { "content-type": contentType, host },
    body,
  });
}

/** Lets renderPdf open the page, so the route stores its print job. */
function renderStoring(
  seen: { url?: string; tokenAlive?: boolean },
  outcome: () => Promise<Uint8Array>,
) {
  renderPdfMock.mockImplementation(async ({ url }) => {
    seen.url = url();
    const token = new URL(seen.url).searchParams.get("token");
    seen.tokenAlive = getPrintJob(token) !== null;
    return outcome();
  });
}

function tokenOf(url: string | undefined): string | null {
  return url ? new URL(url).searchParams.get("token") : null;
}

beforeEach(() => {
  resolveChromeMock.mockReturnValue({ ok: true, path: "/usr/bin/chrome" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resolveChromeMock.mockReset();
  renderPdfMock.mockReset();
});

describe("POST /api/pdf", () => {
  it("answers 415 to a body that is not sent as JSON", async () => {
    const response = await POST(pdfRequest({ contentType: "text/plain" }));
    expect(response.status).toBe(415);
    expect(renderPdfMock).not.toHaveBeenCalled();
  });

  it("answers 403 to a request not addressed to this machine", async () => {
    const response = await POST(pdfRequest({ host: "attacker.example" }));
    expect(response.status).toBe(403);
    expect(renderPdfMock).not.toHaveBeenCalled();
  });

  it("answers 400 to a body that is not JSON", async () => {
    const response = await POST(pdfRequest({ body: "{" }));
    expect(response.status).toBe(400);
  });

  it("answers 400 with the issues to a body that is not a resume", async () => {
    const response = await POST(
      pdfRequest({ body: JSON.stringify({ resume: 5 }) }),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { issues?: unknown[] };
    expect(payload.issues?.length).toBeGreaterThan(0);
  });

  it("answers 413 to a body over the import size cap, counted in bytes", async () => {
    // Two UTF-8 bytes per character: under the cap in characters, over it
    // in bytes.
    const variant = "é".repeat(MAX_IMPORT_BYTES / 2 + 1);
    const body = JSON.stringify({ resume: seedResume(), variant });
    expect(body.length).toBeLessThan(MAX_IMPORT_BYTES);

    const response = await POST(pdfRequest({ body }));

    expect(response.status).toBe(413);
    expect(resolveChromeMock).not.toHaveBeenCalled();
    expect(renderPdfMock).not.toHaveBeenCalled();
  });

  it("answers 503 with the browser-not-found code when there is no browser", async () => {
    resolveChromeMock.mockReturnValue({ ok: false, error: "No browser." });

    const response = await POST(pdfRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "No browser.",
      code: BROWSER_NOT_FOUND,
    });
    expect(renderPdfMock).not.toHaveBeenCalled();
  });

  it("answers 500 when the browser fails, and deletes the print job", async () => {
    const seen: { url?: string; tokenAlive?: boolean } = {};
    renderStoring(seen, () => Promise.reject(new Error("Chrome crashed")));

    const response = await POST(pdfRequest());

    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: string };
    // The browser's own error stays in the server log.
    expect(payload.error).not.toContain("Chrome crashed");
    expect(seen.tokenAlive).toBe(true);
    expect(getPrintJob(tokenOf(seen.url))).toBeNull();
  });

  it("returns the PDF as a download and deletes the print job", async () => {
    const seen: { url?: string; tokenAlive?: boolean } = {};
    renderStoring(seen, () => Promise.resolve(PDF));

    const response = await POST(pdfRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="John-Doe-Resume-frontend.pdf"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);

    expect(renderPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({ executablePath: "/usr/bin/chrome" }),
    );
    // Back to this server. NextURL spells a loopback address as `localhost`.
    const url = new URL(seen.url ?? "");
    expect(isLoopbackHost(url.host)).toBe(true);
    expect(url.port).toBe("3000");
    expect(url.pathname).toBe("/print");
    expect(seen.tokenAlive).toBe(true);
    expect(getPrintJob(tokenOf(seen.url))).toBeNull();
  });
});

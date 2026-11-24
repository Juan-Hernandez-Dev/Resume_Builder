import { NextResponse, type NextRequest } from "next/server";

import { resolveChrome } from "@/lib/chrome-path";
import { MAX_IMPORT_BYTES } from "@/lib/import-file";
import {
  BROWSER_NOT_FOUND,
  contentDisposition,
  isLoopbackHost,
  parsePdfRequest,
  pdfFileName,
  printPageUrl,
} from "@/lib/pdf-export";
import { renderPdf } from "@/lib/pdf-render";
import { deletePrintJob, putPrintJob } from "@/lib/print-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/pdf -> the document in the body, printed to PDF and returned as a
 * download.
 *
 * The body is the editor's current document, not the file on disk, so unsaved
 * edits are in the PDF. It is parked in the in-memory print store under a
 * random token and headless Chrome is pointed at `/print?token=...` on this
 * same server, which renders the page with the real components and CSS. The
 * job is deleted as soon as Chrome is done, whatever happened.
 *
 * Two guards, because this route launches a browser:
 *
 * - The body must be sent as `application/json`. A cross-site page cannot do
 *   that without a CORS preflight, which this route never answers, so another
 *   tab cannot make the machine start Chrome.
 * - The `Host` header must be a loopback name (see `isLoopbackHost`), which
 *   turns away DNS-rebinding pages and other devices on the network. Chrome
 *   itself is always sent to the address this server is bound to, never to
 *   whatever `Host` claims.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Request body must be sent as application/json." },
      { status: 415 },
    );
  }

  if (!isLoopbackHost(request.headers.get("host"))) {
    return NextResponse.json(
      { error: "PDF export only works when the app is opened on this machine." },
      { status: 403 },
    );
  }

  // Measured in bytes, the unit of the cap; a string's length counts UTF-16
  // code units, which undercounts anything outside ASCII.
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "Request body is too large to be a resume." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parsePdfRequest(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid resume.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { resume, variant } = parsed.data;

  const chrome = resolveChrome();
  if (!chrome.ok) {
    // 503 with a code the client recognizes: the fix is installing a browser
    // (or setting CHROME_PATH), and the editor says so in those words.
    return NextResponse.json(
      { error: chrome.error, code: BROWSER_NOT_FOUND },
      { status: 503 },
    );
  }

  let token: string | null = null;
  let pdf: Uint8Array;
  try {
    pdf = await renderPdf({
      executablePath: chrome.path,
      // Called once Chrome is up, so a slow launch cannot use up the job's
      // time to live before the page is even requested.
      url: () => {
        token = putPrintJob(resume);
        return printPageUrl(request.nextUrl, token);
      },
    });
  } catch (error) {
    // The details (browser output, executable path) go to the server log only.
    console.error("PDF export failed:", error);
    return NextResponse.json(
      {
        error:
          "Chrome could not render the PDF. Check the terminal running the app for details.",
      },
      { status: 500 },
    );
  } finally {
    if (token !== null) deletePrintJob(token);
  }

  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>]), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": contentDisposition(
        pdfFileName(resume.header.name, variant),
      ),
      "cache-control": "no-store",
    },
  });
}

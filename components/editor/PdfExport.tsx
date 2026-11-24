"use client";

import { useState } from "react";

import { describeFailure, messageOf } from "@/lib/api-response";
import {
  BROWSER_NOT_FOUND,
  BROWSER_NOT_FOUND_MESSAGE,
  pdfFileName,
} from "@/lib/pdf-export";
import type { Resume } from "@/lib/schema";

import { Button } from "./ui/Button";

const FALLBACK = "Could not export the PDF.";

/**
 * Export PDF: the server renders the document on screen with headless Chrome
 * and the file is downloaded straight away, with no print dialog and none of
 * the dialog's own headers and footers.
 *
 * When that cannot work, the failure is shown right here and the print dialog
 * becomes an explicit second choice ("Print instead") rather than something
 * that opens on its own. A missing browser gets its own wording, because the
 * fix is to install one, not to try again.
 */
export function PdfExport({
  resume,
  variant,
}: {
  resume: Resume;
  variant: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function exportPdf() {
    setExporting(true);
    setFailure(null);
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resume, variant }),
      });
      if (!response.ok) {
        setFailure(await describeExportFailure(response));
        return;
      }
      const blob = await response.blob();
      download(
        blob,
        fileNameFrom(response) ?? pdfFileName(resume.header.name, variant),
      );
    } catch (cause) {
      setFailure(`Could not export the PDF: ${messageOf(cause)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => void exportPdf()}
        disabled={exporting}
        aria-busy={exporting}
      >
        {exporting ? "Exporting…" : "Export PDF"}
      </Button>

      {failure === null ? null : (
        <div
          role="alert"
          className="flex max-w-[26rem] items-start gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] leading-tight text-amber-900"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <p>{failure}</p>
            <p className="text-amber-800/80">
              Chrome: Print &gt; Save as PDF, Margins: None, Background graphics
              off, Headers and footers off.
            </p>
          </div>
          <Button onClick={() => window.print()}>Print instead</Button>
        </div>
      )}
    </div>
  );
}

/** One line for the notice; a missing browser always says how to fix it. */
async function describeExportFailure(response: Response): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    payload = null;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { code?: unknown }).code === BROWSER_NOT_FOUND
  ) {
    const { error } = payload as { error?: unknown };
    return typeof error === "string" && error !== ""
      ? error
      : BROWSER_NOT_FOUND_MESSAGE;
  }
  return describeFailure(response, FALLBACK);
}

/** The name from `Content-Disposition`, which the server sanitized already. */
function fileNameFrom(response: Response): string | null {
  const header = response.headers.get("content-disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? null;
}

/** How long the file's object URL outlives the click that downloads it. */
const REVOKE_DELAY_MS = 1000;

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  // Some browsers ignore a click on a link that is not in the document.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // The download starts after the click returns; revoking the URL right away
  // can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

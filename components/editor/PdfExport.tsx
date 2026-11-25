"use client";

import { usePlatform } from "@/components/platform/PlatformProvider";
import type { Resume } from "@/lib/schema";

import { DirectPdfExport } from "./DirectPdfExport";
import { PrintHint } from "./PrintHint";
import { Button } from "./ui/Button";

/**
 * Export PDF, as the platform does it.
 *
 * Locally the server prints the document with headless Chrome and the file
 * downloads straight away (DirectPdfExport). The web build has no server to
 * render on, so there Export PDF is the print dialog, with the settings that
 * make it match the preview spelled out next to the button.
 */
export function PdfExport({
  resume,
  variant,
}: {
  resume: Resume;
  variant: string;
}) {
  const { pdf } = usePlatform();

  if (pdf === "direct") {
    return <DirectPdfExport resume={resume} variant={variant} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => window.print()}>Export PDF</Button>
      <PrintHint className="max-w-[17rem] text-[11px] leading-tight text-neutral-500" />
    </div>
  );
}

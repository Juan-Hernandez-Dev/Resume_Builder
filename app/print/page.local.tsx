import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResumePage } from "@/components/resume/ResumePage";
import { getPrintJob } from "@/lib/print-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resume",
  robots: { index: false, follow: false },
};

/**
 * The page headless Chrome prints for POST /api/pdf: the resume page and
 * nothing else, rendered by the same component and stylesheets as the
 * preview, so the PDF is the preview.
 *
 * The document comes from the in-memory print store (lib/print-store.ts),
 * never from disk, which is how unsaved edits make it into the PDF. Without a
 * live token there is nothing to show, so it is a 404. There is no editor
 * here, so the page renders without the inline-edit provider: plain document,
 * no edit chrome.
 */
export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;
  const resume = getPrintJob(token);
  if (resume === null) notFound();

  return <ResumePage resume={resume} />;
}

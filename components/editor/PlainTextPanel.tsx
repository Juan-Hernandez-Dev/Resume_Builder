"use client";

import { useState } from "react";

import { Button } from "./ui/Button";
import { CopyIcon } from "./ui/Icons";

/**
 * The resume as an ATS reads it. Never printed: the printed output is always
 * the rendered page.
 */
export function PlainTextPanel({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="no-print mx-auto max-w-[8.5in]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-neutral-600">
          Reading order, line breaks and visibility match the page.
        </span>
        <Button onClick={() => void copy()}>
          <CopyIcon />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-neutral-300 bg-white p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-neutral-900">
        {text}
      </pre>
    </div>
  );
}

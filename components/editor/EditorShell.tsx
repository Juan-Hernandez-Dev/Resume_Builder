"use client";

import { useState, type ReactNode } from "react";

import { NO_OVERFLOW, type Overflow } from "@/lib/overflow";
import type { Resume } from "@/lib/schema";

import { EditorPanel } from "./EditorPanel";
import { PreviewPane } from "./PreviewPane";
import { TopBar } from "./TopBar";
import { Button } from "./ui/Button";
import { useResumeEditor } from "./useResumeEditor";

/**
 * The two-pane editor: scrollable forms on the left, live page on the right.
 *
 * Everything outside the resume page carries `.no-print`, so printing this
 * screen produces the document and nothing else.
 *
 * `notice` is a line under the toolbar for whatever the page around the editor
 * needs said, such as where the web build keeps the resumes.
 */
export function EditorShell({
  initialVariant,
  initialResume,
  variants,
  notice,
}: {
  initialVariant: string;
  initialResume: Resume;
  variants: string[];
  notice?: ReactNode;
}) {
  const editor = useResumeEditor({
    initialVariant,
    initialResume,
    initialVariants: variants,
  });
  // Measured by the preview, displayed by the toolbar.
  const [overflow, setOverflow] = useState<Overflow>(NO_OVERFLOW);

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden">
      <TopBar editor={editor} overflow={overflow} />
      {notice}

      {editor.error === null ? null : (
        <div
          role="alert"
          className="no-print flex shrink-0 items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900"
        >
          <span className="min-w-0 flex-1">{editor.error}</span>
          <Button onClick={editor.dismissError}>Dismiss</Button>
        </div>
      )}

      <div className="app-panes flex min-h-0 flex-1">
        <section
          aria-label="Resume editor"
          className="no-print w-[clamp(26rem,40%,38rem)] shrink-0 overflow-y-auto border-r border-neutral-400/60 bg-neutral-100 p-4"
        >
          <EditorPanel editor={editor} />
        </section>

        <PreviewPane editor={editor} onOverflowChange={setOverflow} />
      </div>
    </div>
  );
}

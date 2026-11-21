"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { InlineEditProvider } from "@/components/resume/inline-edit";
import { ResumePage } from "@/components/resume/ResumePage";
import { ResumeScaler } from "@/components/resume/ResumeScaler";
import { measureOverflow, type Overflow } from "@/lib/overflow";
import { toPlainText } from "@/lib/plain-text";

import { PlainTextPanel } from "./PlainTextPanel";
import { useInlineEditApi } from "./useInlineEditApi";
import type { ResumeEditor } from "./useResumeEditor";

type Tab = "preview" | "plain";

/* The store behind the hydration check below: it never changes, so there is
   nothing to subscribe to and the two snapshots are constants. */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The right pane: the real-size page, scaled to fit, plus the plain-text view.
 *
 * The page is never unmounted. While the Plain text tab is showing it is moved
 * off screen instead of hidden, so the overflow measurement keeps running and
 * printing still produces the page from either tab (app/print.css puts it back
 * in flow for print).
 *
 * It takes the whole editor rather than just the document because the page is
 * editable in place: the same actions the left-hand panel calls are handed to
 * the rendered page through the inline-edit provider.
 */
export function PreviewPane({
  editor,
  onOverflowChange,
}: {
  editor: ResumeEditor;
  /** Must be stable; the measuring effect depends on it. */
  onOverflowChange: (overflow: Overflow) => void;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  /**
   * The toggle's own state. Plain `useState` and never storage: this subtree is
   * server rendered and then hydrated, so a value read from the browser would
   * be a hydration mismatch. Persisting it would have to happen after mount.
   */
  const [editOnPage, setEditOnPage] = useState(true);
  /**
   * Whether this is the client. An editable field fills itself imperatively
   * (see Editable), which cannot happen on the server, so editing stays off for
   * the server render and the hydration that matches it: the first paint is the
   * finished document rather than a page of empty fields.
   *
   * A store with two snapshots rather than an effect, because this is exactly
   * the "React and the platform disagree" case `useSyncExternalStore` exists
   * for, and setting state from an effect to find out would cascade a render.
   */
  const hydrated = useSyncExternalStore(subscribeNever, onClient, onServer);
  const hostRef = useRef<HTMLDivElement>(null);

  // Editing belongs to the Preview tab only; the plain-text view is a
  // read-only rendering of the same document.
  const api = useInlineEditApi(
    editor,
    editOnPage && hydrated && tab === "preview",
  );

  // Measures the real page box. offsetHeight ignores the scaler's transform,
  // and min-height resolves --resume-page-height to pixels for us.
  useEffect(() => {
    const page = hostRef.current?.querySelector<HTMLElement>(".resume-page");
    if (!page) return;

    const measure = () => {
      const pageHeight = Number.parseFloat(
        window.getComputedStyle(page).minHeight,
      );
      onOverflowChange(measureOverflow(page.offsetHeight, pageHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [onOverflowChange]);

  const offscreen = tab !== "preview";

  return (
    <div className="preview-pane flex min-h-0 flex-1 flex-col">
      <div className="no-print flex shrink-0 items-center gap-1 border-b border-neutral-400/60 bg-neutral-200 px-4 py-1.5">
        {/* The toggle is a button, not a tab, so it stays outside the tablist
            rather than being announced as a third tab. */}
        <div role="tablist" aria-label="Preview mode" className="flex gap-1">
          <TabButton
            id="preview-tab-page"
            controls="preview-panel-page"
            active={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            Preview
          </TabButton>
          <TabButton
            id="preview-tab-plain"
            controls="preview-panel-plain"
            active={tab === "plain"}
            onClick={() => setTab("plain")}
          >
            Plain text
          </TabButton>
        </div>

        <button
          type="button"
          aria-pressed={editOnPage}
          onClick={() => setEditOnPage((current) => !current)}
          className={`ml-auto rounded px-3 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
            editOnPage
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Edit on page
        </button>
      </div>

      <div className="preview-pane__body relative min-h-0 flex-1 overflow-y-auto p-6">
        <div
          ref={hostRef}
          id="preview-panel-page"
          role="tabpanel"
          aria-labelledby="preview-tab-page"
          aria-hidden={offscreen}
          // Parked off screen rather than hidden: keeps the links and inputs
          // inside it out of the tab order while it is not the active tab.
          inert={offscreen}
          className={offscreen ? "preview-panel--offscreen" : undefined}
        >
          <ResumeScaler>
            <InlineEditProvider value={api}>
              <ResumePage resume={editor.resume} />
            </InlineEditProvider>
          </ResumeScaler>
        </div>

        {tab === "plain" ? (
          // `no-print` belongs on this wrapper, not only on the panel inside
          // it: the resume page is a named print page (`page: resume-letter`),
          // so any box that still prints after it forces a page break and a
          // blank trailing sheet — even an empty one around a hidden child.
          <div
            id="preview-panel-plain"
            role="tabpanel"
            aria-labelledby="preview-tab-plain"
            className="no-print"
          >
            <PlainTextPanel text={toPlainText(editor.resume)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  id,
  controls,
  active,
  onClick,
  children,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-controls={controls}
      aria-selected={active}
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        active
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

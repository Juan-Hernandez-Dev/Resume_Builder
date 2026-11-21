import type { ReactNode } from "react";

import { ChevronIcon } from "./Icons";

/**
 * A card with a header row (drag handle, collapse toggle, title, actions) and a
 * body that is only mounted while open. Whether a card is open is local UI
 * state in the calling component and is never written to the resume JSON.
 */
export function CollapsibleCard({
  open,
  onOpenChange,
  handle,
  title,
  actions,
  dimmed = false,
  nested = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drag handle element, rendered first in the header row. */
  handle?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  /** Hidden sections and entries are rendered faded. */
  dimmed?: boolean;
  /** Nested cards (entries inside a section) sit on a lighter surface. */
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md border ${
        nested
          ? "border-neutral-200 bg-neutral-50"
          : "border-neutral-300 bg-white shadow-sm"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        {handle}
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          <ChevronIcon open={open} />
        </button>
        <div className="min-w-0 flex-1">{title}</div>
        {actions ? <div className="flex items-center gap-0.5">{actions}</div> : null}
      </div>
      {open ? (
        <div className="border-t border-neutral-200 px-3 py-3">{children}</div>
      ) : null}
    </div>
  );
}

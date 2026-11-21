"use client";

import { useState, type ReactNode } from "react";

import { CollapsibleCard } from "./ui/CollapsibleCard";
import { DragHandle } from "./ui/DragHandle";
import { IconButton } from "./ui/IconButton";
import { EyeIcon, EyeOffIcon, TrashIcon } from "./ui/Icons";
import type { SortableHandle } from "./ui/SortableList";

/**
 * Collapsible card around one entry form: drag handle, summary line, hide and
 * delete. A brand-new entry has nothing to summarize, so it starts expanded.
 */
export function EntryCard({
  handle,
  summary,
  noun,
  visible,
  onToggleVisible,
  onRemove,
  children,
}: {
  handle: SortableHandle;
  /** Derived from the entry's own fields; empty for a new entry. */
  summary: string;
  /** What this entry is called in labels, for example "achievement". */
  noun: string;
  visible: boolean;
  onToggleVisible: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(summary === "");

  function handleRemove() {
    if (summary !== "" && !window.confirm(`Delete "${summary}"?`)) return;
    onRemove();
  }

  return (
    <CollapsibleCard
      nested
      dimmed={!visible}
      open={open}
      onOpenChange={setOpen}
      handle={<DragHandle handle={handle} label={`Reorder ${noun}`} />}
      title={
        <span
          className={`block truncate px-1 text-sm ${
            summary === "" ? "text-neutral-400 italic" : "text-neutral-800"
          }`}
        >
          {summary === "" ? `Untitled ${noun}` : summary}
        </span>
      }
      actions={
        <>
          <IconButton
            label={visible ? `Hide ${noun}` : `Show ${noun}`}
            pressed={!visible}
            onClick={onToggleVisible}
          >
            {visible ? <EyeIcon /> : <EyeOffIcon />}
          </IconButton>
          <IconButton label={`Delete ${noun}`} danger onClick={handleRemove}>
            <TrashIcon />
          </IconButton>
        </>
      }
    >
      {children}
    </CollapsibleCard>
  );
}

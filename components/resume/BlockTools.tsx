"use client";

import { IconButton } from "@/components/editor/ui/IconButton";
import {
  ChevronIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/editor/ui/Icons";

import { useInlineEdit } from "./inline-edit";

/**
 * The structural controls for one entry block, shown on hover over the block.
 *
 * It is absolutely positioned and therefore out of flow, which is the whole
 * point: the overflow meter measures the real page height, so a control that
 * took up space would change how many pages the document claims to be. It also
 * lives inside the scaled page, so it shrinks with the preview — countering
 * that would mean pixel math against a transform, which is exactly what the
 * caret code avoids too.
 */
export function BlockTools({
  sectionId,
  entryId,
  index,
  count,
  visible,
}: {
  sectionId: string;
  entryId: string;
  /** Index in the *stored* entry array, which is what moveEntry addresses. */
  index: number;
  count: number;
  visible: boolean;
}) {
  const api = useInlineEdit();
  if (api === null || !api.enabled) return null;

  return (
    // A span, not a div: the skills block puts these inside a <p>, where only
    // phrasing content is valid markup.
    <span className="no-print" data-inline-tools="">
      <IconButton
        label="Add entry below"
        onClick={() => api.addEntryAfter(sectionId, entryId)}
      >
        <PlusIcon />
      </IconButton>
      <IconButton
        label="Move up"
        disabled={index === 0}
        onClick={() => api.moveEntry(sectionId, index, index - 1)}
      >
        {/* The shared chevron points right, and `open` turns it down; a
            quarter turn the other way is the only way to get an up arrow out
            of it without adding a second icon. */}
        <span className="inline-flex -rotate-90">
          <ChevronIcon open={false} />
        </span>
      </IconButton>
      <IconButton
        label="Move down"
        disabled={index === count - 1}
        onClick={() => api.moveEntry(sectionId, index, index + 1)}
      >
        <ChevronIcon open />
      </IconButton>
      <IconButton
        label={visible ? "Hide entry" : "Show entry"}
        pressed={!visible}
        onClick={() => api.toggleEntryVisible(sectionId, entryId)}
      >
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </IconButton>
      <IconButton
        label="Delete entry"
        danger
        onClick={() => {
          // There is no undo anywhere in this app, and the page is autosaved a
          // second later, so a mis-click here is unrecoverable.
          if (window.confirm("Delete this entry? This cannot be undone.")) {
            api.removeEntry(sectionId, entryId);
          }
        }}
      >
        <TrashIcon />
      </IconButton>
    </span>
  );
}

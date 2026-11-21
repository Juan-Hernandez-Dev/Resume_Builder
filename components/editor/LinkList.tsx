"use client";

import type { ResumeLink } from "@/lib/schema";

import { Button } from "./ui/Button";
import { DragHandle } from "./ui/DragHandle";
import { IconButton } from "./ui/IconButton";
import { PlusIcon, TrashIcon } from "./ui/Icons";
import { SortableItem, SortableList } from "./ui/SortableList";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/**
 * The header's contact links. Like bullets they have no ids, so the dnd id is
 * the index and every move is an index move.
 */
export function LinkList({
  links,
  editor,
}: {
  links: ResumeLink[];
  editor: ResumeEditor;
}) {
  const ids = links.map((_, index) => `link:${index}`);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
          Links
        </span>
        <Button onClick={editor.addLink}>
          <PlusIcon />
          Add link
        </Button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-neutral-500">No links yet.</p>
      ) : (
        <SortableList id="header-links" ids={ids} onMove={editor.moveLink}>
          <div className="space-y-1.5">
            {links.map((link, index) => (
              <SortableItem key={ids[index]} id={ids[index]}>
                {(handle) => (
                  <div className="flex items-center gap-1 rounded border border-neutral-200 bg-white p-1">
                    <DragHandle
                      handle={handle}
                      label={`Reorder link ${index + 1}`}
                    />
                    <TextInput
                      value={link.label}
                      aria-label={`Link ${index + 1} label`}
                      placeholder="LinkedIn"
                      className="w-32 shrink-0"
                      onChange={(event) =>
                        editor.updateLink(index, { label: event.target.value })
                      }
                    />
                    <TextInput
                      value={link.url}
                      aria-label={`Link ${index + 1} URL`}
                      placeholder="https://www.linkedin.com/in/handle"
                      onChange={(event) =>
                        editor.updateLink(index, { url: event.target.value })
                      }
                    />
                    <IconButton
                      label={`Delete link ${index + 1}`}
                      danger
                      onClick={() => editor.removeLink(index)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                )}
              </SortableItem>
            ))}
          </div>
        </SortableList>
      )}
    </div>
  );
}

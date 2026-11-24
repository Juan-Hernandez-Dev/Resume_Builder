"use client";

import { labelToUrl } from "@/lib/link-url";
import type { ResumeLink } from "@/lib/schema";

import { Button } from "./ui/Button";
import { DragHandle } from "./ui/DragHandle";
import { Field } from "./ui/Field";
import { IconButton } from "./ui/IconButton";
import { LinkIcon, PlusIcon, TrashIcon } from "./ui/Icons";
import { SortableItem, SortableList } from "./ui/SortableList";
import { TextInput } from "./ui/TextInput";
import type { ResumeEditor } from "./useResumeEditor";

/** The only editor actions the list calls, so it can be tested on its own. */
export type LinkListEditor = Pick<
  ResumeEditor,
  "addLink" | "updateLink" | "removeLink" | "moveLink"
>;

/**
 * The header's contact links. Like bullets they have no ids, so the dnd id is
 * the index and every move is an index move.
 *
 * Each row stacks its two fields rather than putting them side by side: the
 * editor panel is too narrow for a label and a full URL on one line, and an
 * input in a flex row will not shrink below its intrinsic width, which is how
 * the URL field used to end up past the card's right edge.
 *
 * The label is what prints; the URL is only the hyperlink target. The button
 * next to the URL copies the label across (see lib/link-url.ts), because the
 * label is so often the address itself.
 */
export function LinkList({
  links,
  editor,
}: {
  links: ResumeLink[];
  editor: LinkListEditor;
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
                  <div className="flex items-start gap-1 rounded border border-neutral-200 bg-white p-1.5">
                    <DragHandle
                      handle={handle}
                      label={`Reorder link ${index + 1}`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Field label="Display label">
                        <TextInput
                          value={link.label}
                          aria-label={`Link ${index + 1} label`}
                          placeholder="linkedin.com/in/johndoe"
                          className="min-w-0"
                          onChange={(event) =>
                            editor.updateLink(index, {
                              label: event.target.value,
                            })
                          }
                        />
                      </Field>
                      {/* The button sits beside the field, not inside its
                          <label>: a label may only hold the one control it
                          names. */}
                      <div className="flex items-end gap-1">
                        <div className="min-w-0 flex-1">
                          <Field label="Link URL">
                            <TextInput
                              value={link.url}
                              aria-label={`Link ${index + 1} URL`}
                              placeholder="https://www.linkedin.com/in/johndoe"
                              className="min-w-0"
                              onChange={(event) =>
                                editor.updateLink(index, {
                                  url: event.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                        <IconButton
                          label={`Use link ${index + 1} label as URL`}
                          disabled={link.label.trim() === ""}
                          className="mb-0.5"
                          onClick={() =>
                            editor.updateLink(index, {
                              url: labelToUrl(link.label),
                            })
                          }
                        >
                          <LinkIcon />
                        </IconButton>
                      </div>
                    </div>
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

"use client";

import type { ExperienceEntry } from "@/lib/schema";

import { Button } from "./ui/Button";
import { DragHandle } from "./ui/DragHandle";
import { IconButton } from "./ui/IconButton";
import { PlusIcon, TrashIcon } from "./ui/Icons";
import { SortableItem, SortableList } from "./ui/SortableList";
import { TextArea } from "./ui/TextArea";
import type { ResumeEditor } from "./useResumeEditor";

/**
 * Bullets are a plain string[], so they have no ids and no per-bullet
 * visibility: add, edit, delete and reorder only. Their dnd ids are derived
 * from the entry id plus the index, and every move is an index move.
 */

/** Bullets above this length get a soft warning. Nothing is ever blocked. */
export const BULLET_SOFT_LIMIT = 140;

export function BulletList({
  sectionId,
  entry,
  editor,
}: {
  sectionId: string;
  entry: ExperienceEntry;
  editor: ResumeEditor;
}) {
  const ids = entry.bullets.map((_, index) => `${entry.id}:${index}`);

  return (
    <div className="mt-1">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
          Bullets
        </span>
        <Button onClick={() => editor.addBullet(sectionId, entry.id)}>
          <PlusIcon />
          Add bullet
        </Button>
      </div>

      {entry.bullets.length === 0 ? (
        <p className="text-xs text-neutral-500">No bullets yet.</p>
      ) : (
        <SortableList
          id={`bullets-${entry.id}`}
          ids={ids}
          onMove={(from, to) => editor.moveBullet(sectionId, entry.id, from, to)}
        >
          <div className="space-y-1.5">
            {entry.bullets.map((bullet, index) => (
              <SortableItem key={ids[index]} id={ids[index]}>
                {(handle) => (
                  <div className="flex items-start gap-1 rounded border border-neutral-200 bg-white p-1">
                    <DragHandle
                      handle={handle}
                      label={`Reorder bullet ${index + 1}`}
                    />
                    <div className="min-w-0 flex-1">
                      <TextArea
                        value={bullet}
                        aria-label={`Bullet ${index + 1}`}
                        placeholder="One result, kept brief."
                        onChange={(event) =>
                          editor.updateBullet(
                            sectionId,
                            entry.id,
                            index,
                            event.target.value,
                          )
                        }
                      />
                      <BulletCounter length={bullet.length} />
                    </div>
                    <IconButton
                      label={`Delete bullet ${index + 1}`}
                      danger
                      onClick={() =>
                        editor.removeBullet(sectionId, entry.id, index)
                      }
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

function BulletCounter({ length }: { length: number }) {
  const over = length > BULLET_SOFT_LIMIT;

  return (
    <span
      className={`mt-0.5 block text-[11px] ${
        over ? "text-amber-700" : "text-neutral-400"
      }`}
    >
      {length}/{BULLET_SOFT_LIMIT}
      {over ? " — long for a bullet, consider trimming" : ""}
    </span>
  );
}

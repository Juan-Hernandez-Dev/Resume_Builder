import { GripIcon } from "./Icons";
import type { SortableHandle } from "./SortableList";

/**
 * The only element that starts a drag, so text inputs inside a sortable row
 * stay usable. Focus it and press space to reorder with the arrow keys.
 */
export function DragHandle({
  handle: { setRef, attributes, listeners },
  label,
}: {
  handle: SortableHandle;
  label: string;
}) {
  return (
    <button
      type="button"
      ref={setRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      title={`${label} (press space, then the arrow keys)`}
      className="inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:cursor-grabbing"
    >
      <GripIcon />
    </button>
  );
}

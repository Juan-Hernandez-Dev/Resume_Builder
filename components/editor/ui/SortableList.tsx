"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

/**
 * The one drag-and-drop wiring in the app, reused for sections, entries,
 * bullets and header links.
 *
 * Dragging is handle-only, so every text input inside a sortable row keeps
 * working, and a KeyboardSensor sits next to the PointerSensor so the lists can
 * be reordered with space + arrow keys.
 */

/** Everything a drag handle needs. Spread onto the handle element. */
export type SortableHandle = {
  /** Not called `ref`: a prop named `ref` reads as a React ref to lint. */
  setRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: ReturnType<typeof useSortable>["listeners"];
};

export function SortableList({
  id,
  ids,
  onMove,
  children,
}: {
  /**
   * A stable id for this list, unique on the page.
   *
   * Required, not optional: without it dnd-kit names its screen-reader
   * instructions from a module counter, which differs between the server and
   * the client render and makes the activator's aria-describedby a hydration
   * mismatch.
   */
  id: string;
  /** Stable dnd ids, in render order. */
  ids: string[];
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    // A few pixels of slop so a click on the handle is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onMove(from, to);
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** One sortable row. Hands its drag handle props to the render function. */
export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (handle: SortableHandle) => ReactNode;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "relative z-10" : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : undefined,
      }}
    >
      {children({ setRef: setActivatorNodeRef, attributes, listeners })}
    </div>
  );
}

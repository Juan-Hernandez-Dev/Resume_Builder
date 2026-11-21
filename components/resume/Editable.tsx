"use client";

import { useEffect, useRef, type ElementType, type KeyboardEvent } from "react";

import {
  targetKey,
  useInlineEdit,
  type CaretPosition,
  type EditTarget,
} from "./inline-edit";

/**
 * One editable piece of text on the rendered page. This is the only primitive:
 * every field on the resume, from the name to a single bullet, is one of these.
 *
 * It is deliberately *uncontrolled*. React never owns the text while the field
 * is being edited, because several fields display something other than what is
 * stored — `formatPeriod` rewrites date separators, `formatItems` joins the
 * skills array with commas — and a controlled contentEditable would rewrite the
 * text under the caret on every keystroke, sending the caret to the end. The
 * text is therefore written imperatively, and only while the field is not the
 * one the user is typing in.
 *
 * With no provider, or with editing turned off, it renders exactly the markup
 * the resume rendered before any of this existed: a tag, a class, and the text.
 */

/** The tags the resume renders text in. */
export type EditableTag = "span" | "p" | "li" | "h1" | "h2" | "a";

export function Editable({
  target,
  value,
  as = "span",
  className,
  placeholder,
  empty,
  onEnter,
  onBackspaceAtStart,
  href,
}: {
  target: EditTarget;
  /** The text as the document *shows* it, which is not always what is stored. */
  value: string;
  as?: EditableTag;
  className?: string;
  placeholder?: string;
  /**
   * Whether this field counts as empty *by the same rule the non-editing render
   * uses*, which is what `data-inline-empty` has to mean for print to come out
   * identical either way.
   *
   * The default is an empty string, the rule behind every `value ? … : null` on
   * the page. Bullets and skills items are filtered with `.trim()` instead, so
   * they pass this explicitly: a bullet holding nothing but a space is dropped
   * by the non-editing render and must not print as a lone bullet dot.
   */
  empty?: boolean;
  /** Enter inside the field, with the caret offset it was pressed at. */
  onEnter?: (caret: number) => void;
  /** Backspace with a collapsed caret at offset 0. */
  onBackspaceAtStart?: () => void;
  href?: string;
}) {
  const api = useInlineEdit();
  const ref = useRef<HTMLElement>(null);
  /** The display text when the field was focused, so Escape can put it back. */
  const restoreRef = useRef(value);
  /** The latest display text, for the handlers that run before a re-render. */
  const valueRef = useRef(value);

  const editing = api !== null && api.enabled;
  const key = targetKey(target);

  // Writes the document's text into the element. Deliberately has no
  // dependency array: a field whose value changed *while it was focused* (Enter
  // splits the bullet the caret sits in) has to be re-synced on the first
  // render after the caret left it, and that render does not change `value`
  // again. The work is one string comparison.
  useEffect(() => {
    valueRef.current = value;

    const el = ref.current;
    if (el === null || !editing) return;
    // The focused field belongs to the user, not to the document.
    if (document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  });

  // Focus handed over by a structural op: Enter split this bullet off the one
  // above, or Backspace merged the one below into it. The request is consumed
  // once, by the single field whose key matches.
  useEffect(() => {
    const el = ref.current;
    if (el === null || api === null || !api.enabled) return;
    if (api.pendingFocus === null || api.pendingFocus.key !== key) return;

    el.focus();
    placeCaret(el, api.pendingFocus.caret);
    api.clearFocus();
  }, [api, key]);

  if (!editing) {
    const Tag = as as ElementType;
    return (
      <Tag className={className} href={as === "a" ? href : undefined}>
        {value}
      </Tag>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const el = ref.current;
    if (el === null || api === null) return;

    if (event.key === "Enter") {
      // A resume field is one line. Either the caller splits the document here
      // or the field is simply done being edited; a <br> is never wanted.
      event.preventDefault();
      if (onEnter === undefined) el.blur();
      else onEnter(caretOffsetIn(el));
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      const restored = restoreRef.current;
      // Both are set before blurring, so the blur handler below agrees with
      // what the field now shows instead of putting the typed text back.
      valueRef.current = restored;
      el.textContent = restored;
      api.commit(target, restored);
      el.blur();
      return;
    }

    if (event.key === "Backspace" && onBackspaceAtStart !== undefined) {
      const selection = window.getSelection();
      if (
        selection !== null &&
        selection.isCollapsed &&
        caretOffsetIn(el) === 0
      ) {
        event.preventDefault();
        onBackspaceAtStart();
      }
    }
  };

  const Tag = as as ElementType;
  return (
    <Tag
      // Changing the key remounts the element when editing is switched off, so
      // the imperatively written text goes away with it and React starts from a
      // clean node instead of appending its own text node next to ours.
      key="inline-edit"
      ref={ref}
      className={className}
      href={as === "a" ? href : undefined}
      // Not plain `true`: "plaintext-only" is what stops a rich-text paste from
      // injecting <b>/<span> into the printed document.
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-inline-edit=""
      data-placeholder={placeholder}
      data-inline-empty={(empty ?? value === "") ? "true" : undefined}
      onInput={() => {
        const el = ref.current;
        if (el === null || api === null) return;
        // No debounce: the editor's own autosave is already debounced.
        api.commit(target, el.textContent ?? "");
      }}
      onFocus={() => {
        restoreRef.current = valueRef.current;
      }}
      onBlur={() => {
        const el = ref.current;
        if (el === null) return;
        // The display string can differ from the typed one (formatPeriod,
        // formatItems). Re-reading it here is what makes the formatter reappear
        // as soon as the field is left, rather than on an unrelated render.
        if (el.textContent !== valueRef.current) {
          el.textContent = valueRef.current;
        }
      }}
      // A link on the page is still a link; while editing, clicking it has to
      // place the caret instead of navigating away from the editor.
      onClick={as === "a" ? preventNavigation : undefined}
      onKeyDown={handleKeyDown}
    />
  );
}

function preventNavigation(event: { preventDefault: () => void }) {
  event.preventDefault();
}

/* -------------------------------------------------------------------------- */
/* Caret arithmetic                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The caret's offset in characters from the start of `el`.
 *
 * Measured with a Range rather than from coordinates on purpose: the page sits
 * inside a CSS `transform: scale()` (ResumeScaler), and Selection/Range work in
 * document space while any pixel math would be off by the scale factor. The
 * range is also not assumed to live in a single text node, because a spell
 * checker or the browser's own editing can split one.
 */
export function caretOffsetIn(el: HTMLElement): number {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return 0;

  const measure = document.createRange();
  measure.selectNodeContents(el);
  try {
    const range = selection.getRangeAt(0);
    measure.setEnd(range.endContainer, range.endOffset);
  } catch {
    // The selection is not inside this element at all.
    return 0;
  }
  return measure.toString().length;
}

/** Puts the caret at `caret` inside `el`, counting characters from the start. */
export function placeCaret(el: HTMLElement, caret: CaretPosition): void {
  const selection = window.getSelection();
  if (selection === null) return;

  const range = document.createRange();
  range.selectNodeContents(el);

  if (caret === "start") {
    range.collapse(true);
  } else if (caret === "end") {
    range.collapse(false);
  } else {
    const point = textPointAt(el, caret);
    if (point === null) {
      // No text at all: collapsing inside the empty element is the only place
      // the caret can go.
      range.collapse(true);
    } else {
      range.setStart(point.node, point.offset);
      range.collapse(true);
    }
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

/** Walks the text nodes of `el` to turn a character offset into a DOM point. */
function textPointAt(
  el: HTMLElement,
  offset: number,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(offset, 0);
  let last: Node | null = null;

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
    last = node;
  }

  // Past the end: the last position in the text is the closest honest answer.
  if (last === null) return null;
  return { node: last, offset: last.nodeValue?.length ?? 0 };
}

// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Editable, caretOffsetIn, placeCaret } from "../Editable";
import {
  InlineEditProvider,
  targetKey,
  type EditTarget,
  type InlineEditApi,
} from "../inline-edit";

/**
 * The inline editing primitive.
 *
 * Driven through the DOM rather than through simulated typing on purpose:
 * happy-dom does not implement contentEditable editing, and what matters here
 * is not how the characters got in but what the component does with them — when
 * it writes into the element, when it refuses to, and what it commits.
 */

afterEach(cleanup);

const BULLET: EditTarget = {
  kind: "bullet",
  sectionId: "s1",
  entryId: "e1",
  index: 0,
};

function fakeApi(overrides: Partial<InlineEditApi> = {}): InlineEditApi {
  return {
    enabled: true,
    commit: vi.fn(),
    splitBullet: vi.fn(),
    mergeBulletBackward: vi.fn(),
    addEntryAfter: vi.fn(),
    removeEntry: vi.fn(),
    moveEntry: vi.fn(),
    toggleEntryVisible: vi.fn(),
    pendingFocus: null,
    clearFocus: vi.fn(),
    ...overrides,
  };
}

type EditableProps = Parameters<typeof Editable>[0];

function Harness({
  api,
  ...props
}: EditableProps & { api: InlineEditApi | null }) {
  if (api === null) return <Editable {...props} />;
  return (
    <InlineEditProvider value={api}>
      <Editable {...props} />
    </InlineEditProvider>
  );
}

/** The rendered element plus a re-render that keeps the harness shape. */
function setup(props: EditableProps & { api: InlineEditApi | null }) {
  const view = render(<Harness {...props} />);
  const element = () => view.container.firstElementChild as HTMLElement;
  return {
    ...view,
    element,
    update: (next: Partial<EditableProps & { api: InlineEditApi | null }>) =>
      view.rerender(<Harness {...props} {...next} />),
  };
}

describe("editing disabled", () => {
  it("renders exactly the markup the document renders without it", () => {
    const { container } = render(
      <Editable
        as="li"
        className="resume-bullets__item"
        target={BULLET}
        value="Shipped things"
      />,
    );
    const plain = render(
      <li className="resume-bullets__item">Shipped things</li>,
    );

    expect(container.innerHTML).toBe(plain.container.innerHTML);
  });

  it("keeps an anchor's href and text", () => {
    const { container } = render(
      <Editable
        as="a"
        href="https://example.com/ada"
        target={{ kind: "link", index: 0, field: "label" }}
        value="LinkedIn"
      />,
    );
    const plain = render(<a href="https://example.com/ada">LinkedIn</a>);

    expect(container.innerHTML).toBe(plain.container.innerHTML);
  });

  it("adds no editing attributes at all", () => {
    const { element } = setup({ api: null, target: BULLET, value: "Text" });
    const el = element();

    expect(el.hasAttribute("contenteditable")).toBe(false);
    expect(el.hasAttribute("data-inline-edit")).toBe(false);
    expect(el.hasAttribute("data-placeholder")).toBe(false);
  });

  it("is also plain when the api exists but editing is off", () => {
    const { element } = setup({
      api: fakeApi({ enabled: false }),
      target: BULLET,
      value: "Text",
      placeholder: "Bullet",
    });
    const el = element();

    expect(el.hasAttribute("contenteditable")).toBe(false);
    expect(el.textContent).toBe("Text");
  });
});

describe("editing enabled", () => {
  it("is a plain-text contentEditable field with the text written into it", () => {
    const { element } = setup({
      api: fakeApi(),
      target: BULLET,
      value: "Shipped things",
      placeholder: "Bullet",
    });
    const el = element();

    expect(el.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(el.getAttribute("data-placeholder")).toBe("Bullet");
    expect(el.hasAttribute("data-inline-edit")).toBe(true);
    // Imperative, so React never owns the text while it is being typed in.
    expect(el.textContent).toBe("Shipped things");
  });

  it("marks an empty value, which is what print drops again", () => {
    const { element, update } = setup({
      api: fakeApi(),
      target: BULLET,
      value: "",
      placeholder: "Bullet",
    });
    expect(element().getAttribute("data-inline-empty")).toBe("true");

    update({ value: "Filled in" });
    expect(element().hasAttribute("data-inline-empty")).toBe(false);
  });

  it("commits the raw typed string on input", () => {
    const api = fakeApi();
    const { element } = setup({ api, target: BULLET, value: "Shipped" });
    const el = element();

    el.textContent = "Shipped things";
    fireEvent.input(el);

    expect(api.commit).toHaveBeenCalledWith(BULLET, "Shipped things");
  });

  it("commits an empty string rather than nothing when the field is cleared", () => {
    const api = fakeApi();
    const { element } = setup({ api, target: BULLET, value: "Shipped" });
    const el = element();

    el.textContent = "";
    fireEvent.input(el);

    expect(api.commit).toHaveBeenCalledWith(BULLET, "");
  });
});

/**
 * The single most important behaviour in the whole feature. Several fields show
 * something other than what they store — `formatPeriod` rewrites separators,
 * `formatItems` joins the skills array — so a field that rewrote itself from
 * props on every keystroke would move the caret to the end mid-word.
 */
describe("the sync effect", () => {
  it("does not touch the text while the field is focused", () => {
    const api = fakeApi();
    const { element, update } = setup({
      api,
      target: BULLET,
      value: "2024-2025",
    });
    const el = element();

    el.focus();
    expect(document.activeElement).toBe(el);

    el.textContent = "2024-2026";
    fireEvent.input(el);

    // The document now reports the formatted spelling back.
    update({ value: "2024 – 2026" });
    expect(el.textContent).toBe("2024-2026");
  });

  it("writes the display value back once the field is left", () => {
    const api = fakeApi();
    const { element, update } = setup({
      api,
      target: BULLET,
      value: "2024-2025",
    });
    const el = element();

    el.focus();
    el.textContent = "2024-2026";
    fireEvent.input(el);
    update({ value: "2024 – 2026" });

    el.blur();
    expect(el.textContent).toBe("2024 – 2026");
  });

  it("follows the document while the field is not focused", () => {
    const { element, update } = setup({
      api: fakeApi(),
      target: BULLET,
      value: "First",
    });

    update({ value: "Second" });
    expect(element().textContent).toBe("Second");
  });
});

describe("keyboard", () => {
  it("calls onEnter with the caret offset instead of inserting a line", () => {
    const onEnter = vi.fn();
    const { element } = setup({
      api: fakeApi(),
      target: BULLET,
      value: "Shipped things",
      onEnter,
    });
    const el = element();

    el.focus();
    placeCaret(el, 7);
    fireEvent.keyDown(el, { key: "Enter" });

    expect(onEnter).toHaveBeenCalledWith(7);
  });

  it("blurs on Enter when there is nothing to split", () => {
    const { element } = setup({
      api: fakeApi(),
      target: { kind: "header", field: "name" },
      value: "Ada Lovelace",
    });
    const el = element();

    el.focus();
    fireEvent.keyDown(el, { key: "Enter" });

    expect(document.activeElement).not.toBe(el);
  });

  it("restores and commits the pre-focus value on Escape", () => {
    const api = fakeApi();
    const { element } = setup({ api, target: BULLET, value: "Shipped" });
    const el = element();

    el.focus();
    el.textContent = "Shipped thinsg";
    fireEvent.input(el);
    fireEvent.keyDown(el, { key: "Escape" });

    expect(el.textContent).toBe("Shipped");
    expect(api.commit).toHaveBeenLastCalledWith(BULLET, "Shipped");
  });

  it("calls onBackspaceAtStart only with a collapsed caret at offset 0", () => {
    const onBackspaceAtStart = vi.fn();
    const { element } = setup({
      api: fakeApi(),
      target: BULLET,
      value: "Shipped things",
      onBackspaceAtStart,
    });
    const el = element();

    el.focus();
    placeCaret(el, 3);
    fireEvent.keyDown(el, { key: "Backspace" });
    expect(onBackspaceAtStart).not.toHaveBeenCalled();

    placeCaret(el, 0);
    fireEvent.keyDown(el, { key: "Backspace" });
    expect(onBackspaceAtStart).toHaveBeenCalledTimes(1);
  });
});

describe("focus handoff", () => {
  it("takes the pending request addressed to it and clears it", () => {
    const api = fakeApi({
      pendingFocus: { key: targetKey(BULLET), caret: 4 },
    });
    const { element } = setup({ api, target: BULLET, value: "Shipped" });
    const el = element();

    expect(document.activeElement).toBe(el);
    expect(caretOffsetIn(el)).toBe(4);
    expect(api.clearFocus).toHaveBeenCalled();
  });

  it("leaves a request addressed to another field alone", () => {
    const api = fakeApi({
      pendingFocus: {
        key: targetKey({ ...BULLET, index: 1 } as EditTarget),
        caret: "start",
      },
    });
    const { element } = setup({ api, target: BULLET, value: "Shipped" });

    expect(document.activeElement).not.toBe(element());
    expect(api.clearFocus).not.toHaveBeenCalled();
  });
});

describe("caret helpers", () => {
  it("counts characters across several text nodes", () => {
    const host = document.createElement("div");
    host.append(
      document.createTextNode("Shipped "),
      document.createTextNode("things"),
    );
    document.body.append(host);

    placeCaret(host, 10);
    expect(caretOffsetIn(host)).toBe(10);

    placeCaret(host, "end");
    expect(caretOffsetIn(host)).toBe(14);

    placeCaret(host, "start");
    expect(caretOffsetIn(host)).toBe(0);

    host.remove();
  });

  it("clamps an offset past the end of the text", () => {
    const host = document.createElement("div");
    host.textContent = "Short";
    document.body.append(host);

    placeCaret(host, 99);
    expect(caretOffsetIn(host)).toBe(5);

    host.remove();
  });
});

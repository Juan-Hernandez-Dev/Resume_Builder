// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  InlineEditProvider,
  targetKey,
  useInlineEdit,
  useInlineEditing,
  type EditTarget,
  type InlineEditApi,
} from "../inline-edit";

/**
 * The wire between the page and the editor. Two things are worth pinning: a
 * page with no provider must come out as a plain document, and `targetKey`
 * must name a field uniquely, because it is the only thing that decides which
 * field a pending focus request lands in.
 */

afterEach(cleanup);

function api(): InlineEditApi {
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
  };
}

describe("useInlineEdit", () => {
  it("is null outside a provider, so the page renders standalone", () => {
    let seen: InlineEditApi | null | undefined;
    let editing: boolean | undefined;

    function Probe() {
      seen = useInlineEdit();
      editing = useInlineEditing();
      return null;
    }

    render(<Probe />);
    expect(seen).toBeNull();
    expect(editing).toBe(false);
  });

  it("hands the api through the provider", () => {
    const value = api();
    let seen: InlineEditApi | null | undefined;
    let editing: boolean | undefined;

    function Probe() {
      seen = useInlineEdit();
      editing = useInlineEditing();
      return null;
    }

    render(
      <InlineEditProvider value={value}>
        <Probe />
      </InlineEditProvider>,
    );
    expect(seen).toBe(value);
    expect(editing).toBe(true);
  });

  it("reports editing off when the provider says so", () => {
    let editing: boolean | undefined;

    function Probe() {
      editing = useInlineEditing();
      return null;
    }

    render(
      <InlineEditProvider value={{ ...api(), enabled: false }}>
        <Probe />
      </InlineEditProvider>,
    );
    expect(editing).toBe(false);
  });
});

describe("targetKey", () => {
  it("is stable for the same field", () => {
    const first: EditTarget = {
      kind: "entryField",
      sectionId: "s1",
      entryId: "e1",
      field: "org",
    };
    const second: EditTarget = {
      kind: "entryField",
      sectionId: "s1",
      entryId: "e1",
      field: "org",
    };
    expect(targetKey(first)).toBe(targetKey(second));
  });

  /** The split/merge focus handoff is addressed by index and nothing else. */
  it("distinguishes two bullets that differ only by index", () => {
    const base = { kind: "bullet", sectionId: "s1", entryId: "e1" } as const;
    expect(targetKey({ ...base, index: 0 })).not.toBe(
      targetKey({ ...base, index: 1 }),
    );
  });

  it("distinguishes every variant", () => {
    const targets: EditTarget[] = [
      { kind: "header", field: "name" },
      { kind: "header", field: "location" },
      { kind: "header", field: "phone" },
      { kind: "header", field: "email" },
      { kind: "link", index: 0, field: "label" },
      { kind: "link", index: 0, field: "url" },
      { kind: "link", index: 1, field: "label" },
      { kind: "sectionTitle", sectionId: "s1" },
      { kind: "sectionTitle", sectionId: "s2" },
      { kind: "entryField", sectionId: "s1", entryId: "e1", field: "org" },
      { kind: "entryField", sectionId: "s1", entryId: "e1", field: "role" },
      { kind: "entryField", sectionId: "s1", entryId: "e2", field: "org" },
      { kind: "entryField", sectionId: "s2", entryId: "e1", field: "org" },
      { kind: "bullet", sectionId: "s1", entryId: "e1", index: 0 },
      { kind: "bullet", sectionId: "s1", entryId: "e2", index: 0 },
      { kind: "bullet", sectionId: "s1", entryId: "e1", index: 2 },
      { kind: "skillsItems", sectionId: "s1", entryId: "e1" },
      { kind: "skillsItems", sectionId: "s1", entryId: "e2" },
    ];

    const keys = targets.map(targetKey);
    expect(new Set(keys).size).toBe(targets.length);
  });

  /**
   * A section title and an entry field could collide if the kind were left out
   * of the key, which would hand the caret to the wrong element.
   */
  it("keeps kinds apart even when their ids are the same", () => {
    expect(targetKey({ kind: "sectionTitle", sectionId: "x" })).not.toBe(
      targetKey({ kind: "skillsItems", sectionId: "x", entryId: "x" }),
    );
  });
});

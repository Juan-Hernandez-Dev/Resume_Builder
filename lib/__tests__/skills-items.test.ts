import { describe, expect, it } from "vitest";

import { formatItems, parseItems } from "@/lib/skills-items";

describe("parseItems", () => {
  it("splits a comma separated list", () => {
    expect(parseItems("React, Next.js, Vue")).toEqual([
      "React",
      "Next.js",
      "Vue",
    ]);
  });

  it("trims surrounding whitespace on every item", () => {
    expect(parseItems("  React ,Next.js   ,   Vue  ")).toEqual([
      "React",
      "Next.js",
      "Vue",
    ]);
  });

  it("drops empty items left by stray or trailing commas", () => {
    expect(parseItems("React,,Next.js,")).toEqual(["React", "Next.js"]);
    expect(parseItems(",")).toEqual([]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseItems("")).toEqual([]);
    expect(parseItems("   ")).toEqual([]);
  });

  it("keeps a single item without commas", () => {
    expect(parseItems("TypeScript")).toEqual(["TypeScript"]);
  });

  it("keeps internal spaces inside an item", () => {
    expect(parseItems("Azure DevOps, GitHub Actions")).toEqual([
      "Azure DevOps",
      "GitHub Actions",
    ]);
  });
});

describe("formatItems", () => {
  it("joins items with a comma and a space", () => {
    expect(formatItems(["React", "Next.js", "Vue"])).toBe("React, Next.js, Vue");
  });

  it("returns an empty string for an empty list", () => {
    expect(formatItems([])).toBe("");
  });

  it("does not trim or filter: that is the parser's job", () => {
    expect(formatItems(["React", ""])).toBe("React, ");
  });
});

describe("round trip", () => {
  it("parse(format(items)) is the original list", () => {
    const items = ["C++", "JavaScript", "Python"];
    expect(parseItems(formatItems(items))).toEqual(items);
  });

  it("format(parse(input)) is the normalized input", () => {
    expect(formatItems(parseItems("  C++ ,, JavaScript,Python , "))).toBe(
      "C++, JavaScript, Python",
    );
  });

  it("is stable when applied twice", () => {
    const once = formatItems(parseItems("Agile ,Scrum,, Git"));
    expect(formatItems(parseItems(once))).toBe(once);
  });
});

/* -------------------------------------------------------------------------- */
/* A known limitation of the comma-separated input                            */
/* -------------------------------------------------------------------------- */

/**
 * The comma is the item separator, so it cannot also be part of an item. A
 * stored item containing a comma survives being *shown* but is split the next
 * time the input is parsed, which is on the next keystroke.
 *
 * This is pinned rather than fixed: the single comma-separated input is the
 * design the owner asked for, and these tests state exactly what it costs so a
 * future reader does not mistake it for a bug in parseItems. The README says
 * the same thing. The workaround is to edit the JSON file directly.
 */
describe("items containing a comma", () => {
  it("renders into the input but comes back as two items", () => {
    const stored = ["REST, GraphQL"];
    const shown = formatItems(stored);
    expect(shown).toBe("REST, GraphQL");
    expect(parseItems(shown)).toEqual(["REST", "GraphQL"]);
    expect(parseItems(shown)).not.toEqual(stored);
  });

  it("is indistinguishable from two separate items once typed", () => {
    expect(formatItems(["REST, GraphQL"])).toBe(formatItems(["REST", "GraphQL"]));
  });

  it("splits only on commas: every other character survives", () => {
    const stored = ["C++", "Node.js", "CI/CD", "A&B", "x - y", "co-op", "a;b"];
    expect(parseItems(formatItems(stored))).toEqual(stored);
  });

  it("is stable after the first split, so an item is never split twice", () => {
    const once = formatItems(parseItems(formatItems(["REST, GraphQL"])));
    expect(formatItems(parseItems(once))).toBe(once);
  });
});

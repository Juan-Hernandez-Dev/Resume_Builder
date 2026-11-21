import { describe, expect, it } from "vitest";

import {
  CSS_PX_PER_INCH,
  formatOverflow,
  measureOverflow,
  NO_OVERFLOW,
} from "@/lib/overflow";

const PAGE = 11 * CSS_PX_PER_INCH; // Letter at 96 CSS px per inch.

describe("measureOverflow", () => {
  it("reports no overflow when the content is shorter than the page", () => {
    expect(measureOverflow(500, PAGE)).toEqual({
      overflows: false,
      overflowPx: 0,
      pages: 1,
    });
  });

  it("reports no overflow when the content is exactly one page", () => {
    expect(measureOverflow(PAGE, PAGE)).toEqual({
      overflows: false,
      overflowPx: 0,
      pages: 1,
    });
  });

  it("ignores sub-pixel rounding noise from browser layout", () => {
    expect(measureOverflow(PAGE + 0.5, PAGE)).toEqual({
      overflows: false,
      overflowPx: 0,
      pages: 1,
    });
  });

  it("reports the overflow in pixels once the page is exceeded", () => {
    const result = measureOverflow(PAGE + 96, PAGE);
    expect(result.overflows).toBe(true);
    expect(result.overflowPx).toBe(96);
    expect(result.pages).toBe(2);
  });

  it("counts a third page once the overflow passes two pages", () => {
    expect(measureOverflow(PAGE * 2 + 10, PAGE).pages).toBe(3);
  });

  /**
   * The tolerance is there because browser layout produces sub-pixel heights.
   * That is just as true at the second page boundary as at the first, so a
   * fraction over two pages is two pages, not three.
   */
  it("ignores sub-pixel noise at every page boundary, not only the first", () => {
    expect(measureOverflow(PAGE * 2 + 0.5, PAGE).pages).toBe(2);
    expect(measureOverflow(PAGE * 3 + 0.5, PAGE).pages).toBe(3);
    expect(measureOverflow(PAGE * 2 + 1, PAGE).pages).toBe(2);
  });

  it("still counts the next page once the noise margin is passed", () => {
    expect(measureOverflow(PAGE * 2 + 1.5, PAGE).pages).toBe(3);
    expect(measureOverflow(PAGE + 1.5, PAGE).pages).toBe(2);
  });

  it("never reports fewer than one page", () => {
    expect(measureOverflow(PAGE + 0.5, PAGE).pages).toBe(1);
    expect(measureOverflow(1, PAGE).pages).toBe(1);
  });

  it("counts exactly two pages when the content fills two pages", () => {
    expect(measureOverflow(PAGE * 2, PAGE)).toEqual({
      overflows: true,
      overflowPx: PAGE,
      pages: 2,
    });
  });

  it("treats an unmeasured page as no overflow", () => {
    expect(measureOverflow(0, 0)).toEqual(NO_OVERFLOW);
    expect(measureOverflow(1200, 0)).toEqual(NO_OVERFLOW);
    expect(measureOverflow(1200, Number.NaN)).toEqual(NO_OVERFLOW);
    expect(measureOverflow(Number.NaN, PAGE)).toEqual(NO_OVERFLOW);
  });

  it("never reports a negative overflow", () => {
    expect(measureOverflow(-100, PAGE).overflowPx).toBe(0);
  });
});

describe("formatOverflow", () => {
  it("confirms a single page when nothing overflows", () => {
    expect(formatOverflow(NO_OVERFLOW)).toBe("Fits on one page");
  });

  it("states the overflow in inches and the page count", () => {
    expect(formatOverflow(measureOverflow(PAGE + 67.2, PAGE))).toBe(
      "Content exceeds one page by 0.7in / 2 pages",
    );
  });

  it("rounds the inches to one decimal", () => {
    expect(formatOverflow(measureOverflow(PAGE + 96, PAGE))).toBe(
      "Content exceeds one page by 1.0in / 2 pages",
    );
  });

  it("reports three pages when the content runs that long", () => {
    expect(formatOverflow(measureOverflow(PAGE * 2 + 96, PAGE))).toBe(
      "Content exceeds one page by 12.0in / 3 pages",
    );
  });
});

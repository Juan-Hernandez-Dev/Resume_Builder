/**
 * Page overflow measurement. Both inputs are CSS pixels measured from the real
 * page box (offsetHeight ignores the preview's scale transform, so what is
 * measured is what will be printed).
 */

/** CSS defines one inch as exactly 96 px, whatever the device does. */
export const CSS_PX_PER_INCH = 96;

/**
 * Browser layout produces sub-pixel heights, so a page that fits exactly can
 * measure a fraction over. Anything within this margin is not an overflow.
 */
const TOLERANCE_PX = 1;

export type Overflow = {
  overflows: boolean;
  /** How far past the first page the content runs, in CSS pixels. */
  overflowPx: number;
  /** How many printed pages the content needs. At least 1. */
  pages: number;
};

export const NO_OVERFLOW: Overflow = {
  overflows: false,
  overflowPx: 0,
  pages: 1,
};

function isMeasured(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Compares the rendered content height against one page. An unmeasured page
 * (zero or not a number, as happens on the first paint) reports no overflow
 * rather than a bogus warning.
 */
export function measureOverflow(
  contentHeight: number,
  pageHeight: number,
): Overflow {
  if (!isMeasured(pageHeight) || !Number.isFinite(contentHeight)) {
    return NO_OVERFLOW;
  }

  const excess = contentHeight - pageHeight;
  if (excess <= TOLERANCE_PX) return NO_OVERFLOW;

  return {
    overflows: true,
    overflowPx: excess,
    // The tolerance applies at every page boundary, not only the first: a
    // content height a fraction over two pages still prints on two pages.
    pages: Math.max(1, Math.ceil((contentHeight - TOLERANCE_PX) / pageHeight)),
  };
}

/** The human sentence shown in the toolbar indicator. */
export function formatOverflow(overflow: Overflow): string {
  if (!overflow.overflows) return "Fits on one page";

  const inches = (overflow.overflowPx / CSS_PX_PER_INCH).toFixed(1);
  return `Content exceeds one page by ${inches}in / ${overflow.pages} pages`;
}

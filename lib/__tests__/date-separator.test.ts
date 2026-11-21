import { describe, expect, it } from "vitest";

import { DATE_SEPARATORS, formatPeriod } from "@/lib/date-separator";

describe("formatPeriod", () => {
  it("keeps a plain hyphen range untouched by default", () => {
    expect(formatPeriod("2024 - Present", "hyphen")).toBe("2024 - Present");
  });

  it("swaps a hyphen range for an en dash range", () => {
    expect(formatPeriod("2024 - Present", "endash")).toBe("2024 – Present");
  });

  it("swaps an en dash range back to a hyphen range", () => {
    expect(formatPeriod("2024 – 2025", "hyphen")).toBe("2024 - 2025");
  });

  it("normalizes tight and ragged spacing around the separator", () => {
    expect(formatPeriod("2024-2025", "hyphen")).toBe("2024 - 2025");
    expect(formatPeriod("2024   -   2025", "hyphen")).toBe("2024 - 2025");
    expect(formatPeriod(" 2024 - 2025 ", "hyphen")).toBe("2024 - 2025");
  });

  it("leaves hyphenated words alone", () => {
    expect(formatPeriod("Part-time 2024 - Present", "endash")).toBe(
      "Part-time 2024 – Present",
    );
  });

  it("returns an empty string unchanged", () => {
    expect(formatPeriod("", "endash")).toBe("");
  });

  /* ------------------------------------------------------------------------ */
  /* A tight separator is only a range between two years                      */
  /* ------------------------------------------------------------------------ */

  it("joins two tight four-digit years", () => {
    expect(formatPeriod("2024-2025", "endash")).toBe("2024 – 2025");
    expect(formatPeriod("2024–2025", "hyphen")).toBe("2024 - 2025");
  });

  it("joins a year to an open end, so en dash mode is not left half applied", () => {
    expect(formatPeriod("2023-Present", "hyphen")).toBe("2023 - Present");
    expect(formatPeriod("2023-Present", "endash")).toBe("2023 – Present");
    expect(formatPeriod("2023-Current", "endash")).toBe("2023 – Current");
    expect(formatPeriod("2023-present", "endash")).toBe("2023 – present");
  });

  it("leaves a month-year date alone: MM-YYYY is not a range", () => {
    expect(formatPeriod("01-2020 - 03-2021", "hyphen")).toBe(
      "01-2020 - 03-2021",
    );
    expect(formatPeriod("01-2020 - 03-2021", "endash")).toBe(
      "01-2020 – 03-2021",
    );
  });

  it("leaves an ISO date alone: YYYY-MM-DD is not a range", () => {
    expect(formatPeriod("2020-01-15 - 2021-03-01", "hyphen")).toBe(
      "2020-01-15 - 2021-03-01",
    );
    expect(formatPeriod("2020-01-15 - 2021-03-01", "endash")).toBe(
      "2020-01-15 – 2021-03-01",
    );
    expect(formatPeriod("2020-01-15", "endash")).toBe("2020-01-15");
  });

  it("leaves a single date with no range alone", () => {
    expect(formatPeriod("2024", "endash")).toBe("2024");
    expect(formatPeriod("01-2020", "endash")).toBe("01-2020");
    expect(formatPeriod("Present", "endash")).toBe("Present");
    expect(formatPeriod("June 2024", "endash")).toBe("June 2024");
  });

  it("normalizes every separator in a string with several ranges", () => {
    expect(formatPeriod("2019-2020, 2022-2023, 2024-Present", "endash")).toBe(
      "2019 – 2020, 2022 – 2023, 2024 – Present",
    );
    expect(formatPeriod("2019 - 2020 and 2022-2023", "endash")).toBe(
      "2019 – 2020 and 2022 – 2023",
    );
  });

  it("does not treat a longer digit run as a year range", () => {
    expect(formatPeriod("12345-6789", "endash")).toBe("12345-6789");
    expect(formatPeriod("1234-56789", "endash")).toBe("1234-56789");
  });

  it("leaves a two-digit year abbreviation alone rather than guessing", () => {
    expect(formatPeriod("2024-25", "endash")).toBe("2024-25");
  });

  it("is stable when applied twice", () => {
    for (const period of [
      "2024-2025",
      "2023-Present",
      "01-2020 - 03-2021",
      "2020-01-15 - 2021-03-01",
      "2019-2020, 2022-Present",
    ]) {
      const once = formatPeriod(period, "endash");
      expect(formatPeriod(once, "endash")).toBe(once);
      const back = formatPeriod(once, "hyphen");
      expect(formatPeriod(back, "hyphen")).toBe(back);
    }
  });

  it("exposes the separator glue for both settings", () => {
    expect(DATE_SEPARATORS.hyphen).toBe(" - ");
    expect(DATE_SEPARATORS.endash).toBe(" – ");
  });
});

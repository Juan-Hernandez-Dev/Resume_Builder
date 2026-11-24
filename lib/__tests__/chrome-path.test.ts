import { describe, expect, it } from "vitest";

import { chromeCandidates, resolveChrome } from "@/lib/chrome-path";
import { BROWSER_NOT_FOUND_MESSAGE } from "@/lib/pdf-export";

/** An `exists` stand-in that only knows about the given paths. */
function only(...paths: string[]) {
  const known = new Set(paths);
  return (path: string) => known.has(path);
}

const WINDOWS_ENV = {
  PROGRAMFILES: "C:\\Program Files",
  "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
  LOCALAPPDATA: "C:\\Users\\ada\\AppData\\Local",
};

describe("resolveChrome", () => {
  it("prefers CHROME_PATH over every known install location", () => {
    const result = resolveChrome({
      env: { ...WINDOWS_ENV, CHROME_PATH: "D:\\Tools\\chrome.exe" },
      platform: "win32",
      exists: only(
        "D:\\Tools\\chrome.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      ),
    });
    expect(result).toEqual({ ok: true, path: "D:\\Tools\\chrome.exe" });
  });

  it("reports a CHROME_PATH that points at nothing instead of guessing", () => {
    const result = resolveChrome({
      env: { ...WINDOWS_ENV, CHROME_PATH: "D:\\missing\\chrome.exe" },
      platform: "win32",
      exists: only("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/CHROME_PATH/);
  });

  it("words a broken CHROME_PATH for every platform, not only Windows", () => {
    const result = resolveChrome({
      env: { CHROME_PATH: "/opt/missing/chrome" },
      platform: "linux",
      exists: only(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toMatch(/\.exe\b/);
  });

  it("ignores a blank CHROME_PATH", () => {
    const result = resolveChrome({
      env: { ...WINDOWS_ENV, CHROME_PATH: "  " },
      platform: "win32",
      exists: only("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"),
    });
    expect(result).toEqual({
      ok: true,
      path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });
  });

  it("finds Chrome under Program Files (x86) on Windows", () => {
    const path =
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
    expect(
      resolveChrome({ env: WINDOWS_ENV, platform: "win32", exists: only(path) }),
    ).toEqual({ ok: true, path });
  });

  it("finds a per-user Chrome install under LOCALAPPDATA", () => {
    const path =
      "C:\\Users\\ada\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe";
    expect(
      resolveChrome({ env: WINDOWS_ENV, platform: "win32", exists: only(path) }),
    ).toEqual({ ok: true, path });
  });

  it("falls back to Edge on Windows when Chrome is not installed", () => {
    const path =
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    expect(
      resolveChrome({ env: WINDOWS_ENV, platform: "win32", exists: only(path) }),
    ).toEqual({ ok: true, path });
  });

  it("reads Windows environment variables whatever their casing", () => {
    const path = "E:\\Apps\\Google\\Chrome\\Application\\chrome.exe";
    expect(
      resolveChrome({
        env: { ProgramFiles: "E:\\Apps" },
        platform: "win32",
        exists: only(path),
      }),
    ).toEqual({ ok: true, path });
  });

  it("finds Chrome in /Applications on macOS", () => {
    const path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    expect(
      resolveChrome({ env: {}, platform: "darwin", exists: only(path) }),
    ).toEqual({ ok: true, path });
  });

  it("finds Chromium on Linux", () => {
    expect(
      resolveChrome({
        env: {},
        platform: "linux",
        exists: only("/usr/bin/chromium"),
      }),
    ).toEqual({ ok: true, path: "/usr/bin/chromium" });
  });

  it("prefers Google Chrome over Chromium on Linux", () => {
    expect(
      resolveChrome({
        env: {},
        platform: "linux",
        exists: only("/usr/bin/chromium", "/usr/bin/google-chrome"),
      }),
    ).toEqual({ ok: true, path: "/usr/bin/google-chrome" });
  });

  it("explains how to fix it when no browser is found", () => {
    const result = resolveChrome({
      env: WINDOWS_ENV,
      platform: "win32",
      exists: () => false,
    });
    expect(result).toEqual({ ok: false, error: BROWSER_NOT_FOUND_MESSAGE });
    expect(BROWSER_NOT_FOUND_MESSAGE).toMatch(
      /Google Chrome or Microsoft Edge/,
    );
    expect(BROWSER_NOT_FOUND_MESSAGE).toMatch(/CHROME_PATH/);
  });
});

describe("chromeCandidates", () => {
  it("lists Chrome before Edge on Windows", () => {
    const candidates = chromeCandidates("win32", WINDOWS_ENV);
    const firstEdge = candidates.findIndex((path) => path.endsWith("msedge.exe"));
    const lastChrome = candidates.findLastIndex((path) =>
      path.endsWith("chrome.exe"),
    );
    expect(firstEdge).toBeGreaterThan(-1);
    expect(lastChrome).toBeLessThan(firstEdge);
  });

  it("skips locations whose environment variable is not set", () => {
    const candidates = chromeCandidates("win32", {});
    expect(candidates.every((path) => !path.includes("undefined"))).toBe(true);
    expect(candidates).toContain(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    );
  });

  it("returns nothing for a platform it does not know", () => {
    expect(chromeCandidates("aix", {})).toEqual([]);
  });
});

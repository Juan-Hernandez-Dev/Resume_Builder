import { afterEach, describe, expect, it, vi } from "vitest";

import { appMode } from "@/lib/app-mode";

/**
 * Which build this is: the local app (files and a server) or the static web
 * demo (IndexedDB, no server). A typo must not quietly produce the wrong one.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appMode", () => {
  it("is local when NEXT_PUBLIC_APP_MODE is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", undefined);
    expect(appMode()).toBe("local");
  });

  it("is local when it is set to an empty string", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "");
    expect(appMode()).toBe("local");
  });

  it("is local or web when set to either", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "local");
    expect(appMode()).toBe("local");
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "web");
    expect(appMode()).toBe("web");
  });

  it("refuses anything else, naming the value", () => {
    for (const value of ["Web", "static", "web "]) {
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", value);
      expect(() => appMode(), value).toThrow(
        `NEXT_PUBLIC_APP_MODE must be "local" or "web", not ${JSON.stringify(value)}.`,
      );
    }
  });
});

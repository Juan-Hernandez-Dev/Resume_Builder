import type { Browser } from "puppeteer-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BROWSER_CLOSE_TIMEOUT_MS,
  PDF_STEP_TIMEOUT_MS,
  closeBrowser,
  renderPdf,
} from "@/lib/pdf-render";
import { PRINT_JOB_TTL_MS } from "@/lib/print-store";

/**
 * renderPdf against a fake browser: no Chrome is launched. What matters here
 * is the order of the steps and that shutting the browser down can neither
 * lose a finished PDF nor hang the request.
 */

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

type FakeBrowser = {
  browser: Browser;
  steps: string[];
  close: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
};

function fakeBrowser({
  steps = [],
  close = () => Promise.resolve(),
  pdf = () => Promise.resolve(PDF),
}: {
  steps?: string[];
  close?: () => Promise<void>;
  pdf?: () => Promise<Uint8Array>;
} = {}): FakeBrowser {
  const page = {
    setDefaultTimeout: vi.fn(),
    setJavaScriptEnabled: vi.fn(() => Promise.resolve()),
    emulateMediaType: vi.fn(() => Promise.resolve()),
    goto: vi.fn((url: string) => {
      steps.push(`goto ${url}`);
      return Promise.resolve({ ok: () => true, status: () => 200 });
    }),
    waitForSelector: vi.fn(() => Promise.resolve()),
    evaluate: vi.fn(() => Promise.resolve()),
    pdf: vi.fn(() => {
      steps.push("pdf");
      return pdf();
    }),
  };
  const closeMock = vi.fn(() => {
    steps.push("close");
    return close();
  });
  const kill = vi.fn(() => {
    steps.push("kill");
    return true;
  });
  const browser = {
    newPage: vi.fn(() => Promise.resolve(page)),
    close: closeMock,
    process: () => ({ kill }),
  } as unknown as Browser;
  return { browser, steps, close: closeMock, kill };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("renderPdf", () => {
  it("asks for the page URL only once the browser is up", async () => {
    const steps: string[] = [];
    const fake = fakeBrowser({ steps });
    const launch = vi.fn(async () => {
      steps.push("launch");
      return fake.browser;
    });

    const pdf = await renderPdf(
      {
        executablePath: "chrome",
        url: () => {
          steps.push("url");
          return "http://127.0.0.1:3000/print?token=t";
        },
      },
      launch,
    );

    expect(pdf).toBe(PDF);
    expect(launch).toHaveBeenCalledWith("chrome");
    expect(steps).toEqual([
      "launch",
      "url",
      "goto http://127.0.0.1:3000/print?token=t",
      "pdf",
      "close",
    ]);
  });

  it("never asks for the URL when the browser cannot be launched", async () => {
    const url = vi.fn(() => "http://127.0.0.1:3000/print");
    await expect(
      renderPdf({ executablePath: "chrome", url }, () =>
        Promise.reject(new Error("spawn failed")),
      ),
    ).rejects.toThrow("spawn failed");
    expect(url).not.toHaveBeenCalled();
  });

  it("keeps the PDF when closing the browser fails, and kills it instead", async () => {
    const fake = fakeBrowser({
      close: () => Promise.reject(new Error("Target closed")),
    });

    const pdf = await renderPdf(
      { executablePath: "chrome", url: () => "http://127.0.0.1/print" },
      async () => fake.browser,
    );

    expect(pdf).toBe(PDF);
    expect(fake.kill).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps the PDF when the browser will not close, and kills it after a timeout", async () => {
    vi.useFakeTimers();
    const fake = fakeBrowser({ close: () => new Promise<void>(() => {}) });

    const rendering = renderPdf(
      { executablePath: "chrome", url: () => "http://127.0.0.1/print" },
      async () => fake.browser,
    );
    await vi.advanceTimersByTimeAsync(BROWSER_CLOSE_TIMEOUT_MS);

    await expect(rendering).resolves.toBe(PDF);
    expect(fake.kill).toHaveBeenCalledTimes(1);
  });

  it("still closes the browser when printing fails, and reports that failure", async () => {
    const fake = fakeBrowser({
      pdf: () => Promise.reject(new Error("Printing failed")),
    });

    await expect(
      renderPdf(
        { executablePath: "chrome", url: () => "http://127.0.0.1/print" },
        async () => fake.browser,
      ),
    ).rejects.toThrow("Printing failed");
    expect(fake.close).toHaveBeenCalledTimes(1);
    expect(fake.kill).not.toHaveBeenCalled();
  });

  it("gives the print job more time than loading the page may take", () => {
    // The job is stored right before the page is loaded (see the first test),
    // so it only has to outlast that one step, never a slow launch.
    expect(PRINT_JOB_TTL_MS).toBeGreaterThan(PDF_STEP_TIMEOUT_MS);
  });
});

describe("closeBrowser", () => {
  it("does not kill a browser that closed on its own", async () => {
    const fake = fakeBrowser();
    await closeBrowser(fake.browser);
    expect(fake.close).toHaveBeenCalledTimes(1);
    expect(fake.kill).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("never throws, even when the browser cannot be killed either", async () => {
    const browser = {
      close: () => Promise.reject(new Error("Target closed")),
      process: () => ({
        kill: () => {
          throw new Error("EPERM");
        },
      }),
    } as unknown as Browser;

    await expect(closeBrowser(browser)).resolves.toBeUndefined();
  });

  it("copes with a browser that has no process handle", async () => {
    const browser = {
      close: () => Promise.reject(new Error("Target closed")),
      process: () => null,
    } as unknown as Browser;

    await expect(closeBrowser(browser)).resolves.toBeUndefined();
  });
});

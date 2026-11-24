import "server-only";

import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Prints a page of this app to PDF with a locally installed Chrome or Edge.
 *
 * This is the same print pipeline as Save as PDF in the browser's dialog, so
 * app/print.css applies unchanged and the result keeps a real, selectable text
 * layer: nothing is rasterized. What it adds over the dialog is control over
 * the settings people forget to change: no headers or footers (the date, the
 * page title and the URL), no background graphics, and the sheet size taken
 * from the CSS `@page` rules.
 */

/** Per step: launching, loading the page, and printing it. */
export const PDF_STEP_TIMEOUT_MS = 30_000;

/** How long a browser gets to exit on its own before it is killed. */
export const BROWSER_CLOSE_TIMEOUT_MS = 5_000;

export type LaunchBrowser = (executablePath: string) => Promise<Browser>;

function launchChrome(executablePath: string): Promise<Browser> {
  return puppeteer.launch({
    executablePath,
    headless: true,
    timeout: PDF_STEP_TIMEOUT_MS,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-extensions"],
  });
}

/**
 * `url` is asked for only once the browser is up, right before the page is
 * loaded. The route stores its print job in that callback, so the job's time
 * to live is spent loading the page and never on a slow cold start.
 *
 * `launch` exists for the tests; the app always uses the default.
 */
export async function renderPdf(
  { executablePath, url }: { executablePath: string; url: () => string },
  launch: LaunchBrowser = launchChrome,
): Promise<Uint8Array> {
  const browser = await launch(executablePath);

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(PDF_STEP_TIMEOUT_MS);
    // The print page is complete as server-rendered HTML. Without scripts
    // nothing can change it after load, and the dev server's overlay and
    // hot-reload connection never start, so they cannot end up in the PDF.
    await page.setJavaScriptEnabled(false);
    await page.emulateMediaType("print");

    const response = await page.goto(url(), { waitUntil: "load" });
    if (!response?.ok()) {
      throw new Error(
        `The print page answered HTTP ${response?.status() ?? "(no response)"}.`,
      );
    }
    await page.waitForSelector(".resume-page");
    // Explicit, although page.pdf waits for fonts too: a PDF printed with the
    // fallback font would have different line breaks from the preview.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    return await page.pdf({
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      // Matches the print dialog advice: background graphics off.
      printBackground: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      waitForFonts: true,
      timeout: PDF_STEP_TIMEOUT_MS,
    });
  } finally {
    await closeBrowser(browser);
  }
}

/**
 * Shuts the browser down without ever throwing or hanging: a PDF that was
 * printed is not lost because Chrome failed to exit cleanly, and a Chrome that
 * will not exit cannot hold the request open. Either way it is killed, so no
 * headless process is left behind.
 */
export async function closeBrowser(
  browser: Pick<Browser, "close" | "process">,
  timeoutMs = BROWSER_CLOSE_TIMEOUT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timed-out">((resolve) => {
    timer = setTimeout(() => resolve("timed-out"), timeoutMs);
  });
  // Settles either way, so a close() that rejects after the timeout has won
  // is not an unhandled rejection.
  const closed = browser.close().then(
    () => "closed" as const,
    (error: unknown) => ({ error }),
  );

  const outcome = await Promise.race([closed, timedOut]);
  clearTimeout(timer);
  if (outcome === "closed") return;

  if (outcome === "timed-out") {
    console.error(`Chrome did not exit within ${timeoutMs}ms; killing it.`);
  } else {
    console.error("Chrome could not be closed cleanly; killing it.", outcome.error);
  }
  try {
    browser.process()?.kill("SIGKILL");
  } catch (error) {
    console.error("Chrome could not be killed:", error);
  }
}

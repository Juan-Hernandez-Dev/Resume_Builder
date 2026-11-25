/**
 * Which app this build is.
 *
 * - `local` (the default): the editor reads and writes files under data/
 *   through the API routes, and Export PDF drives the machine's Chrome.
 * - `web`: a static export for public hosting. Every visitor's resumes stay
 *   in their own browser (IndexedDB), there is no API, and Export PDF opens
 *   the print dialog.
 *
 * Read from `NEXT_PUBLIC_APP_MODE`, written out in full so Next.js inlines it
 * into client code at build time. next.config.ts uses it to pick the pages and
 * the output (see the comment there). Anything but the two names throws: a
 * typo in a deploy setting must fail the build, not ship the local app to a
 * host with no filesystem to write to.
 */
export type AppMode = "local" | "web";

export function appMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  if (mode === undefined || mode === "" || mode === "local") return "local";
  if (mode === "web") return "web";
  throw new Error(
    `NEXT_PUBLIC_APP_MODE must be "local" or "web", not ${JSON.stringify(mode)}.`,
  );
}

import type { NextConfig } from "next";

import { appMode } from "./lib/app-mode";

/**
 * Three deliberate decisions live here, all easy to undo by accident.
 *
 * 1. The Turbopack `*.css` rule. Tailwind v4 is wired in through
 *    `@tailwindcss/turbopack` rather than PostCSS, which is why there is no
 *    `postcss.config.*` in this repo. Removing this rule does not fall back to
 *    anything: `@import "tailwindcss"` in app/globals.css stops being
 *    processed and every utility class in the editor silently disappears.
 *
 * 2. `cacheComponents` is NOT here, on purpose. It is incompatible with
 *    `export const dynamic = "force-dynamic"`, which app/page.local.tsx and
 *    the route handlers declare, and the point of that is that every request
 *    re-reads the JSON files from disk. With component caching on, the build
 *    bakes the contents of data/default.json into its output: the editor then
 *    shows a snapshot from build time, and saves appear to do nothing until
 *    the app is rebuilt. For a disk-backed editor that is not a performance
 *    trade-off, it is a correctness bug, so it stays off.
 *
 * 3. One codebase, two apps, chosen by NEXT_PUBLIC_APP_MODE (lib/app-mode.ts).
 *    Files that exist in only one of them carry it in their name: `.local.tsx`
 *    for the local app (the filesystem page, /print, every API route) and
 *    `.web.tsx` for the static web build. `pageExtensions` lists only the
 *    current mode's suffix next to plain `tsx`/`ts`, so the other mode's files
 *    are not routes at all: the web build has no API and cannot reach
 *    puppeteer-core or the filesystem, and the local build never sees the
 *    IndexedDB page. Shared files (layout.tsx, error.tsx) keep plain names.
 *    Never add a plain `page.tsx` or `route.ts` next to a suffixed one: it
 *    would be a route in both builds. The web build is a static export
 *    (`out/`), which needs no server at all.
 *
 *    Client code shared by both apps can hold a local-only path too (posting
 *    to /api/pdf, the /api/variants adapter). For those, a `.web.ts(x)`
 *    sibling replaces the plain module in the web build: Turbopack's
 *    `resolveExtensions` tries it first, so `./DirectPdfExport` is
 *    DirectPdfExport.web.tsx there and DirectPdfExport.tsx everywhere else
 *    (the local build, TypeScript, the tests). `npm run check:web` fails the
 *    web build if any /api/ call or puppeteer still reaches out/.
 */
const isWeb = appMode() === "web";

/** Turbopack's default resolve order, which the web build only prefixes. */
const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"];

const nextConfig: NextConfig = {
  pageExtensions: isWeb
    ? ["web.tsx", "web.ts", "tsx", "ts"]
    : ["local.tsx", "local.ts", "tsx", "ts"],
  ...(isWeb ? { output: "export" as const } : {}),
  turbopack: {
    ...(isWeb
      ? { resolveExtensions: [".web.tsx", ".web.ts", ...RESOLVE_EXTENSIONS] }
      : {}),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

/**
 * Two deliberate decisions live here, both easy to undo by accident.
 *
 * 1. The Turbopack `*.css` rule. Tailwind v4 is wired in through
 *    `@tailwindcss/turbopack` rather than PostCSS, which is why there is no
 *    `postcss.config.*` in this repo. Removing this rule does not fall back to
 *    anything: `@import "tailwindcss"` in app/globals.css stops being
 *    processed and every utility class in the editor silently disappears.
 *
 * 2. `cacheComponents` is NOT here, on purpose. It is incompatible with
 *    `export const dynamic = "force-dynamic"`, which app/page.tsx and both
 *    route handlers declare, and the point of that is that every request
 *    re-reads the JSON files from disk. With component caching on, the build
 *    bakes the contents of data/default.json into its output: the editor then
 *    shows a snapshot from build time, and saves appear to do nothing until
 *    the app is rebuilt. For a disk-backed editor that is not a performance
 *    trade-off, it is a correctness bug, so it stays off.
 */
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

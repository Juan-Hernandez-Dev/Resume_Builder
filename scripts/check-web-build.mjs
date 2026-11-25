/**
 * `npm run check:web`: proves the static web build in out/ is what it claims
 * to be before it is published.
 *
 * - There is an out/index.html, so it really is a static export.
 * - No file mentions puppeteer: the PDF renderer is server-only and must not
 *   have leaked into a bundle that every visitor downloads.
 * - No file calls the API: a static host has no /api/, so a reference to it
 *   is a local-only code path that would fail for every visitor.
 * - The pages load nothing from another origin, which is what lets
 *   vercel.json's Content-Security-Policy stay at 'self'.
 *
 * Exits non-zero with every offence listed, so CI and build:web fail on it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = path.join(root, "out");

const TEXT = /\.(html|js|mjs|css|json|txt|map|svg|webmanifest)$/i;

/** Text patterns no published file may contain, and why. */
const FORBIDDEN = [
  { pattern: /puppeteer/i, why: "the server-only PDF renderer is bundled" },
  { pattern: /["'`]\/api\//, why: "it calls the API, which a static host does not have" },
];

/** Attributes that make the page load something; only same-origin is allowed. */
const EXTERNAL_LOAD = /(?:src|href)=["'](?:https?:)?\/\/(?!localhost)[^"']+["']/gi;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const problems = [];

if (!existsSync(path.join(out, "index.html"))) {
  problems.push("out/index.html is missing: run `npm run build:web` first.");
} else {
  for (const file of walk(out).filter((file) => TEXT.test(file))) {
    const relative = path.relative(root, file);
    const text = readFileSync(file, "utf8");

    for (const { pattern, why } of FORBIDDEN) {
      if (pattern.test(text)) problems.push(`${relative}: ${why} (${pattern}).`);
    }
    if (file.endsWith(".html")) {
      for (const match of text.matchAll(EXTERNAL_LOAD)) {
        // Links the user clicks are fine; loading from elsewhere is not.
        const tag = text.slice(text.lastIndexOf("<", match.index), match.index);
        if (!/^<a\b/i.test(tag)) {
          problems.push(`${relative}: loads from another origin: ${match[0]}`);
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error("Web build check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("Web build check passed: out/ is static, with no puppeteer and no /api/ calls.");

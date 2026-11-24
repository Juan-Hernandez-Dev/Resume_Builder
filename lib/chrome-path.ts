import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";

import { BROWSER_NOT_FOUND_MESSAGE } from "./pdf-export";

/**
 * Finding a Chrome (or Edge, or Chromium) the PDF export can drive.
 *
 * The app ships no browser of its own (it depends on `puppeteer-core`, not
 * `puppeteer`), so it uses the one already installed. `CHROME_PATH` wins when
 * it is set; otherwise the usual install locations are tried in order, Chrome
 * first. Everything platform specific is a parameter, so every branch can be
 * tested on any machine.
 */

type Env = Record<string, string | undefined>;

export type ChromeLookup = {
  env?: Env;
  platform?: NodeJS.Platform;
  exists?: (path: string) => boolean;
};

export type ChromeResolution =
  | { ok: true; path: string }
  | { ok: false; error: string };

export const CHROME_PATH_MISSING_MESSAGE =
  "CHROME_PATH is set, but no browser was found at that path. Point it at the Chrome, Edge or Chromium executable, or unset it to use an installed Google Chrome or Microsoft Edge.";

export function resolveChrome({
  env = process.env,
  platform = process.platform,
  exists = existsSync,
}: ChromeLookup = {}): ChromeResolution {
  const configured = readEnv(env, "CHROME_PATH")?.trim();
  if (configured) {
    // A path the user chose is never silently swapped for another browser.
    return exists(configured)
      ? { ok: true, path: configured }
      : { ok: false, error: CHROME_PATH_MISSING_MESSAGE };
  }

  const found = chromeCandidates(platform, env).find((path) => exists(path));
  return found
    ? { ok: true, path: found }
    : { ok: false, error: BROWSER_NOT_FOUND_MESSAGE };
}

/** Known install locations for a platform, most preferred first. */
export function chromeCandidates(platform: NodeJS.Platform, env: Env): string[] {
  switch (platform) {
    case "win32":
      return windowsCandidates(env);
    case "darwin":
      return macCandidates(env);
    case "linux":
      return LINUX_CANDIDATES;
    default:
      return [];
  }
}

function windowsCandidates(env: Env): string[] {
  const programFiles = readEnv(env, "PROGRAMFILES") ?? "C:\\Program Files";
  const programFilesX86 =
    readEnv(env, "PROGRAMFILES(X86)") ?? "C:\\Program Files (x86)";
  const localAppData = readEnv(env, "LOCALAPPDATA");

  const roots = [programFiles, programFilesX86, localAppData].filter(
    (root): root is string => Boolean(root),
  );
  const chrome = roots.map((root) =>
    win32.join(root, "Google", "Chrome", "Application", "chrome.exe"),
  );
  const chromium = localAppData
    ? [win32.join(localAppData, "Chromium", "Application", "chrome.exe")]
    : [];
  // Edge ships with Windows, which makes it the reliable last resort.
  const edge = [programFilesX86, programFiles].map((root) =>
    win32.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
  );

  return [...chrome, ...chromium, ...edge];
}

const MAC_APPS = [
  "Google Chrome.app/Contents/MacOS/Google Chrome",
  "Chromium.app/Contents/MacOS/Chromium",
  "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

function macCandidates(env: Env): string[] {
  const home = readEnv(env, "HOME");
  const roots = ["/Applications", ...(home ? [posix.join(home, "Applications")] : [])];
  return roots.flatMap((root) => MAC_APPS.map((app) => posix.join(root, app)));
}

const LINUX_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/usr/bin/microsoft-edge",
  "/usr/bin/microsoft-edge-stable",
];

/**
 * Environment variables are case-insensitive on Windows (`ProgramFiles` and
 * `PROGRAMFILES` are the same variable), but a plain object is not.
 */
function readEnv(env: Env, name: string): string | undefined {
  if (env[name] !== undefined) return env[name];
  const wanted = name.toLowerCase();
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === wanted);
  return key === undefined ? undefined : env[key];
}

/**
 * `npm run build:web`: the static web build, then the check that it is safe to
 * publish (scripts/check-web-build.mjs).
 *
 * A script rather than `NEXT_PUBLIC_APP_MODE=web next build` in package.json,
 * because npm runs scripts through cmd.exe on Windows, where that syntax does
 * not exist. The variable may also be set in the Vercel project settings; this
 * sets it either way, so the command alone always produces the web build.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...process.env, NEXT_PUBLIC_APP_MODE: "web" };

/** Runs a step in the project root, stopping the build if it fails. */
function run(command, args, { shell = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", shell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Through a shell, as one command line: `npx` is a .cmd shim on Windows.
run("npx next build", [], { shell: true });
run(process.execPath, ["scripts/check-web-build.mjs"]);

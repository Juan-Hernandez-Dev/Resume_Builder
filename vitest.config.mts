import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": projectRoot,
      // Next.js resolves `server-only` to this empty module on the server.
      // The tests run server modules directly, so they get the same one.
      "server-only": fileURLToPath(
        new URL("node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
    ],
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Each file starts PGlite and applies the migrations in `beforeAll`; with every file doing it at once, a slower
    // machine (Windows locally) passes the default 10 s
    hookTimeout: 30_000,
  },
});

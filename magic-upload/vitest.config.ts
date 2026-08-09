import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
    ],
    // Las suites contra Postgres usan esquemas aislados, pero comparten el servidor.
    testTimeout: 30_000,
    environment: "node",
  },
});

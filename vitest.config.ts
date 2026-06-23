import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  define: {
    __vite_ssr_exportName__: '(name) => (obj) => obj',
  },
  plugins: [],
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    globals: true,
    setupFiles: ["./server/test-setup.ts"],
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    // Tests load the full router graph via `await import("./routers")`, which can
    // take several seconds — the 5s default caused flaky timeout failures.
    testTimeout: 30000,
    // Each test file gets a fresh module registry so per-file vi.mock("./db")
    // does not leak across files; run files sequentially (vitest-3 replacement
    // for the deprecated `threads: false`).
    isolate: true,
    fileParallelism: false,
    hookTimeout: 10000,
  },
});

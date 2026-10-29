import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Component tests opt in with a `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});

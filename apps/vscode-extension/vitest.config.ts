import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@debugiq/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src/index.ts",
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});

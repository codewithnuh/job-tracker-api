import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";

// Manually load the .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    reporters: ["tree"],
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/db/migrations/**"],
    },
  },
});

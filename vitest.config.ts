import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";

// Manually load the .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // setupFiles: ["dotenv/config"], // You can keep or remove this now
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/db/migrations/**"],
    },
  },
});

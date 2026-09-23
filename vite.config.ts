import aitDevtools from "@apps-in-toss/devtools/unplugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [aitDevtools.vite(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});

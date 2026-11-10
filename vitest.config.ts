import { defineConfig } from "vitest/config";

// Restrict test discovery to TypeScript sources. Without this, `npm run build`
// emits compiled `dist/__tests__/*.test.js` files that Vitest would also pick
// up, running the whole suite twice.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

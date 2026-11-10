import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The Fastify API runs on :3000. Proxying /api keeps the browser on one
    // origin in development, so cookies/auth (when added) behave the same as
    // in production, where Fastify serves this build itself.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});

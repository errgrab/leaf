import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": { target: "http://backend:8000" },
      "/ws": { target: "ws://backend:8000", ws: true },
    },
  },
  build: {
    // Copy public assets to dist root
    emptyOutDir: true,
  },
  publicDir: "public",
});

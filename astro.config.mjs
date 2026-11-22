import { defineConfig } from "astro/config";

export default defineConfig({
  trailingSlash: "ignore",
  vite: {
    server: {
      proxy: {
        "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      },
    },
  },
});

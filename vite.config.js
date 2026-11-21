import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [react()],
  base: "/GenCityFirstYearHack/",
  resolve: {
    alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api/activity": { target: "http://127.0.0.1:5000", changeOrigin: false },
      "/api/desktop-pet": { target: "http://127.0.0.1:5000", changeOrigin: false },
      "/api": "http://127.0.0.1:5000",
    },
  },
});

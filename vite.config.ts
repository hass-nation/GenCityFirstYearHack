import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/GenCityFirstYearHack/",
  server: {
    proxy: {
      "/api/activity": { target: "http://127.0.0.1:5000", changeOrigin: false },
      "/api/desktop-pet": { target: "http://127.0.0.1:5000", changeOrigin: false },
      "/api": "http://127.0.0.1:5000",
    },
  },
});

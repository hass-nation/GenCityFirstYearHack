import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    define: { __API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL ?? "") },
    base: "/GenCityFirstYearHack/",
    server: {
      proxy: {
        "/api/activity": { target: "http://127.0.0.1:5000", changeOrigin: false },
        "/api": "http://127.0.0.1:5000",
      },
    },
  };
});

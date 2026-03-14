import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/yogo": {
        target: "https://api.yogo.dk",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yogo/, ""),
        headers: {
          origin: "https://strikershouse.yogobooking.pt",
          referer: "https://strikershouse.yogobooking.pt/",
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  // Поддерживаем переменные окружения Vite и Next-подобные
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  build: {
    outDir: "dist/client",
    chunkSizeWarningLimit: 5000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

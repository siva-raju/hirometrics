import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["test.hirometrics.com"],
    proxy: {
      "/api": {
        // In Docker, backend container is reachable as 'backend'
        // When running locally without Docker, use localhost:8000
        target: process.env.VITE_API_URL || "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});

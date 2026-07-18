import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://localhost:80", changeOrigin: true },
      "/auth": {
        target: "http://localhost:80",
        changeOrigin: true,
        // Let /auth/callback through to the React app so AuthCallback
        // can read the OAuth code from the URL query params.
        bypass: (req) => {
          if (req.url?.startsWith("/auth/callback")) return req.url;
        },
      },
    },
  },
});

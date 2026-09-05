import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png"],
      manifest: {
        id: "/",
        name: "Chess Prodigy",
        short_name: "Chess Prodigy",
        description: "Play, learn openings and review your chess games. Works offline.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#2f6b3a",
        background_color: "#f4ead6",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/verification\//, /^\/api\//],
      },
    }),
  ],
  server: {
    proxy: { "/api": "http://127.0.0.1:4317" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx,ts,tsx}"],
  },
});

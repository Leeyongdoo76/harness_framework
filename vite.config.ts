import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// GitHub Pages project pages (/{user}.github.io/harness_framework/) 배포 대응.
// build 시점에만 base prefix 적용 — dev (serve) 는 localhost:5173/ 그대로.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  base: command === "build" ? "/harness_framework/" : "/",
}));

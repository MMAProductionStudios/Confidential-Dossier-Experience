/**
 * Vite configuration for Expediente CSC-2026-MB
 * Pure vanilla HTML5 / CSS3 / JavaScript — no framework dependencies.
 * Compatible with GitHub Pages output (static build).
 */
import { defineConfig } from "vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  // Base path for assets — override with BASE_PATH env var.
  // For GitHub Pages deployment, set this to "/<repo-name>/"
  base: basePath,

  // No framework plugins — pure static file serving
  plugins: [],

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

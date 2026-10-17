import { defineConfig } from "vite";
export default defineConfig({
  // Relative asset URLs work at both a repository subpath and a custom domain.
  base: "./",
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});

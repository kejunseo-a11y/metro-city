import { build } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
// A second artifact for browsers that cannot connect to the local preview server.
const result = await build({
  configFile: false,
  build: {
    write: false,
    rollupOptions: {
      input: resolve("src/main.ts"),
      output: { format: "iife", name: "MetroCity", inlineDynamicImports: true },
    },
    assetsInlineLimit: Infinity,
  },
});
const files = (Array.isArray(result) ? result : [result]).flatMap(
  (r) => r.output,
);
const code = files
  .filter((f) => f.type === "chunk")
  .map((f) => f.code)
  .join("\n");
const css = files
  .filter((f) => f.type === "asset" && f.fileName.endsWith(".css"))
  .map((f) => String(f.source))
  .join("\n");
const template = await readFile("index.html", "utf8");
const html = template
  .replace("</head>", `<style>${css}</style></head>`)
  .replace(
    /<script[^>]*src="\/src\/main.ts"[^>]*><\/script>/,
    () => `<script>${code.replaceAll("</script", "<\\/script")}</script>`,
  );
await writeFile("Metro-City-Play.html", html, "utf8");
console.log("Created Metro-City-Play.html (offline, no server required)");

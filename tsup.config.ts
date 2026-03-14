import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  minify: false,
  outDir: "dist",
  shims: false,
  sourcemap: true,
  target: "node20",
});

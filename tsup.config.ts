import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
  // Per-format .d.mts + .d.cts so the package.json exports field can carry
  // a `types` condition inside each branch — "Are The Types Wrong" then
  // resolves the right declaration file in both node10 and node16 modes
  // without masquerading.
  dts: { resolve: true },
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
  platform: "neutral",
});

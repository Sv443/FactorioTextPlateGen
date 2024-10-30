import pluginTypescript from "@rollup/plugin-typescript";
import { nodeResolve as pluginNodeResolve } from "@rollup/plugin-node-resolve";
import pluginJson from "@rollup/plugin-json";
import typescript from "typescript";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/bundle.js",
    format: "iife",
  },
  plugins: [
    pluginNodeResolve(),
    pluginJson(),
    pluginTypescript({
      typescript,
    }),
  ],
};

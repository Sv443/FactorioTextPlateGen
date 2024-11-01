#!/usr/bin/env node

import { spawn } from "node:child_process";
import { join } from "node:path";

const child = spawn("node", [
  "--no-warnings=ExperimentalWarning",
  "--enable-source-maps",
  "--loader=ts-node/esm",
  join(import.meta.dirname, "./main.ts"),
  "--",
  `--caller-path=${btoa(process.cwd())}`,
  ...process.argv.slice(2),
], {
  stdio: "inherit",
  cwd: join(import.meta.dirname, "../"),
});

child.on("exit", (code, signal) => {
  if(code)
    setImmediate(() => process.exit(code));
  else if(signal)
    setImmediate(() => process.kill(process.pid, signal));
});

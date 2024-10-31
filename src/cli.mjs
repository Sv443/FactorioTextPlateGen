#!/usr/bin/env node

import { spawn } from "node:child_process";
import { join } from "node:path";

const child = spawn("node", [join(import.meta.dirname, "../dist/src/index.js")], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if(code)
    setImmediate(() => process.exit(code));
  else if(signal)
    setImmediate(() => process.kill(process.pid, signal));
});

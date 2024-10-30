#!/usr/bin/env node

import { spawn } from "node:child_process";
import { join } from "node:path";

const child = spawn("node", [join(import.meta.dirname, "../dist/src/index.js")], {
  stdio: "inherit",
});

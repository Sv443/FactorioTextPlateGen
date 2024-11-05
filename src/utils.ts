import { readFile, stat } from "node:fs/promises";

/** Shows a "Press any key to continue..." message and waits for a key press until resolving with the key that was pressed */
export function pause(text = "Press any key to continue...", exitOnCtrlC = true): Promise<string | void> {
  const initialRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);

  return new Promise((resolve, reject) => {
    process.stdout.write(`${text} `);
    process.stdin.resume();

    const onData = (chunk: string) => {
      // exit on Ctrl+C
      if(/\u0003/gu.test(chunk)) { // eslint-disable-line no-control-regex
        if(exitOnCtrlC)
          return schedExit();
        else
          return resolve();
      }

      process.stdout.write("\n");
      process.stdin.pause();

      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("error", onError);

      process.stdin.setRawMode(initialRaw);

      return resolve(chunk.toString());
    }

    const onError = (err: unknown) => {
      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("error", onError);

      process.stdin.setRawMode(initialRaw);

      return reject(err);
    }

    process.stdin.on("data", onData);
    process.stdin.on("error", onError);
  });
}

/** Checks if the given path exists, is a file and is readable by the process */
export async function fileReadable(filePath: string) {
  try {
    if(!(await stat(filePath)).isFile())
      return false;
    await readFile(filePath);
    return true;
  }
  catch {
    return false;
  }
}

/** Checks if the given path exists and is a directory */
export async function dirExists(dirPath: string) {
  try {
    return (await stat(dirPath)).isDirectory();
  }
  catch {
    return false;
  }
}

/** Schedules a process exit with the given code in the macrotask queue (after all promises and I/O callbacks are processed) */
export function schedExit(code = 0) {
  setImmediate(() => process.exit(code));
}

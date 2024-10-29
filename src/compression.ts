import { createInflate } from "node:zlib";
import type { FactorioBP } from "./types.js";

/**
 * Decodes a Factorio blueprint string.  
 * @returns The version of the blueprint and the data as an object.
 */
export async function decodeBpString(blueprint: string): Promise<({ version: number } & FactorioBP) | void> {
  try {
    const version = blueprint.slice(0, 1).charCodeAt(0);
    const deflated = Buffer.from(blueprint.slice(1), "base64");
    const inflate = createInflate({
      level: 9,
    });
    const promise = new Promise<Buffer>((resolve, reject) => {
      inflate.on("data", (data) => {
        resolve(data);
      });
      inflate.on("error", (error) => {
        reject(error);
      });
    });
    inflate.write(deflated);
    inflate.end();
    const inflatedBuf = await promise;
    const inflated = inflatedBuf.toString("utf8");
    const bpData = JSON.parse(inflated);
    if(!("blueprint" in bpData))
      throw new Error("Blueprint string does not contain valid blueprint data.");

    return { version, ...bpData };
  }
  catch(err) {
    //@ts-ignore
    throw new Error("Failed to decode blueprint string.", { cause: err });
  }
}

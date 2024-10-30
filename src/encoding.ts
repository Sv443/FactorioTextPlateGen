import { createDeflate, createInflate, ZlibOptions } from "node:zlib";
import type { FactorioBP } from "./types.js";

/** Options for zlib compression. */
const zlibOpts: ZlibOptions = {
  // Factorio wiki says level 9
  level: 9,
};

/** Decodes a base64-encoded, deflated Factorio blueprint string into an object. */
export async function decodeBp(blueprint: string): Promise<({ version: number } & FactorioBP) | void> {
  try {
    const version = blueprint.charCodeAt(0);
    const deflated = Buffer.from(blueprint.slice(1), "base64");
    const inflate = createInflate(zlibOpts);

    const promise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      inflate.on("data", (data) => {
        chunks.push(data);
      });

      inflate.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      inflate.on("error", (error) => {
        reject(error);
      });
    });

    inflate.write(deflated, "base64");
    inflate.end();

    const inflatedBuf = await promise;
    const inflated = inflatedBuf.toString("utf8");

    try {
      const bpData = JSON.parse(inflated);
      if(!("blueprint" in bpData))
        throw new Error("Blueprint string does not contain valid blueprint data.");

      return { version, ...bpData };
    }
    catch(err) {
      //@ts-ignore
      throw new Error("Failed to parse blueprint data.", { cause: err });
    }
  }
  catch(err) {
    //@ts-ignore
    throw new Error("Failed to decode blueprint string.", { cause: err });
  }
}

/** Converts a Factorio blueprint object into a deflated, base64-encoded string. */
export async function encodeBp(bp: FactorioBP, version: number): Promise<string> {
  try {
    const bpData = Buffer.from(JSON.stringify(bp), "utf8");
    const deflate = createDeflate(zlibOpts);

    const promise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      deflate.on("data", (data) => {
        chunks.push(data);
      });

      deflate.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      deflate.on("error", (error) => {
        reject(error);
      });
    });

    deflate.write(bpData, "utf8");
    deflate.end();

    const deflatedBuf = await promise;
    const deflated = deflatedBuf.toString("base64");

    return String.fromCharCode(version) + deflated;
  }
  catch(err) {
    //@ts-ignore
    throw new Error("Failed to encode blueprint data.", { cause: err });
  }
}

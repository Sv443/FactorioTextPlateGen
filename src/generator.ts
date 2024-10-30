import characters from "./characters.json" with { type: "json" };
import packageJson from "../package.json" with { type: "json" };
import type { FactorioBP, TextDirection, TextPlateMaterial, TextPlateSize } from "./types.js";

export type GenerateTextPlateBpSettings = {
  /** Size of the text plate. Default is `small` */
  size?: TextPlateSize;
  /** Material of the text plate. Default is `copper` */
  material?: TextPlateMaterial;
  /** Tiles of space between lines. `0` for no space. Default is `1` */
  lineSpacing?: number;
  /** Text direction. Default is `ltr` (left to right) */
  textDirection?: TextDirection;
  /** Maximum length of a line. Default is `0` (infinite) */
  maxLineLength?: number;
  /** Label of the blueprint. Default is `Text plates` */
  bpLabel?: string;
  /** Version of the blueprint. Default is `562949954207746` */
  version?: number;
};

export const defaultGenerateTextPlateBpSettings: Required<GenerateTextPlateBpSettings> = {
  size: "small",
  material: "copper",
  lineSpacing: 1,
  textDirection: "ltr",
  maxLineLength: 0,
  bpLabel: "Text plates",
  version: 562949954207746,
} as const;

/** Creates a Factorio blueprint object from the input text with the provided settings */
export function createTextPlateBp(
  input: string,
  settings: GenerateTextPlateBpSettings = defaultGenerateTextPlateBpSettings,
): FactorioBP {
  const {
    size,
    material,
    lineSpacing,
    textDirection,
    maxLineLength,
    bpLabel,
    version,
  } = { ...defaultGenerateTextPlateBpSettings, ...settings };

  const lines = getTextWithMaxLineLen(input, maxLineLength).split("\n");
  const entities: FactorioBP["blueprint"]["entities"] = [];

  for(let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for(let x = 0; x < line.length; x++) {
      const char = line[x];
      if(char === " ")
        continue;

      const sizeMult = size === "small" ? 1 : 2;
      const textDirMult = textDirection === "rtl" ? -1 : 1;

      entities.push({
        entity_number: entities.length + 1,
        name: `textplate-${size}-${material}`,
        position: {
          x: (x * sizeMult) * textDirMult + 0.5,
          y: (y * sizeMult + y * (lineSpacing ?? 0)) * textDirMult + 0.5,
        },
        variation: resolveTextPlateVariant(char),
      });
    }
  }

  const descriptionRaw = `[item=textplate-${size}-${material}] ${packageJson.homepage}\n${input} [item=textplate-${size}-${material}]`;
  const description = descriptionRaw.length > 499 ? descriptionRaw.slice(0, 496) + "..." : descriptionRaw;

  /** The first four letters or digits of the input text */
  const firstFourLetters = input.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4);

  const icons = firstFourLetters.length > 0
    ? firstFourLetters.split("").map((ch, i) => ({
      signal: {
        type: "virtual",
        name: `signal-${ch.toUpperCase()}`
      },
      index: i + 1,
    }))
    : [
      { signal: { name: `textplate-${size}-${material}` }, index: 1 },
    ];

  return {
    blueprint: {
      item: "blueprint",
      label: bpLabel,
      description,
      version,
      icons,
      entities,
    },
  };
}

/**
 * Returns the given text with a maximum line length applied by inserting newlines.  
 * If the new line breaks are inside a word, they will be moved to the start of the word at the boundary.
 */
export function getTextWithMaxLineLen(text: string, maxLineLength: number) {
  if(maxLineLength <= 0)
    return text;

  const words = text.split(" ");
  let line = "";
  let result = "";
  for(const word of words) {
    if(line.length + word.length + 1 <= maxLineLength) {
      line += (line.length > 0 ? " " : "") + word;
    }
    else {
      result += (result.length > 0 ? "\n" : "") + line;
      line = word;
    }
  }
  result += (result.length > 0 ? "\n" : "") + line;

  return result;
}

/** Tries to resolve the 1-indexed variant number from the passed character */
export function resolveTextPlateVariant(character: string): number {
  return Object.entries(characters).find(
    ([_, value]) => value.char === character || ("replacements" in value && value.replacements.includes(character))
  )?.[1].variant ?? characters["Cog"].variant;
}

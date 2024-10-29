import characters from "./characters.json" with { type: "json" };
import type { FactorioBP, TextPlateMaterial, TextPlateSize } from "./types.ts";

export type GenerateTextPlateBpSettings = {
  /** Size of the text plate. Default is `small` */
  size?: TextPlateSize;
  /** Material of the text plate. Default is `copper` */
  material?: TextPlateMaterial;
  /** Tiles of space between lines. `0` for no space. Default is `1` */
  lineSpacing?: number;
  /** Version of the blueprint. Default is `562949954207746` */
  version?: number;
};

export const defaultGenerateTextPlateBpSettings: Required<GenerateTextPlateBpSettings> = {
  size: "small",
  material: "copper",
  lineSpacing: 1,
  version: 562949954207746,
} as const;

/** Creates a Factorio blueprint object from the input text with the provided settings */
export function createTextPlateBp(
  input: string,
  settings: GenerateTextPlateBpSettings = defaultGenerateTextPlateBpSettings,
): FactorioBP {
  const { size, material, lineSpacing, version } = { ...defaultGenerateTextPlateBpSettings, ...settings };

  const lines = input.split("\n");
  const entities: FactorioBP["blueprint"]["entities"] = [];

  for(let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for(let x = 0; x < line.length; x++) {
      const char = line[x];
      if(char === " ")
        continue;

      entities.push({
        entity_number: entities.length + 1,
        name: `textplate-${size}-${material}`,
        position: {
          x: size === "small" ? x : x * 2 + 0.5,
          y: (size === "small" ? y : y * 2) + y * (lineSpacing ?? 0) + 0.5,
        },
        variation: resolveTextPlateVariant(char),
      });
    }
  }

  return {
    blueprint: {
      icons: [
        { signal: { name: `textplate-${size}-${material}` }, index: 1 },
      ],
      entities,
      item: "blueprint",
      version,
    },
  };
}

/** Tries to resolve the 1-indexed variant number from the passed character */
export function resolveTextPlateVariant(character: string): number {
  return Object.entries(characters).find(
    ([_, value]) => value.char === character || ("replacements" in value && value.replacements.includes(character))
  )?.[1].variant ?? characters["Cog"].variant;
}

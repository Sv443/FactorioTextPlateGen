/** See https://wiki.factorio.com/Blueprint_string_format#Json_representation_of_a_blueprint%2Fblueprint_book */
export type FactorioBP = {
  blueprint: {
    icons: Array<{
      signal: {
        name: string;
      };
      index: number;
    }>;
    entities: Array<{
      entity_number: number;
      name: string;
      position: {
        x: number;
        y: number;
      };
      variation?: number;
      direction?: number;
    }>;
    item: "blueprint";
    version: number;
  }
};

export type TextDirection = "ltr" | "rtl";

export type TextPlateSize = "small" | "large";

export type TextPlateMaterial =
  | "concrete"
  | "copper"
  | "glass"
  | "gold"
  | "iron"
  | "plastic"
  | "steel"
  | "stone"
  | "uranium";

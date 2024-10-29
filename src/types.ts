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

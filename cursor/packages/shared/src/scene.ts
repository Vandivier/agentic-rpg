export interface Scene {
  id: string;
  chapter: number;
  title: string;
  synopsis: string;
  flags: Record<string, boolean>;
  npcs: string[];
  exits: string[];
  imageRefs: string[];
}

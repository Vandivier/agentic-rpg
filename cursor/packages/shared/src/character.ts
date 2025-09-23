export interface Abilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  abilities: Abilities;
  proficiencies: string[];
  hp: number;
  resources: Record<string, number>;
  inventory: string[];
}

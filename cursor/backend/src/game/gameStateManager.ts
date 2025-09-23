import { Character, Scene, Session } from "@agentic-rpg/shared";

// For the MVP, we'll use a simple in-memory store.
// This will be replaced with a persistent solution later.

interface GameState {
  session: Session | null;
  playerCharacter: Character | null;
  currentScene: Scene | null;
}

const state: GameState = {
  session: null,
  playerCharacter: null,
  currentScene: null,
};

export const gameStateManager = {
  getState: () => ({ ...state }),
  initializeNewGame: (seed: string | number) => {
    // For now, we'll use hardcoded initial data.
    // This will be expanded to support different starting scenarios.
    state.session = {
      id: `session-${Date.now()}`,
      playerId: "player-1",
      startedAt: new Date(),
      seed,
      difficulty: "Standard",
      settings: {},
    };

    state.playerCharacter = {
      id: "pc-1",
      name: "Aria",
      level: 1,
      abilities: { str: 10, dex: 14, con: 12, int: 13, wis: 15, cha: 8 },
      proficiencies: ["acrobatics", "stealth"],
      hp: 10,
      resources: { spellSlots: 2 },
      inventory: ["dagger", "lockpicks"],
    };

    state.currentScene = {
      id: "crypt_entrance",
      chapter: 1,
      title: "Crypt Entrance",
      synopsis:
        "A heavy stone door stands before you, covered in moss and ancient carvings. The air is cold and smells of damp earth.",
      flags: { doorOpen: false },
      npcs: [],
      exits: ["inside_crypt", "forest"],
      imageRefs: ["crypt_entrance_day.png"],
    };

    return { ...state };
  },
  updatePlayerCharacter: (updates: Partial<Character>) => {
    if (state.playerCharacter) {
      state.playerCharacter = { ...state.playerCharacter, ...updates };
    }
    return state.playerCharacter;
  },
  updateScene: (updates: Partial<Scene>) => {
    if (state.currentScene) {
      state.currentScene = { ...state.currentScene, ...updates };
    }
    return state.currentScene;
  },
};

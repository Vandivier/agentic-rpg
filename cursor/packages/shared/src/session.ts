export interface Session {
  id: string;
  playerId: string;
  startedAt: Date;
  seed: string | number;
  difficulty: "Novice" | "Standard" | "Challenging";
  settings: Record<string, any>;
}

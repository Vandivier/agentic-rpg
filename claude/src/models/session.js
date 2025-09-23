export class Session {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.playerId = data.playerId;
    this.startedAt = data.startedAt || new Date().toISOString();
    this.seed = data.seed || Math.floor(Math.random() * 1000000);
    this.difficulty = data.difficulty || 'Standard';
    this.settings = data.settings || {
      ageRating: 'Teen',
      imageQuality: 'preview',
      autoSave: true,
      soundEnabled: true
    };
    this.currentSceneId = data.currentSceneId || null;
    this.turnCount = data.turnCount || 0;
    this.lastActivity = data.lastActivity || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      playerId: this.playerId,
      startedAt: this.startedAt,
      seed: this.seed,
      difficulty: this.difficulty,
      settings: this.settings,
      currentSceneId: this.currentSceneId,
      turnCount: this.turnCount,
      lastActivity: this.lastActivity
    };
  }

  static fromJSON(data) {
    return new Session(data);
  }
}
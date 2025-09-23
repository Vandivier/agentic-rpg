export class Scene {
  constructor(data = {}) {
    this.id = data.id;
    this.chapter = data.chapter || 1;
    this.title = data.title || '';
    this.synopsis = data.synopsis || '';
    this.flags = data.flags || {};
    this.npcs = data.npcs || [];
    this.exits = data.exits || [];
    this.imageRefs = data.imageRefs || [];
    this.tags = data.tags || [];
    this.canonicalFacts = data.canonicalFacts || [];
    this.difficulty = data.difficulty || 'Standard';
    this.encounterType = data.encounterType || 'narrative';
  }

  updateFlag(key, value) {
    this.flags[key] = value;
  }

  getFlag(key) {
    return this.flags[key];
  }

  addNPC(npc) {
    this.npcs.push(npc);
  }

  removeNPC(npcId) {
    this.npcs = this.npcs.filter(npc => npc.id !== npcId);
  }

  addExit(exit) {
    this.exits.push(exit);
  }

  toJSON() {
    return {
      id: this.id,
      chapter: this.chapter,
      title: this.title,
      synopsis: this.synopsis,
      flags: this.flags,
      npcs: this.npcs,
      exits: this.exits,
      imageRefs: this.imageRefs,
      tags: this.tags,
      canonicalFacts: this.canonicalFacts,
      difficulty: this.difficulty,
      encounterType: this.encounterType
    };
  }

  static fromJSON(data) {
    return new Scene(data);
  }
}
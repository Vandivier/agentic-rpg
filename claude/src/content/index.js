import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ContentLoader {
  constructor() {
    this.lorebook = null;
    this.scenes = null;
  }

  async loadContent() {
    try {
      await Promise.all([
        this.loadLorebook(),
        this.loadScenes()
      ]);

      console.log('Content loaded successfully');
      return true;

    } catch (error) {
      console.error('Error loading content:', error);
      return false;
    }
  }

  async loadLorebook() {
    const lorebookPath = path.join(__dirname, 'lorebook.yaml');
    const lorebookContent = fs.readFileSync(lorebookPath, 'utf8');
    this.lorebook = yaml.parse(lorebookContent);
  }

  async loadScenes() {
    const scenesPath = path.join(__dirname, 'scenes.yaml');
    const scenesContent = fs.readFileSync(scenesPath, 'utf8');
    this.scenes = yaml.parse(scenesContent);
  }

  getLorebook() {
    return this.lorebook;
  }

  getScenes() {
    return this.scenes;
  }

  getScene(sceneId) {
    if (!this.scenes || !this.scenes.scenes) return null;
    return this.scenes.scenes[sceneId];
  }

  getNPC(npcId) {
    if (!this.lorebook || !this.lorebook.npcs) return null;
    return this.lorebook.npcs[npcId];
  }

  getLocation(locationId) {
    if (!this.lorebook || !this.lorebook.locations) return null;
    return this.lorebook.locations[locationId];
  }

  searchByKeywords(keywords) {
    const results = {
      npcs: [],
      locations: [],
      events: []
    };

    if (!this.lorebook) return results;

    keywords = keywords.map(k => k.toLowerCase());

    if (this.lorebook.npcs) {
      Object.entries(this.lorebook.npcs).forEach(([id, npc]) => {
        if (npc.knowledge) {
          npc.knowledge.forEach(knowledge => {
            if (knowledge.keywords &&
                knowledge.keywords.some(keyword =>
                  keywords.includes(keyword.toLowerCase()))) {
              results.npcs.push({ id, npc, knowledge });
            }
          });
        }
      });
    }

    if (this.lorebook.locations) {
      Object.entries(this.lorebook.locations).forEach(([id, location]) => {
        if (location.tags &&
            location.tags.some(tag => keywords.includes(tag.toLowerCase()))) {
          results.locations.push({ id, location });
        }
      });
    }

    return results;
  }

  getRandomScene(tags = []) {
    if (!this.scenes || !this.scenes.scenes) return null;

    const sceneEntries = Object.entries(this.scenes.scenes);

    if (tags.length === 0) {
      const randomIndex = Math.floor(Math.random() * sceneEntries.length);
      return sceneEntries[randomIndex][1];
    }

    const matchingScenes = sceneEntries.filter(([id, scene]) => {
      return scene.tags && scene.tags.some(tag => tags.includes(tag));
    });

    if (matchingScenes.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * matchingScenes.length);
    return matchingScenes[randomIndex][1];
  }

  getStoryHooks() {
    if (!this.scenes || !this.scenes.story_hooks) return [];
    return this.scenes.story_hooks;
  }

  getEncounterTemplate(type) {
    if (!this.scenes || !this.scenes.encounter_templates) return null;
    return this.scenes.encounter_templates[type];
  }

  validateContent() {
    const issues = [];

    if (!this.lorebook) {
      issues.push('Lorebook not loaded');
    } else {
      if (!this.lorebook.npcs) issues.push('No NPCs defined in lorebook');
      if (!this.lorebook.locations) issues.push('No locations defined in lorebook');
    }

    if (!this.scenes) {
      issues.push('Scenes not loaded');
    } else {
      if (!this.scenes.scenes) issues.push('No scenes defined');
    }

    if (this.scenes && this.scenes.scenes) {
      Object.entries(this.scenes.scenes).forEach(([id, scene]) => {
        if (!scene.title) issues.push(`Scene ${id} missing title`);
        if (!scene.description) issues.push(`Scene ${id} missing description`);
        if (!scene.tags || scene.tags.length === 0) {
          issues.push(`Scene ${id} missing tags`);
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  getContentStats() {
    const stats = {
      lorebook: {
        npcs: 0,
        locations: 0,
        organizations: 0,
        events: 0
      },
      scenes: {
        total: 0,
        byChapter: {},
        byType: {}
      }
    };

    if (this.lorebook) {
      if (this.lorebook.npcs) {
        stats.lorebook.npcs = Object.keys(this.lorebook.npcs).length;
      }
      if (this.lorebook.locations) {
        stats.lorebook.locations = Object.keys(this.lorebook.locations).length;
      }
      if (this.lorebook.organizations) {
        stats.lorebook.organizations = Object.keys(this.lorebook.organizations).length;
      }
      if (this.lorebook.historical_events) {
        stats.lorebook.events = Object.keys(this.lorebook.historical_events).length;
      }
    }

    if (this.scenes && this.scenes.scenes) {
      const sceneEntries = Object.entries(this.scenes.scenes);
      stats.scenes.total = sceneEntries.length;

      sceneEntries.forEach(([id, scene]) => {
        const chapter = scene.chapter || 1;
        stats.scenes.byChapter[chapter] = (stats.scenes.byChapter[chapter] || 0) + 1;

        const type = scene.encounter_type || 'unknown';
        stats.scenes.byType[type] = (stats.scenes.byType[type] || 0) + 1;
      });
    }

    return stats;
  }
}

export const contentLoader = new ContentLoader();
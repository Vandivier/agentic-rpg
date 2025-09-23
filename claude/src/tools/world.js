export class WorldTool {
  static gameState = {
    scenes: new Map(),
    globalFlags: {},
    time: {
      day: 1,
      hour: 12,
      timeOfDay: 'midday'
    },
    weather: 'clear'
  };

  static updateScene(sceneId, updates) {
    const scene = this.gameState.scenes.get(sceneId);
    if (!scene) {
      return {
        ok: false,
        error: `Scene ${sceneId} not found`
      };
    }

    if (updates.flags) {
      Object.assign(scene.flags, updates.flags);
    }

    if (updates.npcs) {
      updates.npcs.forEach(npc => {
        const existing = scene.npcs.find(n => n.id === npc.id);
        if (existing) {
          Object.assign(existing, npc);
        } else {
          scene.npcs.push(npc);
        }
      });
    }

    if (updates.exits) {
      scene.exits = updates.exits;
    }

    return {
      ok: true,
      scene: scene.toJSON()
    };
  }

  static updateGlobalFlag(key, value) {
    this.gameState.globalFlags[key] = value;
    return {
      ok: true,
      flag: key,
      value,
      allFlags: this.gameState.globalFlags
    };
  }

  static getGlobalFlag(key) {
    return this.gameState.globalFlags[key];
  }

  static advanceTime(hours = 1) {
    const oldTime = { ...this.gameState.time };

    this.gameState.time.hour += hours;

    while (this.gameState.time.hour >= 24) {
      this.gameState.time.hour -= 24;
      this.gameState.time.day += 1;
    }

    this.gameState.time.timeOfDay = this.getTimeOfDay(this.gameState.time.hour);

    return {
      ok: true,
      oldTime,
      newTime: this.gameState.time,
      hoursAdvanced: hours
    };
  }

  static getTimeOfDay(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  static setWeather(weather) {
    const validWeather = ['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'];
    if (!validWeather.includes(weather)) {
      return {
        ok: false,
        error: 'Invalid weather type',
        validTypes: validWeather
      };
    }

    const oldWeather = this.gameState.weather;
    this.gameState.weather = weather;

    return {
      ok: true,
      oldWeather,
      newWeather: weather
    };
  }

  static getScene(sceneId) {
    const scene = this.gameState.scenes.get(sceneId);
    return scene ? scene.toJSON() : null;
  }

  static addScene(scene) {
    this.gameState.scenes.set(scene.id, scene);
    return {
      ok: true,
      sceneId: scene.id
    };
  }

  static getGameState() {
    return {
      scenes: Array.from(this.gameState.scenes.values()).map(s => s.toJSON()),
      globalFlags: this.gameState.globalFlags,
      time: this.gameState.time,
      weather: this.gameState.weather
    };
  }

  static resetGameState() {
    this.gameState = {
      scenes: new Map(),
      globalFlags: {},
      time: {
        day: 1,
        hour: 12,
        timeOfDay: 'midday'
      },
      weather: 'clear'
    };

    return { ok: true };
  }

  static questUpdate(questId, updates) {
    const questKey = `quest_${questId}`;
    const quest = this.gameState.globalFlags[questKey] || {
      id: questId,
      status: 'inactive',
      objectives: [],
      completedObjectives: []
    };

    if (updates.status) {
      quest.status = updates.status;
    }

    if (updates.addObjective) {
      quest.objectives.push(updates.addObjective);
    }

    if (updates.completeObjective) {
      const objIndex = quest.objectives.indexOf(updates.completeObjective);
      if (objIndex > -1) {
        quest.objectives.splice(objIndex, 1);
        quest.completedObjectives.push(updates.completeObjective);
      }
    }

    this.gameState.globalFlags[questKey] = quest;

    return {
      ok: true,
      quest
    };
  }
}
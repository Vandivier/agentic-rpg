import { RulesTool, CombatTool, InventoryTool, WorldTool, SafetyTool } from '../tools/index.js';

export class DMAgent {
  constructor(lorebook, options = {}) {
    this.lorebook = lorebook;
    this.options = {
      maxNarrationWords: options.maxNarrationWords || 120,
      choiceCount: options.choiceCount || 3,
      ageRating: options.ageRating || 'Teen',
      ...options
    };
  }

  async processPlayerAction(session, scene, character, playerInput, trace) {
    try {
      const plan = await this.createPlan(playerInput, scene, character);
      trace.addOutput({ type: 'plan', content: plan });

      const toolResults = await this.executePlan(plan, character, scene, trace);

      const safetyCheck = SafetyTool.check(toolResults.narration || '', this.options.ageRating);
      if (!safetyCheck.ok) {
        const sanitized = SafetyTool.sanitize(toolResults.narration, this.options.ageRating);
        toolResults.narration = sanitized.sanitized;
        trace.addOutput({ type: 'safety_redaction', content: sanitized.redactions });
      }

      const response = await this.generateResponse(toolResults, scene, character);

      return {
        narration: response.narration,
        actionLog: response.actionLog,
        choices: response.choices,
        stateUpdates: response.stateUpdates,
        imageRequest: response.imageRequest
      };

    } catch (error) {
      console.error('DM Agent error:', error);
      return this.generateFallbackResponse(error, scene);
    }
  }

  async createPlan(playerInput, scene, character) {
    const plan = {
      steps: [],
      requiresRoll: false,
      requiresWorldUpdate: false,
      requiresImage: true,
      seed: Math.floor(Math.random() * 1000000)
    };

    const action = this.parsePlayerAction(playerInput);

    if (action.type === 'skill_check') {
      plan.requiresRoll = true;
      plan.steps.push({
        tool: 'rules/check',
        args: {
          seed: plan.seed,
          actor: character,
          ability: action.ability,
          proficient: action.proficient,
          dc: action.dc,
          advantage: action.advantage,
          disadvantage: action.disadvantage,
          context: action.context
        }
      });
    }

    if (action.type === 'combat') {
      plan.steps.push({
        tool: 'combat/resolveTurn',
        args: {
          seed: plan.seed,
          attacker: character,
          target: action.target,
          attack: action.attack,
          targetAC: action.targetAC
        }
      });
    }

    if (action.modifiesWorld) {
      plan.requiresWorldUpdate = true;
      plan.steps.push({
        tool: 'world/update',
        args: {
          sceneId: scene.id,
          flags: action.worldChanges
        }
      });
    }

    if (action.modifiesInventory) {
      plan.steps.push({
        tool: 'inventory/update',
        args: {
          actor: character,
          delta: action.inventoryChanges
        }
      });
    }

    if (plan.requiresImage) {
      plan.steps.push({
        tool: 'images/request',
        args: {
          sceneId: scene.id,
          prompt: this.generateImagePrompt(scene, action),
          mode: 'preview',
          seed: plan.seed
        }
      });
    }

    return plan;
  }

  parsePlayerAction(input) {
    const action = {
      type: 'narrative',
      modifiesWorld: false,
      modifiesInventory: false,
      text: input.toLowerCase()
    };

    const skillPatterns = {
      stealth: /\b(?:sneak|hide|stealth)\b/i,
      lockpick: /\b(?:pick.*lock|lockpick|unlock)\b/i,
      climb: /\b(?:climb|scale)\b/i,
      persuade: /\b(?:persuade|convince|talk)\b/i,
      deceive: /\b(?:lie|deceive|bluff)\b/i,
      intimidate: /\b(?:intimidate|threaten)\b/i,
      investigate: /\b(?:search|investigate|examine)\b/i,
      perception: /\b(?:look|listen|perceive|notice)\b/i
    };

    for (const [skill, pattern] of Object.entries(skillPatterns)) {
      if (pattern.test(input)) {
        action.type = 'skill_check';
        action.skill = skill;
        action.ability = this.getSkillAbility(skill);
        action.proficient = true;
        action.dc = this.determineDC(input, skill);
        break;
      }
    }

    const combatPattern = /\b(?:attack|fight|strike|hit|shoot)\b/i;
    if (combatPattern.test(input)) {
      action.type = 'combat';
    }

    const takePattern = /\b(?:take|grab|pick up|get)\b/i;
    if (takePattern.test(input)) {
      action.modifiesInventory = true;
      action.inventoryChanges = { itemsAdd: ['item'] };
    }

    return action;
  }

  getSkillAbility(skill) {
    const skillAbilityMap = {
      'stealth': 'DEX',
      'lockpick': 'DEX',
      'climb': 'STR',
      'persuade': 'CHA',
      'deceive': 'CHA',
      'intimidate': 'CHA',
      'investigate': 'INT',
      'perception': 'WIS'
    };
    return skillAbilityMap[skill] || 'DEX';
  }

  determineDC(input, skill) {
    if (input.includes('carefully') || input.includes('slowly')) {
      return RulesTool.getDifficultyClass('Easy');
    }
    if (input.includes('quickly') || input.includes('rush')) {
      return RulesTool.getDifficultyClass('Hard');
    }
    return RulesTool.getDifficultyClass('Moderate');
  }

  async executePlan(plan, character, scene, trace) {
    const results = {
      toolOutputs: [],
      narrationElements: []
    };

    for (const step of plan.steps) {
      const startTime = Date.now();
      let result;

      try {
        switch (step.tool) {
          case 'rules/check':
            result = RulesTool.check(step.args);
            break;
          case 'combat/resolveTurn':
            result = CombatTool.resolveTurn(step.args);
            break;
          case 'inventory/update':
            result = InventoryTool.update(step.args.actor, step.args.delta);
            break;
          case 'world/update':
            result = WorldTool.updateScene(step.args.sceneId, step.args);
            break;
          case 'images/request':
            result = { jobId: `img_${Date.now()}`, etaSec: 3 };
            break;
          default:
            result = { error: `Unknown tool: ${step.tool}` };
        }

        const duration = Date.now() - startTime;
        trace.addToolCall({
          tool: step.tool,
          args: step.args,
          result,
          duration
        });

        results.toolOutputs.push(result);

      } catch (error) {
        console.error(`Tool execution error (${step.tool}):`, error);
        results.toolOutputs.push({ error: error.message });
      }
    }

    return results;
  }

  async generateResponse(toolResults, scene, character) {
    const response = {
      narration: '',
      actionLog: [],
      choices: [],
      stateUpdates: {},
      imageRequest: null
    };

    const rollResult = toolResults.toolOutputs.find(r => r.roll !== undefined);
    if (rollResult) {
      response.actionLog.push({
        type: 'check',
        ability: rollResult.ability,
        roll: rollResult.roll,
        total: rollResult.total,
        dc: rollResult.dc,
        result: rollResult.result
      });

      if (rollResult.result === 'success') {
        response.narration = this.generateSuccessNarration(rollResult, scene);
      } else {
        response.narration = this.generateFailureNarration(rollResult, scene);
      }
    } else {
      response.narration = this.generateNarrativeResponse(scene, character);
    }

    response.choices = this.generateChoices(scene, character);

    const imageResult = toolResults.toolOutputs.find(r => r.jobId);
    if (imageResult) {
      response.imageRequest = imageResult;
    }

    return response;
  }

  generateSuccessNarration(rollResult, scene) {
    const narratives = {
      'stealth': "You move silently through the shadows, undetected.",
      'lockpick': "The lock clicks open with a satisfying sound.",
      'climb': "You scale the obstacle with ease.",
      'persuade': "Your words carry weight and conviction.",
      'default': "Your attempt succeeds admirably."
    };

    const context = rollResult.context || 'default';
    return narratives[context] || narratives['default'];
  }

  generateFailureNarration(rollResult, scene) {
    const narratives = {
      'stealth': "A twig snaps under your foot, alerting nearby threats.",
      'lockpick': "The pick breaks in the lock with a metallic snap.",
      'climb': "Your grip slips and you slide back down.",
      'persuade': "Your words fall on deaf ears.",
      'default': "Despite your best efforts, you don't quite succeed."
    };

    const context = rollResult.context || 'default';
    return narratives[context] || narratives['default'];
  }

  generateNarrativeResponse(scene, character) {
    const templates = [
      "You find yourself in {sceneName}. The atmosphere is {mood}.",
      "The {sceneElement} catches your attention as you {action}.",
      "Your journey continues through {sceneName}, where {event}."
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    return template
      .replace('{sceneName}', scene.title || 'an unfamiliar place')
      .replace('{mood}', this.getSceneMood(scene))
      .replace('{sceneElement}', this.getRandomSceneElement(scene))
      .replace('{action}', 'explore the area')
      .replace('{event}', 'new possibilities await');
  }

  generateChoices(scene, character) {
    const baseChoices = [
      "Examine your surroundings carefully",
      "Move forward cautiously",
      "Look for alternative paths"
    ];

    if (scene.npcs && scene.npcs.length > 0) {
      baseChoices.push(`Talk to ${scene.npcs[0].name || 'the stranger'}`);
    }

    if (scene.exits && scene.exits.length > 0) {
      baseChoices.push(`Go ${scene.exits[0].direction || 'north'}`);
    }

    return baseChoices.slice(0, this.options.choiceCount);
  }

  generateImagePrompt(scene, action) {
    const style = "[Style: painterly noir, muted palette]";
    const setting = `[Setting: ${scene.title || 'mysterious location'}]`;
    const subjects = `[Subjects: adventurer, ${scene.tags?.join(', ') || 'fantasy elements'}]`;
    const details = `[Key details: ${scene.canonicalFacts?.slice(0, 2).join(', ') || 'atmospheric lighting'}]`;
    const framing = "[Framing: medium wide, cinematic]";
    const constraint = "[Do not include text]";

    return `${style}\n${subjects}\n${setting}\n${details}\n${framing}\n${constraint}`;
  }

  getSceneMood(scene) {
    const moods = ['tense', 'mysterious', 'peaceful', 'ominous', 'hopeful'];
    return moods[Math.floor(Math.random() * moods.length)];
  }

  getRandomSceneElement(scene) {
    const elements = ['doorway', 'pathway', 'figure', 'structure', 'landscape'];
    return elements[Math.floor(Math.random() * elements.length)];
  }

  generateFallbackResponse(error, scene) {
    return {
      narration: "Something unexpected occurs in your adventure. The path ahead remains unclear, but your determination is unwavering.",
      actionLog: [{ type: 'error', message: 'A mysterious force intervenes' }],
      choices: [
        "Take a moment to assess the situation",
        "Try a different approach",
        "Look around for clues"
      ],
      stateUpdates: {},
      imageRequest: null
    };
  }
}
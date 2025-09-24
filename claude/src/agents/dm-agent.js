import { RulesTool, CombatTool, InventoryTool, WorldTool, SafetyTool } from '../tools/index.js';
import { GeminiService } from '../services/index.js';

export class DMAgent {
  constructor(lorebook, options = {}) {
    this.lorebook = lorebook;
    this.options = {
      maxNarrationWords: options.maxNarrationWords || 120,
      choiceCount: options.choiceCount || 3,
      ageRating: options.ageRating || 'Teen',
      useGemini: options.useGemini !== false, // Default to true
      ...options
    };

    // Initialize Gemini service if available and enabled
    this.gemini = null;
    if (this.options.useGemini) {
      try {
        this.gemini = new GeminiService();
      } catch (error) {
        console.warn('Gemini service not available, falling back to templates:', error.message);
        this.options.useGemini = false;
      }
    }
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
      action.target = { id: 'unknown_enemy', name: 'enemy', ac: 12 };
      action.attack = {
        type: 'melee',
        toHitMod: 3,
        damage: '1d6+3',
        damageType: 'physical'
      };
      action.targetAC = 12;
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

  async generateResponse(toolResults, scene, character, playerAction = '') {
    const response = {
      narration: '',
      actionLog: [],
      choices: [],
      stateUpdates: {},
      imageRequest: null
    };

    // Process tool results for action log
    toolResults.toolOutputs.forEach(result => {
      if (result.roll !== undefined) {
        response.actionLog.push({
          type: 'check',
          ability: result.ability,
          roll: result.roll,
          total: result.total,
          dc: result.dc,
          result: result.result
        });
      }
      if (result.hit !== undefined) {
        response.actionLog.push({
          type: 'combat',
          hit: result.hit,
          damage: result.damage,
          target: result.target
        });
      }
    });

    // Generate narration using Gemini or fallback to templates
    if (this.options.useGemini && this.gemini) {
      try {
        const geminiResult = await this.gemini.generateNarration({
          scene,
          character,
          playerAction,
          toolResults,
          context: { ageRating: this.options.ageRating }
        });

        if (geminiResult.success) {
          response.narration = geminiResult.narration;
        } else {
          console.warn('Gemini narration failed, using fallback:', geminiResult.error);
          response.narration = this.generateFallbackNarration(toolResults, scene, character);
        }
      } catch (error) {
        console.error('Gemini narration error:', error);
        response.narration = this.generateFallbackNarration(toolResults, scene, character);
      }
    } else {
      response.narration = this.generateFallbackNarration(toolResults, scene, character);
    }

    // Generate choices using Gemini or fallback to templates
    if (this.options.useGemini && this.gemini) {
      try {
        const choicesResult = await this.gemini.generateChoices({
          scene,
          character,
          currentSituation: response.narration,
          numChoices: this.options.choiceCount
        });

        if (choicesResult.success) {
          response.choices = choicesResult.choices;
        } else {
          console.warn('Gemini choices failed, using fallback:', choicesResult.error);
          response.choices = this.generateFallbackChoices(scene, character);
        }
      } catch (error) {
        console.error('Gemini choices error:', error);
        response.choices = this.generateFallbackChoices(scene, character);
      }
    } else {
      response.choices = this.generateFallbackChoices(scene, character);
    }

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

  generateFallbackNarration(toolResults, scene, character) {
    const rollResult = toolResults.toolOutputs.find(r => r.roll !== undefined);
    const combatResult = toolResults.toolOutputs.find(r => r.hit !== undefined);

    if (rollResult) {
      if (rollResult.result === 'success') {
        return this.generateSuccessNarration(rollResult, scene);
      } else {
        return this.generateFailureNarration(rollResult, scene);
      }
    } else if (combatResult) {
      if (combatResult.hit) {
        return `Your attack strikes true, dealing ${combatResult.damage?.total || 0} damage to your foe.`;
      } else {
        return "Your attack misses its mark, but you quickly recover your stance.";
      }
    } else {
      return this.generateNarrativeResponse(scene, character);
    }
  }

  generateFallbackChoices(scene, character) {
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
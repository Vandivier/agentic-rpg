import { WorldTool, SafetyTool } from '../tools/index.js';
import { GeminiService } from '../services/index.js';

export class NPCAgent {
  constructor(npcData, lorebook, options = {}) {
    this.npc = npcData;
    this.lorebook = lorebook;
    this.conversationHistory = [];
    this.options = {
      useGemini: options.useGemini !== false, // Default to true
      ageRating: options.ageRating || 'Teen',
      ...options
    };

    // Initialize Gemini service if available and enabled
    this.gemini = null;
    if (this.options.useGemini) {
      try {
        this.gemini = new GeminiService();
      } catch (error) {
        console.warn('Gemini service not available for NPC, falling back to templates:', error.message);
        this.options.useGemini = false;
      }
    }
  }

  async generateDialogue(playerInput, context = {}) {
    try {
      const response = await this.processDialogue(playerInput, context);

      const safetyCheck = SafetyTool.check(response.dialogue, context.ageRating || 'Teen');
      if (!safetyCheck.ok) {
        const sanitized = SafetyTool.sanitize(response.dialogue, context.ageRating);
        response.dialogue = sanitized.sanitized;
      }

      this.conversationHistory.push({
        player: playerInput,
        npc: response.dialogue,
        timestamp: new Date().toISOString()
      });

      return response;

    } catch (error) {
      console.error('NPC Agent error:', error);
      return this.generateFallbackDialogue();
    }
  }

  async processDialogue(playerInput, context) {
    const mood = this.determineMood(context);
    const knowledge = this.getRelevantKnowledge(playerInput);

    const response = {
      dialogue: '',
      mood: mood,
      actions: [],
      stateChanges: {}
    };

    // Use Gemini for dialogue generation if available
    if (this.options.useGemini && this.gemini) {
      try {
        const geminiResult = await this.gemini.generateNPCDialogue({
          npc: this.npc,
          playerInput,
          conversationHistory: this.conversationHistory,
          context: { ...context, ageRating: this.options.ageRating }
        });

        if (geminiResult.success) {
          response.dialogue = geminiResult.dialogue;
        } else {
          console.warn('Gemini NPC dialogue failed, using fallback:', geminiResult.error);
          response.dialogue = this.generateFallbackDialogueText(playerInput, context, knowledge);
        }
      } catch (error) {
        console.error('Gemini NPC dialogue error:', error);
        response.dialogue = this.generateFallbackDialogueText(playerInput, context, knowledge);
      }
    } else {
      response.dialogue = this.generateFallbackDialogueText(playerInput, context, knowledge);
    }

    // Add actions based on disposition
    if (this.isHostile(context)) {
      response.actions.push('threatens');
    } else if (this.isHelpful(context)) {
      response.actions.push('assists');
    } else if (this.isMysterious(context)) {
      response.actions.push('hints');
    }

    // Handle special dialogue additions
    if (this.shouldRevealSecret(playerInput, context)) {
      response.dialogue += ` ${this.revealSecret()}`;
      response.stateChanges[`${this.npc.id}_secret_revealed`] = true;
    }

    if (this.shouldOfferQuest(playerInput, context)) {
      response.dialogue += ` ${this.offerQuest()}`;
      response.stateChanges[`${this.npc.id}_quest_offered`] = true;
    }

    return response;
  }

  generateFallbackDialogueText(playerInput, context, knowledge) {
    if (this.isHostile(context)) {
      return this.generateHostileDialogue(playerInput);
    } else if (this.isHelpful(context)) {
      return this.generateHelpfulDialogue(playerInput, knowledge);
    } else if (this.isMysterious(context)) {
      return this.generateMysteriousDialogue(playerInput);
    } else {
      return this.generateNeutralDialogue(playerInput);
    }
  }

  determineMood(context) {
    if (context.combat) return 'aggressive';
    if (context.playerReputation < 0) return 'suspicious';
    if (context.playerReputation > 50) return 'friendly';

    const sceneMood = context.scene?.flags?.mood;
    if (sceneMood) return sceneMood;

    return this.npc.defaultMood || 'neutral';
  }

  getRelevantKnowledge(playerInput) {
    const knowledge = [];
    const input = playerInput.toLowerCase();

    if (this.npc.knowledge) {
      this.npc.knowledge.forEach(fact => {
        const keywords = fact.keywords || [];
        if (keywords.some(keyword => input.includes(keyword.toLowerCase()))) {
          knowledge.push(fact);
        }
      });
    }

    if (this.lorebook && this.lorebook.entities) {
      Object.values(this.lorebook.entities).forEach(entity => {
        if (entity.keywords && entity.keywords.some(keyword =>
          input.includes(keyword.toLowerCase()))) {
          knowledge.push(entity);
        }
      });
    }

    return knowledge;
  }

  isHostile(context) {
    return this.npc.disposition === 'hostile' ||
           context.combat ||
           (context.playerReputation < -20);
  }

  isHelpful(context) {
    return this.npc.disposition === 'helpful' ||
           this.npc.role === 'merchant' ||
           this.npc.role === 'guide' ||
           (context.playerReputation > 30);
  }

  isMysterious(context) {
    return this.npc.disposition === 'mysterious' ||
           this.npc.role === 'oracle' ||
           this.npc.hasSecrets;
  }

  generateHostileDialogue(playerInput) {
    const hostileResponses = [
      `"You dare approach me? ${this.npc.name} does not suffer fools."`,
      `"Turn back now, or face the consequences!"`,
      `"I have no words for the likes of you."`,
      `"Your presence here is unwelcome."`
    ];

    if (playerInput.toLowerCase().includes('peace') ||
        playerInput.toLowerCase().includes('sorry')) {
      return `"Words are cheap. Actions speak louder."`;
    }

    return hostileResponses[Math.floor(Math.random() * hostileResponses.length)];
  }

  generateHelpfulDialogue(playerInput, knowledge) {
    const helpfulIntros = [
      `"Greetings, traveler. I am ${this.npc.name}."`,
      `"Well met! How can I assist you?"`,
      `"Welcome! What brings you to these parts?"`
    ];

    let response = helpfulIntros[Math.floor(Math.random() * helpfulIntros.length)];

    if (knowledge.length > 0) {
      const fact = knowledge[0];
      response += ` "Ah, you ask about ${fact.topic || 'that'}. ${fact.information || 'I know a thing or two about it.'}"`;
    }

    if (this.npc.role === 'merchant') {
      response += ` "Perhaps you'd be interested in my wares?"`;
    }

    return response;
  }

  generateMysteriousDialogue(playerInput) {
    const mysteriousResponses = [
      `"The paths of fate are not for mortals to fully understand."`,
      `"Some knowledge comes with a price. Are you prepared to pay it?"`,
      `"I see much, but speak little. Choose your questions wisely."`,
      `"The answer you seek may not be the answer you need."`
    ];

    return mysteriousResponses[Math.floor(Math.random() * mysteriousResponses.length)];
  }

  generateNeutralDialogue(playerInput) {
    const neutralResponses = [
      `"${this.npc.name} acknowledges your presence."`,
      `"I am ${this.npc.name}. What do you need?"`,
      `"Speak your business."`,
      `"I have little time for idle chatter."`
    ];

    return neutralResponses[Math.floor(Math.random() * neutralResponses.length)];
  }

  shouldRevealSecret(playerInput, context) {
    if (!this.npc.secrets || this.npc.secrets.length === 0) return false;

    const trust = context.npcTrust || 0;
    const secretRevealed = context.scene?.flags?.[`${this.npc.id}_secret_revealed`];

    if (secretRevealed) return false;

    const triggerWords = ['secret', 'truth', 'tell me', 'trust'];
    const hasTrigger = triggerWords.some(word =>
      playerInput.toLowerCase().includes(word));

    return hasTrigger && trust > 50;
  }

  shouldOfferQuest(playerInput, context) {
    if (!this.npc.quests || this.npc.quests.length === 0) return false;

    const questOffered = context.scene?.flags?.[`${this.npc.id}_quest_offered`];
    if (questOffered) return false;

    const helpWords = ['help', 'task', 'quest', 'job', 'work'];
    const hasHelpRequest = helpWords.some(word =>
      playerInput.toLowerCase().includes(word));

    return hasHelpRequest && this.isHelpful(context);
  }

  revealSecret() {
    if (!this.npc.secrets || this.npc.secrets.length === 0) {
      return "I have no secrets to share.";
    }

    const secret = this.npc.secrets[0];
    return `"I will tell you something few know: ${secret.information}"`;
  }

  offerQuest() {
    if (!this.npc.quests || this.npc.quests.length === 0) {
      return "I have no tasks that need doing.";
    }

    const quest = this.npc.quests[0];
    return `"Actually, I do have something you could help with: ${quest.description}"`;
  }

  generateFallbackDialogue() {
    return {
      dialogue: `"${this.npc.name} seems distracted and doesn't respond clearly."`,
      mood: 'confused',
      actions: ['looks away'],
      stateChanges: {}
    };
  }

  updateDisposition(change) {
    if (!this.npc.dispositionPoints) {
      this.npc.dispositionPoints = 0;
    }

    this.npc.dispositionPoints += change;

    if (this.npc.dispositionPoints > 50) {
      this.npc.disposition = 'helpful';
    } else if (this.npc.dispositionPoints < -30) {
      this.npc.disposition = 'hostile';
    } else {
      this.npc.disposition = 'neutral';
    }

    return this.npc.disposition;
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  resetConversation() {
    this.conversationHistory = [];
  }
}
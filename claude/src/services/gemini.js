import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    // Gemini 2.5 Flash for text generation
    this.flashModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    });

    // Gemini 2.5 Flash Image (nano-banana) for image analysis
    this.imageModel = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
      generationConfig: {
        temperature: 0.5,
        topP: 0.8,
        maxOutputTokens: 512,
      }
    });

    this.requestCount = 0;
    this.lastRequestTime = Date.now();
  }

  async generateNarration({ scene, character, playerAction, toolResults, context = {} }) {
    try {
      const prompt = this.buildNarrationPrompt({ scene, character, playerAction, toolResults, context });

      const result = await this.flashModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      this.requestCount++;

      return {
        success: true,
        narration: text.trim(),
        tokens: response.usageMetadata?.totalTokenCount || 0,
        model: "gemini-2.5-flash"
      };

    } catch (error) {
      console.error('Gemini narration generation error:', error);

      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  async generateNPCDialogue({ npc, playerInput, conversationHistory, context = {} }) {
    try {
      const prompt = this.buildDialoguePrompt({ npc, playerInput, conversationHistory, context });

      const result = await this.flashModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      this.requestCount++;

      return {
        success: true,
        dialogue: text.trim(),
        tokens: response.usageMetadata?.totalTokenCount || 0,
        model: "gemini-2.5-flash"
      };

    } catch (error) {
      console.error('Gemini dialogue generation error:', error);

      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  async analyzeSceneImage(imageUrl, sceneContext = {}) {
    try {
      // Convert image URL to base64 for Gemini
      const imageData = await this.fetchImageAsBase64(imageUrl);

      const prompt = this.buildImageAnalysisPrompt(sceneContext);

      const imageParts = [
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg"
          }
        }
      ];

      const result = await this.imageModel.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text();

      this.requestCount++;

      return {
        success: true,
        analysis: text.trim(),
        tokens: response.usageMetadata?.totalTokenCount || 0,
        model: "gemini-2.5-flash-image"
      };

    } catch (error) {
      console.error('Gemini image analysis error:', error);

      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  async generateChoices({ scene, character, currentSituation, numChoices = 4 }) {
    try {
      const prompt = this.buildChoicesPrompt({ scene, character, currentSituation, numChoices });

      const result = await this.flashModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the response to extract choices
      const choices = this.parseChoicesFromResponse(text, numChoices);

      this.requestCount++;

      return {
        success: true,
        choices,
        tokens: response.usageMetadata?.totalTokenCount || 0,
        model: "gemini-2.5-flash"
      };

    } catch (error) {
      console.error('Gemini choices generation error:', error);

      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  buildNarrationPrompt({ scene, character, playerAction, toolResults, context }) {
    const parts = [];

    parts.push("You are the Dungeon Master for an epic fantasy RPG. Generate a vivid, engaging narration based on the player's action and its results.");
    parts.push("\n## Guidelines:");
    parts.push("- Write in second person (\"you\")")
    parts.push("- Keep narration under 120 words");
    parts.push("- Be descriptive but concise");
    parts.push("- Match the scene's mood and atmosphere");
    parts.push("- Include sensory details (sight, sound, smell)");
    parts.push("- Show consequences of the action taken");

    if (scene) {
      parts.push(`\n## Current Scene: ${scene.title}`);
      parts.push(scene.synopsis || scene.description || "");

      if (scene.canonicalFacts && scene.canonicalFacts.length > 0) {
        parts.push("\n## Established Facts:");
        scene.canonicalFacts.forEach(fact => parts.push(`- ${fact}`));
      }

      if (scene.mood) {
        parts.push(`\n## Scene Mood: ${scene.mood}`);
      }
    }

    if (character) {
      parts.push(`\n## Character: ${character.name}`);
      parts.push(`HP: ${character.hp.current}/${character.hp.max}`);
      if (character.background) {
        parts.push(`Background: ${character.background}`);
      }
    }

    parts.push(`\n## Player Action: "${playerAction}"`);

    if (toolResults && toolResults.toolOutputs) {
      parts.push("\n## Action Results:");
      toolResults.toolOutputs.forEach(result => {
        if (result.result) {
          parts.push(`- ${result.result === 'success' ? 'SUCCESS' : 'FAILURE'}`);
          if (result.roll) parts.push(`  Roll: ${result.roll} + ${result.total - result.roll} = ${result.total} vs DC ${result.dc}`);
        }
        if (result.hit !== undefined) {
          parts.push(`- Attack ${result.hit ? 'HIT' : 'MISSED'}`);
          if (result.damage) parts.push(`  Damage: ${result.damage.total}`);
        }
        if (result.error) {
          parts.push(`- Complication: ${result.error}`);
        }
      });
    }

    if (context.ageRating) {
      parts.push(`\n## Content Rating: ${context.ageRating} (keep content appropriate)`);
    }

    parts.push("\n## Your Response:");
    parts.push("Generate only the narration text. Do not include choices or questions.");

    return parts.join('\n');
  }

  buildDialoguePrompt({ npc, playerInput, conversationHistory, context }) {
    const parts = [];

    parts.push(`You are ${npc.name}, ${npc.description || 'an NPC in a fantasy RPG'}.`);

    if (npc.personality && npc.personality.length > 0) {
      parts.push("\n## Your Personality:");
      npc.personality.forEach(trait => parts.push(`- ${trait}`));
    }

    if (npc.role) {
      parts.push(`\n## Your Role: ${npc.role}`);
    }

    if (npc.disposition) {
      parts.push(`\n## Your Disposition: ${npc.disposition}`);
    }

    if (npc.knowledge && npc.knowledge.length > 0) {
      parts.push("\n## Your Knowledge:");
      npc.knowledge.forEach(knowledge => {
        parts.push(`- ${knowledge.topic}: ${knowledge.information}`);
      });
    }

    if (conversationHistory && conversationHistory.length > 0) {
      parts.push("\n## Recent Conversation:");
      conversationHistory.slice(-3).forEach(exchange => {
        parts.push(`Player: "${exchange.player}"`);
        parts.push(`You: "${exchange.npc}"`);
      });
    }

    parts.push(`\n## Player says: "${playerInput}"`);

    parts.push("\n## Guidelines:");
    parts.push("- Stay in character at all times");
    parts.push("- Respond naturally to the player's input");
    parts.push("- Keep responses under 100 words");
    parts.push("- Use appropriate speech patterns for your character");
    parts.push("- Share relevant knowledge when appropriate");
    parts.push("- Express your personality through dialogue");

    if (context.ageRating) {
      parts.push(`- Keep content appropriate for ${context.ageRating} audiences`);
    }

    parts.push("\n## Your Response:");
    parts.push("Generate only your spoken dialogue. Do not include actions or narration.");

    return parts.join('\n');
  }

  buildImageAnalysisPrompt(sceneContext) {
    const parts = [];

    parts.push("Analyze this fantasy RPG scene image and provide a detailed description.");
    parts.push("\n## Focus on:");
    parts.push("- Overall atmosphere and mood");
    parts.push("- Key visual elements and composition");
    parts.push("- Environmental details");
    parts.push("- Colors and lighting");
    parts.push("- Any characters or creatures visible");
    parts.push("- Architectural or natural features");

    if (sceneContext.expectedElements) {
      parts.push("\n## Expected Elements:");
      sceneContext.expectedElements.forEach(element => parts.push(`- ${element}`));
    }

    parts.push("\n## Response Format:");
    parts.push("Provide a vivid, atmospheric description in 2-3 sentences that captures the essence of the scene.");

    return parts.join('\n');
  }

  buildChoicesPrompt({ scene, character, currentSituation, numChoices }) {
    const parts = [];

    parts.push("Generate action choices for a player in this RPG scenario.");

    if (scene) {
      parts.push(`\n## Scene: ${scene.title}`);
      parts.push(scene.synopsis || "");
    }

    if (character) {
      parts.push(`\n## Character: ${character.name}`);
      parts.push(`HP: ${character.hp.current}/${character.hp.max}`);
    }

    parts.push(`\n## Current Situation: ${currentSituation}`);

    parts.push("\n## Guidelines:");
    parts.push(`- Generate exactly ${numChoices} distinct choices`);
    parts.push("- Each choice should be actionable and specific");
    parts.push("- Vary the approaches (combat, stealth, social, exploration)");
    parts.push("- Keep each choice under 60 characters");
    parts.push("- Make choices relevant to the current situation");
    parts.push("- Include at least one creative/unexpected option");

    parts.push("\n## Format:");
    parts.push("Return only the choices, one per line, without numbers or bullets:");
    parts.push("Example:");
    parts.push("Sneak past the guards");
    parts.push("Challenge them to combat");
    parts.push("Try to negotiate");
    parts.push("Look for another way around");

    return parts.join('\n');
  }

  parseChoicesFromResponse(text, numChoices) {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.toLowerCase().includes('example'))
      .slice(0, numChoices);

    // Remove any numbering or bullets
    const choices = lines.map(line => {
      return line.replace(/^[\d\-\*\+\.\)]+\s*/, '').trim();
    });

    // Ensure we have at least the requested number of choices
    while (choices.length < numChoices) {
      const fallbackChoices = [
        "Examine your surroundings carefully",
        "Move forward cautiously",
        "Look for alternative approaches",
        "Take a moment to consider your options"
      ];

      const fallback = fallbackChoices[choices.length % fallbackChoices.length];
      if (!choices.includes(fallback)) {
        choices.push(fallback);
      }
    }

    return choices.slice(0, numChoices);
  }

  async fetchImageAsBase64(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return base64;
    } catch (error) {
      throw new Error(`Image fetch failed: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const result = await this.flashModel.generateContent("Hello! This is a connection test. Please respond with 'Connection successful!'");
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        message: text.trim(),
        model: "gemini-2.5-flash"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getUsageStats() {
    return {
      totalRequests: this.requestCount,
      sessionStartTime: this.lastRequestTime,
      modelsAvailable: ["gemini-2.5-flash", "gemini-2.5-flash-image"]
    };
  }

  // Rate limiting helper
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 100; // 100ms between requests

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
  }
}
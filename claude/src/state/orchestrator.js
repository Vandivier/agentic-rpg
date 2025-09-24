import { GameStateMachine, GameStates } from './game-state.js';
import { DMAgent, NPCAgent, CriticAgent } from '../agents/index.js';
import { Session, Scene, Character, Trace } from '../models/index.js';
import { WorldTool } from '../tools/index.js';

export class GameOrchestrator {
  constructor(io) {
    this.io = io;
    this.stateMachine = new GameStateMachine();
    this.sessions = new Map();
    this.lorebook = null;

    this.setupStateHandlers();
    this.loadLorebook();
  }

  setupStateHandlers() {
    this.stateMachine.registerStateHandler(GameStates.PLAN, this.handlePlan.bind(this));
    this.stateMachine.registerStateHandler(GameStates.TOOL_EXEC, this.handleToolExecution.bind(this));
    this.stateMachine.registerStateHandler(GameStates.REDUCE, this.handleReduce.bind(this));
    this.stateMachine.registerStateHandler(GameStates.SAFETY, this.handleSafety.bind(this));
    this.stateMachine.registerStateHandler(GameStates.RENDER, this.handleRender.bind(this));
    this.stateMachine.registerStateHandler(GameStates.RECOVER, this.handleRecover.bind(this));

    this.stateMachine.registerErrorHandler(GameStates.PLAN, this.handleError.bind(this));
    this.stateMachine.registerErrorHandler(GameStates.TOOL_EXEC, this.handleError.bind(this));
    this.stateMachine.registerErrorHandler(GameStates.REDUCE, this.handleError.bind(this));
    this.stateMachine.registerErrorHandler(GameStates.SAFETY, this.handleError.bind(this));
    this.stateMachine.registerErrorHandler(GameStates.RENDER, this.handleError.bind(this));
  }

  async handlePlayerAction(socket, data) {
    try {
      const { sessionId, playerInput, sceneId } = data;

      let session = this.sessions.get(sessionId);
      if (!session) {
        session = await this.createNewSession(sessionId, data.playerId);
        this.sessions.set(sessionId, session);
      }

      const scene = WorldTool.getScene(sceneId) || await this.getDefaultScene();
      const character = session.character;

      const trace = new Trace({
        turn: session.turnCount + 1,
        sessionId: sessionId,
        sceneId: scene.id,
        playerInput: playerInput
      });

      const context = {
        session,
        scene,
        character,
        trace,
        socket,
        playerInput
      };

      this.stateMachine.transition(GameStates.PLAN);

      const result = await this.processPlayerTurn(context);

      session.turnCount++;
      session.lastActivity = new Date().toISOString();

      socket.emit('turn-complete', result);

    } catch (error) {
      console.error('Error handling player action:', error);
      socket.emit('error', {
        message: 'An error occurred processing your action',
        canRetry: true
      });
    }
  }

  async processPlayerTurn(context) {
    let result = null;

    while (this.stateMachine.getCurrentState() !== GameStates.AWAIT_INPUT &&
           this.stateMachine.getCurrentState() !== GameStates.IDLE) {

      result = await this.stateMachine.executeState(context);

      if (result && result.nextState) {
        this.stateMachine.transition(result.nextState, result);
      }
    }

    if (this.stateMachine.getCurrentState() !== GameStates.AWAIT_INPUT) {
      this.stateMachine.transition(GameStates.AWAIT_INPUT);
    }
    return result;
  }

  async handlePlan(context) {
    const dmAgent = new DMAgent(this.lorebook, {
      ageRating: context.session.settings.ageRating
    });

    const plan = await dmAgent.createPlan(
      context.playerInput,
      context.scene,
      context.character
    );

    context.plan = plan;
    context.trace.addOutput({ type: 'plan', content: plan });

    return {
      nextState: GameStates.TOOL_EXEC,
      plan
    };
  }

  async handleToolExecution(context) {
    const dmAgent = new DMAgent(this.lorebook);

    const toolResults = await dmAgent.executePlan(
      context.plan,
      context.character,
      context.scene,
      context.trace
    );

    context.toolResults = toolResults;

    return {
      nextState: GameStates.REDUCE,
      toolResults
    };
  }

  async handleReduce(context) {
    const dmAgent = new DMAgent(this.lorebook, {
      ageRating: context.session.settings.ageRating
    });

    const response = await dmAgent.generateResponse(
      context.toolResults,
      context.scene,
      context.character
    );

    context.response = response;

    return {
      nextState: GameStates.SAFETY,
      response
    };
  }

  async handleSafety(context) {
    const criticAgent = new CriticAgent({
      ageRating: context.session.settings.ageRating
    });

    const validation = await criticAgent.validateDMOutput(
      context.response,
      {
        scene: context.scene,
        character: context.character,
        lorebook: this.lorebook
      }
    );

    context.trace.addOutput({ type: 'validation', content: validation });

    if (validation.requiresRevision) {
      console.log('Output requires revision:', validation.errors);
      return {
        nextState: GameStates.PLAN,
        revisionRequired: true,
        validationErrors: validation.errors
      };
    }

    return {
      nextState: GameStates.RENDER,
      validation
    };
  }

  async handleRender(context) {
    const finalResponse = {
      narration: context.response.narration,
      actionLog: context.response.actionLog,
      choices: context.response.choices,
      stateUpdates: context.response.stateUpdates,
      imageRequest: context.response.imageRequest,
      sessionId: context.session.id,
      sceneId: context.scene.id,
      turnCount: context.session.turnCount + 1
    };

    if (context.response.stateUpdates && context.response.stateUpdates.flags) {
      WorldTool.updateScene(context.scene.id, {
        flags: context.response.stateUpdates.flags
      });
    }

    context.socket.emit('narration-stream', {
      content: finalResponse.narration,
      complete: true
    });

    if (finalResponse.imageRequest) {
      this.handleImageGeneration(finalResponse.imageRequest, context.socket);
    }

    return {
      nextState: GameStates.AWAIT_INPUT,
      finalResponse
    };
  }

  async handleRecover(context) {
    console.log('Entering recovery state');

    const fallbackResponse = {
      narration: "The mists of adventure swirl around you, obscuring the path momentarily. As they clear, new possibilities emerge.",
      actionLog: [{ type: 'system', message: 'Recovering from unexpected situation' }],
      choices: [
        "Take a moment to assess your surroundings",
        "Continue forward cautiously",
        "Look for a different approach"
      ],
      stateUpdates: {},
      imageRequest: null
    };

    context.socket.emit('narration-stream', {
      content: fallbackResponse.narration,
      complete: true
    });

    return {
      nextState: GameStates.AWAIT_INPUT,
      finalResponse: fallbackResponse
    };
  }

  async handleError(error, context) {
    console.error(`Error in state ${this.stateMachine.getCurrentState()}:`, error);

    context.trace.addOutput({
      type: 'error',
      content: {
        error: error.message,
        state: this.stateMachine.getCurrentState(),
        timestamp: new Date().toISOString()
      }
    });

    return {
      nextState: GameStates.RECOVER,
      error: error.message
    };
  }

  async handleImageGeneration(imageRequest, socket) {
    try {
      socket.emit('image-generating', {
        jobId: imageRequest.jobId,
        status: 'generating',
        eta: 3
      });

      setTimeout(() => {
        socket.emit('image-ready', {
          jobId: imageRequest.jobId,
          url: `/api/images/placeholder-${Date.now()}.jpg`,
          mode: 'preview'
        });
      }, 2000 + Math.random() * 2000);

    } catch (error) {
      console.error('Image generation error:', error);
      socket.emit('image-error', {
        jobId: imageRequest.jobId,
        error: 'Image generation failed'
      });
    }
  }

  async createNewSession(sessionId, playerId) {
    const character = new Character({
      name: 'Adventurer',
      abilities: { STR: 12, DEX: 14, CON: 13, INT: 11, WIS: 15, CHA: 10 },
      proficiencies: ['Stealth', 'Perception', 'Investigation'],
      hp: { current: 25, max: 25 },
      resources: { gold: 50 }
    });

    const session = new Session({
      id: sessionId,
      playerId: playerId,
      character: character
    });

    const startingScene = await this.getDefaultScene();
    session.currentSceneId = startingScene.id;

    return session;
  }

  async getDefaultScene() {
    const scene = new Scene({
      id: 'tavern_start',
      title: 'The Crossed Swords Tavern',
      synopsis: 'A warm, inviting tavern where adventures begin',
      canonicalFacts: [
        'The fireplace crackles warmly in the corner',
        'The barkeep is a stout dwarf named Thorin',
        'Adventurers often gather here seeking companions'
      ],
      tags: ['tavern', 'starting_location', 'social'],
      npcs: [{
        id: 'thorin_barkeep',
        name: 'Thorin',
        role: 'barkeep',
        disposition: 'helpful'
      }]
    });

    WorldTool.addScene(scene);
    return scene;
  }

  loadLorebook() {
    this.lorebook = {
      entities: {
        'crossed_swords_tavern': {
          tags: ['tavern', 'safe_haven'],
          canonicalFacts: [
            'The Crossed Swords has stood for over 200 years',
            'It\'s known as a meeting place for adventurers',
            'The beer is exceptionally good'
          ],
          keywords: ['tavern', 'crossed swords', 'inn']
        },
        'thorin_barkeep': {
          tags: ['npc', 'dwarf', 'helpful'],
          canonicalFacts: [
            'Thorin has run the tavern for 30 years',
            'He knows most of the local adventurers',
            'He gives good advice to newcomers'
          ],
          keywords: ['thorin', 'barkeep', 'dwarf']
        }
      }
    };
  }

  getSessionStats() {
    const stats = {
      activeSessions: this.sessions.size,
      totalTurns: 0,
      stateMachineMetrics: this.stateMachine.getMetrics()
    };

    this.sessions.forEach(session => {
      stats.totalTurns += session.turnCount;
    });

    return stats;
  }

  async shutdownSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`Shutting down session ${sessionId}`);
      this.sessions.delete(sessionId);
    }
  }
}
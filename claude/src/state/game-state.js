export const GameStates = {
  IDLE: 'idle',
  PLAN: 'plan',
  TOOL_EXEC: 'tool_exec',
  REDUCE: 'reduce',
  SAFETY: 'safety',
  RENDER: 'render',
  AWAIT_INPUT: 'await_input',
  RECOVER: 'recover'
};

export class GameStateMachine {
  constructor() {
    this.currentState = GameStates.IDLE;
    this.stateHistory = [];
    this.transitions = new Map();
    this.stateHandlers = new Map();
    this.errorHandlers = new Map();

    this.setupTransitions();
  }

  setupTransitions() {
    this.transitions.set(GameStates.IDLE, [
      GameStates.PLAN,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.PLAN, [
      GameStates.TOOL_EXEC,
      GameStates.REDUCE,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.TOOL_EXEC, [
      GameStates.REDUCE,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.REDUCE, [
      GameStates.SAFETY,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.SAFETY, [
      GameStates.RENDER,
      GameStates.PLAN,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.RENDER, [
      GameStates.AWAIT_INPUT,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.AWAIT_INPUT, [
      GameStates.PLAN,
      GameStates.IDLE,
      GameStates.RECOVER
    ]);

    this.transitions.set(GameStates.RECOVER, [
      GameStates.AWAIT_INPUT,
      GameStates.IDLE
    ]);
  }

  canTransition(fromState, toState) {
    const allowedTransitions = this.transitions.get(fromState);
    return allowedTransitions && allowedTransitions.includes(toState);
  }

  transition(newState, context = {}) {
    if (!this.canTransition(this.currentState, newState)) {
      throw new Error(`Invalid transition from ${this.currentState} to ${newState}`);
    }

    this.stateHistory.push({
      from: this.currentState,
      to: newState,
      timestamp: new Date().toISOString(),
      context
    });

    console.log(`State transition: ${this.currentState} -> ${newState}`);
    this.currentState = newState;

    return this.currentState;
  }

  getCurrentState() {
    return this.currentState;
  }

  getStateHistory() {
    return this.stateHistory;
  }

  registerStateHandler(state, handler) {
    this.stateHandlers.set(state, handler);
  }

  registerErrorHandler(state, handler) {
    this.errorHandlers.set(state, handler);
  }

  async executeState(context) {
    const handler = this.stateHandlers.get(this.currentState);

    if (!handler) {
      throw new Error(`No handler registered for state: ${this.currentState}`);
    }

    try {
      const result = await handler(context);
      return result;
    } catch (error) {
      console.error(`Error in state ${this.currentState}:`, error);

      const errorHandler = this.errorHandlers.get(this.currentState);
      if (errorHandler) {
        return await errorHandler(error, context);
      }

      this.transition(GameStates.RECOVER, { error: error.message });
      throw error;
    }
  }

  reset() {
    this.currentState = GameStates.IDLE;
    this.stateHistory = [];
  }

  getStateDuration() {
    if (this.stateHistory.length === 0) return 0;

    const lastTransition = this.stateHistory[this.stateHistory.length - 1];
    const now = new Date();
    const transitionTime = new Date(lastTransition.timestamp);

    return now - transitionTime;
  }

  isInErrorState() {
    return this.currentState === GameStates.RECOVER;
  }

  getMetrics() {
    const stateCount = {};
    const totalTransitions = this.stateHistory.length;

    this.stateHistory.forEach(transition => {
      stateCount[transition.to] = (stateCount[transition.to] || 0) + 1;
    });

    return {
      currentState: this.currentState,
      totalTransitions,
      stateDistribution: stateCount,
      averageStayTime: totalTransitions > 0 ? this.getTotalTime() / totalTransitions : 0
    };
  }

  getTotalTime() {
    if (this.stateHistory.length < 2) return 0;

    const start = new Date(this.stateHistory[0].timestamp);
    const end = new Date(this.stateHistory[this.stateHistory.length - 1].timestamp);

    return end - start;
  }
}
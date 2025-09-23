export class Trace {
  constructor(data = {}) {
    this.turn = data.turn || 0;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.promptHash = data.promptHash || '';
    this.toolCalls = data.toolCalls || [];
    this.rngSeeds = data.rngSeeds || [];
    this.outputs = data.outputs || [];
    this.playerInput = data.playerInput || '';
    this.sessionId = data.sessionId || '';
    this.sceneId = data.sceneId || '';
  }

  addToolCall(toolCall) {
    this.toolCalls.push({
      tool: toolCall.tool,
      args: toolCall.args,
      result: toolCall.result,
      timestamp: new Date().toISOString(),
      duration: toolCall.duration || 0
    });
  }

  addOutput(output) {
    this.outputs.push({
      type: output.type,
      content: output.content,
      timestamp: new Date().toISOString()
    });
  }

  addSeed(operation, seed) {
    this.rngSeeds.push({
      operation,
      seed,
      timestamp: new Date().toISOString()
    });
  }

  toJSON() {
    return {
      turn: this.turn,
      timestamp: this.timestamp,
      promptHash: this.promptHash,
      toolCalls: this.toolCalls,
      rngSeeds: this.rngSeeds,
      outputs: this.outputs,
      playerInput: this.playerInput,
      sessionId: this.sessionId,
      sceneId: this.sceneId
    };
  }

  static fromJSON(data) {
    return new Trace(data);
  }
}
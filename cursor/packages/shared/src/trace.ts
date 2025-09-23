export interface ToolCall {
  tool: string;
  args: any;
}

export interface Trace {
  turn: number;
  promptHash: string;
  toolCalls: ToolCall[];
  rngSeeds: (string | number)[];
  outputs: any[];
}

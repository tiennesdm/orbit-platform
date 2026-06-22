/**
 * MCP Tool Registry — Anthropic's Model Context Protocol style.
 * 8 tools, each is a typed function the AI agent can call.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  handler: (input: any, ctx: McpToolContext) => Promise<any>;
}

export interface McpToolContext {
  userId: string;
  did: string;
}

export class McpToolRegistry {
  private tools: Map<string, McpTool> = new Map();

  register(tool: McpTool) {
    this.tools.set(tool.name, tool);
  }

  list(): McpTool[] {
    return Array.from(this.tools.values());
  }

  get(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, input: any, ctx: McpToolContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.handler(input, ctx);
  }
}

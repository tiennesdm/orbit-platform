import { Module } from '@nestjs/common';
import { AnthropicAgentService } from './anthropic-agent.service';
import { MemoryService } from './memory.service';
import { PersonalityService } from './personality.service';
import { McpToolRegistry } from './mcp/mcp-tool';
import { registerAllMcpTools } from './mcp/mcp-tools';
import { AiAgentController } from './ai-agent.controller';

@Module({
  controllers: [AiAgentController],
  providers: [
    AnthropicAgentService,
    MemoryService,
    PersonalityService,
    {
      provide: McpToolRegistry,
      useFactory: () => {
        const r = new McpToolRegistry();
        registerAllMcpTools(r);
        return r;
      },
    },
  ],
  exports: [AnthropicAgentService, MemoryService, PersonalityService, McpToolRegistry],
})
export class AiAgentModule {}

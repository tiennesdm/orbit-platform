import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiAgentToolsService } from './ai-agent-tools.service';

@Module({
  imports: [HttpModule],
  controllers: [AiAgentController],
  providers: [AiAgentService, AiAgentToolsService],
  exports: [AiAgentService],
})
export class AiAgentModule {}

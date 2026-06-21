import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IdentityModule } from '../identity/identity.module';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiAgentToolsService } from './ai-agent-tools.service';

@Module({
  imports: [HttpModule, IdentityModule],
  controllers: [AiAgentController],
  providers: [AiAgentService, AiAgentToolsService],
  exports: [AiAgentService],
})
export class AiAgentModule {}

import { Module } from '@nestjs/common';
import { AiCocreationService } from './ai-cocreation.service';
import { AiCocreationController } from './ai-cocreation.controller';

@Module({
  controllers: [AiCocreationController],
  providers: [AiCocreationService],
  exports: [AiCocreationService],
})
export class AiCocreationModule {}

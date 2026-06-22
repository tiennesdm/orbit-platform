import { Module } from '@nestjs/common';
import { FederationService } from './federation.service';
import { FederationController } from './federation.controller';

@Module({
  controllers: [FederationController],
  providers: [FederationService],
  exports: [FederationService],
})
export class FederationModule {}

import { Module } from '@nestjs/common';
import { ReelController } from './reel.controller';
import { ReelService } from './reel.service';

@Module({
  controllers: [ReelController],
  providers: [ReelService],
  exports: [ReelService],
})
export class ReelModule {}

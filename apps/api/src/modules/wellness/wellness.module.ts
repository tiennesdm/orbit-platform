import { Module } from '@nestjs/common';
import { WellnessService } from './wellness.service';
import { WellnessController } from './wellness.controller';

@Module({
  controllers: [WellnessController],
  providers: [WellnessService],
  exports: [WellnessService],
})
export class WellnessModule {}

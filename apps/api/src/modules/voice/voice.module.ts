import { Module } from '@nestjs/common';
import { VoiceRoomService } from './voice.service';
import { VoiceRoomController } from './voice.controller';

@Module({
  controllers: [VoiceRoomController],
  providers: [VoiceRoomService],
  exports: [VoiceRoomService],
})
export class VoiceModule {}

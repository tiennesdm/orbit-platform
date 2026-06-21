import { Module } from '@nestjs/common';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';
import { E2eEncryptionService } from './e2e-encryption.service';

@Module({
  controllers: [DmController],
  providers: [DmService, E2eEncryptionService],
  exports: [DmService, E2eEncryptionService],
})
export class DmModule {}

import { Module } from '@nestjs/common';
import { RemixService } from './remix.service';
import { RemixController } from './remix.controller';

@Module({
  controllers: [RemixController],
  providers: [RemixService],
  exports: [RemixService],
})
export class RemixModule {}

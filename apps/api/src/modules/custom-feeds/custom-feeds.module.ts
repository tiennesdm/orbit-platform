import { Module } from '@nestjs/common';
import { CustomFeedService } from './custom-feeds.service';
import { CustomFeedController } from './custom-feeds.controller';

@Module({
  controllers: [CustomFeedController],
  providers: [CustomFeedService],
  exports: [CustomFeedService],
})
export class CustomFeedsModule {}

import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3StorageAdapter } from '../../common/storage/s3-storage.adapter';
import { LocalStorageAdapter } from '../../common/storage/local-storage.adapter';

@Module({
  controllers: [MediaController],
  providers: [MediaService, S3StorageAdapter, LocalStorageAdapter],
  exports: [MediaService, S3StorageAdapter],
})
export class MediaModule {}

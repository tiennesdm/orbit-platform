import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { EmbeddingsService } from './embeddings.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, EmbeddingsService],
  exports: [SearchService, EmbeddingsService],
})
export class SearchModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { YoutubeController } from './youtube/youtube.controller';
import { YoutubeModule } from './youtube/youtube.module';
import { YoutubeService } from './youtube/youtube.service';

@Module({
  imports: [YoutubeModule],
  controllers: [AppController, YoutubeController],
  providers: [AppService, YoutubeService],
  exports: [YoutubeService],
})
export class AppModule {}

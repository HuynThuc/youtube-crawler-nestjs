import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { VideoInfo } from './entities/video_info.entity';
import { PlaylistVideos } from './entities/playlist_video.entity'; // Đường dẫn đến entity VideoInfo
 // Đường dẫn đến entity PlaylistVideos

@Module({
  imports: [
    TypeOrmModule.forFeature([VideoInfo, PlaylistVideos ]), // Đăng ký các entity
  ],
  controllers: [YoutubeController],
  providers: [YoutubeService], // Cung cấp dịch vụ YoutubeService
  exports: [YoutubeService], // Xuất dịch vụ để có thể sử dụng ở nơi khác
})
export class YoutubeModule {}

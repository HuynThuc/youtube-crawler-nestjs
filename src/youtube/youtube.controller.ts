import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { YoutubeService } from './youtube.service';

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('video/info')
  async getVideoInfo(@Query('url') url: string) {
    if (!url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.youtubeService.getVideoInfo(url);
      return {
        status: 'success',
        data: result, // Trả về thông tin video
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch video info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('playlist')
  async getPlaylistVideos(@Query('url') url: string) {
    if (!url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.youtubeService.getVideosFromPlaylist(url);
      return {
        status: 'success',
        data: result, // Trả về danh sách video trong playlist
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch playlist videos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

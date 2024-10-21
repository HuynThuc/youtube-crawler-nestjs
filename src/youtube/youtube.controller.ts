import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './youtube.service';

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('info')
  async getVideoInfo(@Query('url') url: string) {
    const data = await this.youtubeService.getVideoInfo(url);
    return { data };
  }

//   @Get('download-audio')
//   async downloadAudio(@Query('url') url: string) {
//     const mp3Url = await this.youtubeService.downloadAudio(url);
//     return { mp3_url: mp3Url };
//   }
}

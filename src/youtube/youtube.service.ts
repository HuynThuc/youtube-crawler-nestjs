import { Injectable } from '@nestjs/common';
import * as ytdl from 'ytdl-core';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class YoutubeService {
  async getVideoInfo(url: string) {
    const info = await ytdl.getBasicInfo(url);

    const data = {
      title: info.videoDetails.title,
      description: info.videoDetails.description,
      thumbnailUrl: info.videoDetails.thumbnails[0].url,
      blurThumbnailUrl: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      duration: parseInt(info.videoDetails.lengthSeconds, 10),
      likeCount: info.videoDetails.likes,
      viewCount: parseInt(info.videoDetails.viewCount, 10),
      channel: {
        channelId: info.videoDetails.author.channel_url,
        channelName: info.videoDetails.author.name,
        channelAvatarImageUrl: info.videoDetails.author.thumbnails[0].url,
        channelDescription: info.videoDetails.ownerProfileUrl || '',
           
      },
      mp3_url: '', // Will be filled after audio extraction
    };

    return data;
  }

  async downloadAudio(url: string) {
    const output = join(__dirname, '../static', 'audio.mp3');
    const audioStream = ytdl(url, { filter: 'audioonly' });

    audioStream.pipe(fs.createWriteStream(output));

    return new Promise<string>((resolve, reject) => {
      audioStream.on('end', () => {
        resolve('/static/audio.mp3');
      });
      audioStream.on('error', reject);

      // Set up file deletion after 1 minute
      setTimeout(() => {
        fs.unlink(output, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }, 60000); // 1 minute
    });
  }
}

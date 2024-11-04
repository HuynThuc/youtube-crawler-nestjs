import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ytdl from 'ytdl-core';
import * as ytpl from 'ytpl';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { VideoInfo } from './entities/video_info.entity';
import { PlaylistVideos } from './entities/playlist_video.entity';

@Injectable()
export class YoutubeService {
  private readonly proxyUrl: string;
  private readonly TEMP_DIR = 'static/temp';
  private readonly DELETE_AFTER_MS = 60000;
  private readonly RETRY_DELAY = 10000;
  private readonly MAX_RETRIES = 3;

  constructor(
    @InjectRepository(VideoInfo)
    private videoInfoRepository: Repository<VideoInfo>,
    @InjectRepository(PlaylistVideos)
    private readonly playlistVideosRepository: Repository<PlaylistVideos>,
  ) {

     // Cấu hình proxy với Nginx
     const proxyHost = process.env.PROXY_HOST || 'nginx-proxy';
     const proxyPort = process.env.PROXY_PORT || '80';
     const proxyUsername = process.env.PROXY_USERNAME;
     const proxyPassword = process.env.PROXY_PASSWORD;
     
     // Format URL proxy
     this.proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;

    // Tạo thư mục tạm nếu chưa tồn tại
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  private getProxyConfig() {
    const proxy = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
    return {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}`).toString('base64')
      },
      httpsAgent: new HttpsProxyAgent(proxy), // Sử dụng HttpsProxyAgent để cấu hình proxy
    };
  }


  
  // Hàm để lấy thông tin video từ URL
  async getVideoInfo(url: string) {
    try {
      const info = await this.getVideoInfoWithRetry(url);
      const fileName = `${uuidv4()}.mp3`;
      const filePath = path.join(this.TEMP_DIR, fileName);

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
        mp3_url: `${process.env.APP_URL || 'http://localhost:3000'}/${filePath}`,
        status: 'processing',
      };

      // Lưu thông tin video vào cơ sở dữ liệu
      await this.saveVideoInfo({
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        thumbnail_url: info.videoDetails.thumbnails[0].url,
        blur_thumbnail_url: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
        duration: parseInt(info.videoDetails.lengthSeconds, 10),
        like_count: info.videoDetails.likes,
        view_count: parseInt(info.videoDetails.viewCount, 10),
        channel_id: info.videoDetails.author.channel_url,
        channel_name: info.videoDetails.author.name,
        channel_avatar_url: info.videoDetails.author.thumbnails[0].url,
        channel_description: info.videoDetails.ownerProfileUrl || '',
        mp3_file_path: filePath,
        status: 'processing',
      });

      // Tiến hành tải MP3 trong background
      this.downloadAsMp3(url, filePath)
        .then(() => {
          console.log(`Download completed for ${filePath}`);
        })
        .catch(error => {
          console.error(`Download failed for ${filePath}:`, error);
        });

     // Xóa file sau một khoảng thời gian
     setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }, this.DELETE_AFTER_MS);

      return data;
    } catch (error) {
      console.error('Error fetching video info:', error);
      throw new HttpException(
        error.message || 'Failed to fetch video info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Hàm lưu thông tin video vào cơ sở dữ liệu
  private async saveVideoInfo(videoData: Partial<VideoInfo>): Promise<VideoInfo> {
    const videoInfo = this.videoInfoRepository.create(videoData);
    return this.videoInfoRepository.save(videoInfo);
  }

  // Hàm thêm retry logic để lấy thông tin video
  private async getVideoInfoWithRetry(url: string, attempt = 1): Promise<ytdl.videoInfo> {
    try {
      return await ytdl.getBasicInfo(url, {
        requestOptions: this.getProxyConfig()
      });
    } catch (error) {
      if (error.statusCode === 429 && attempt <= this.MAX_RETRIES) {
        console.log(`Rate limited, retrying in ${this.RETRY_DELAY / 1000} seconds... (Attempt ${attempt})`);
        await this.delay(this.RETRY_DELAY);
        return this.getVideoInfoWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  // Hàm delay để tạo khoảng nghỉ giữa các lần request
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Hàm để tải MP3 từ video và lưu vào đường dẫn chỉ định
  private async downloadAsMp3(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = ytdl(url, {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: this.getProxyConfig()
      });

      stream.pipe(fs.createWriteStream(outputPath))
        .on('finish', () => {
          console.log(`Downloaded and saved to ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          console.error('Download error:', error);
          reject(new Error('Failed to download audio'));
        });
    });
  }

// Hàm để lấy danh sách video từ playlist và lưu vào cơ sở dữ liệu
async getVideosFromPlaylist(playlistUrl: string) {
  try {
    const playlist = await this.getPlaylistWithRetry(playlistUrl);
    const videoPromises = playlist.items.map((item) => this.saveVideoFromPlaylist(item));

    await Promise.all(videoPromises);

    return {
      message: 'Videos saved successfully',
    };
  } catch (error) {
    console.error('Error fetching playlist videos:', error.message);
    throw new HttpException(
      error.message || 'Failed to fetch playlist videos',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

// Updated method to use proxy for playlist fetching
private async getPlaylistWithRetry(playlistUrl: string, attempt = 1): Promise<ytpl.Result> {
  try {
    return await ytpl(playlistUrl, {
      requestOptions: this.getProxyConfig() // Sử dụng cấu hình proxy ở đây
    });
  } catch (error) {
    if (error.statusCode === 429 && attempt <= this.MAX_RETRIES) {
      console.log(`Rate limited on playlist, retrying in ${this.RETRY_DELAY / 1000} seconds... (Attempt ${attempt})`);
      await this.delay(this.RETRY_DELAY);
      return this.getPlaylistWithRetry(playlistUrl, attempt + 1);
    }
    throw error;
  }
}


   // Hàm lưu thông tin video từ playlist vào cơ sở dữ liệu
   private async saveVideoFromPlaylist(videoData: any): Promise<PlaylistVideos> {
    const playlistVideo = this.playlistVideosRepository.create({
      title: videoData.title,
      short_url: videoData.short_url,
    });
    return this.playlistVideosRepository.save(playlistVideo);
  }
}
